import frappe
from frappe import _
from frappe.query_builder import DocType
from frappe.utils import flt, getdate, add_months, today, get_first_day, get_last_day
from frappe.query_builder.functions import Sum, Coalesce, Extract

@frappe.whitelist()
def get_dashboard_data(company=None, period="This Month", from_date=None, to_date=None):
    """
    Get Equity Dashboard Data (v2).
    Strictly uses Query Builder and handles historical data correctly.
    """
    if not company:
        company = frappe.defaults.get_user_default("Company")
        
    # 1. Date Logic
    if period == "Custom" and from_date and to_date:
        from_date = getdate(from_date)
        to_date = getdate(to_date)
    else:
        from_date, to_date = get_period_dates(period)
        
    currency = frappe.get_cached_value('Company', company, 'default_currency')
    
    # 2. Fetch Data
    # A. Total Equity (Assets - Liabilities) or (Credit - Debit of Equity Accounts)
    # We use Equity Accounts approach for direct correlation with the dashboard purpose.
    total_equity = get_total_equity(company, to_date)
    
    # B. Yearly Profits (Operating Profit - Excluding Closing Entries)
    yearly_profits = get_yearly_profits(company)
    
    # C. Partner Breakdown
    partners, retained_earnings, ytd_profit = get_partner_equity(company, to_date, from_date)
    
    return {
        "company": company,
        "currency": currency,
        "period": {
            "label": period,
            "from_date": from_date,
            "to_date": to_date
        },
        "metrics": {
            "total_equity": total_equity,
            "retained_earnings": retained_earnings,
            "ytd_profit": ytd_profit,
            "yearly_profits": yearly_profits
        },
        "partners": partners
    }

def get_total_equity(company, to_date):
    """
    Calculate Total Equity: Sum(Credit - Debit) for all Equity accounts up to to_date.
    """
    gl = DocType("GL Entry")
    acc = DocType("Account")
    
    query = (
        frappe.qb.from_(gl)
        .join(acc).on(gl.account == acc.name)
        .select(Sum(gl.credit - gl.debit).as_("net_equity"))
        .where(gl.company == company)
        .where(gl.is_cancelled == 0)
        .where(acc.root_type == "Equity")
        .where(gl.posting_date <= to_date)
    )
    
    result = query.run(as_dict=True)
    return flt(result[0].net_equity) if result and result[0].net_equity else 0.0

def get_yearly_profits(company):
    """
    Get Yearly Profits (Income - Expense).
    CRITICAL: Exclude 'Period Closing Voucher' to show operating profit.
    """
    gl = DocType("GL Entry")
    acc = DocType("Account")
    
    query = (
        frappe.qb.from_(gl)
        .join(acc).on(gl.account == acc.name)
        .select(
            Extract('year', gl.posting_date).as_("year"),
            Sum(gl.credit - gl.debit).as_("profit")
        )
        .where(gl.company == company)
        .where(gl.is_cancelled == 0)
        .where(gl.voucher_type != "Period Closing Voucher") # EXCLUDE CLOSING ENTRIES
        .where(acc.root_type.isin(["Income", "Expense"]))
        .groupby(Extract('year', gl.posting_date))
        .orderby(Extract('year', gl.posting_date), order=frappe.qb.desc)
    )
    
    return query.run(as_dict=True)

def get_partner_equity(company, to_date, period_start_date):
    """
    Calculate Equity per Partner, Retained Earnings, and YTD Profit.
    """
    # 1. Get Balances for all Equity Accounts
    gl = DocType("GL Entry")
    acc = DocType("Account")
    
    query = (
        frappe.qb.from_(gl)
        .join(acc).on(gl.account == acc.name)
        .select(
            acc.name,
            acc.account_name,
            Sum(gl.credit - gl.debit).as_("balance")
        )
        .where(gl.company == company)
        .where(gl.is_cancelled == 0)
        .where(acc.root_type == "Equity")
        .where(gl.posting_date <= to_date)
        .groupby(acc.name)
    )
    
    account_balances = query.run(as_dict=True)
    
    # 2. Calculate YTD Profit (Separate Query for Income/Expense)
    # This is "Current Period Profit" usually shown in Equity
    ytd_query = (
        frappe.qb.from_(gl)
        .join(acc).on(gl.account == acc.name)
        .select(Sum(gl.credit - gl.debit).as_("profit"))
        .where(gl.company == company)
        .where(gl.is_cancelled == 0)
        .where(acc.root_type.isin(["Income", "Expense"]))
        .where(gl.posting_date >= period_start_date) # From start of selected period (usually year start)
        .where(gl.posting_date <= to_date)
        .where(gl.voucher_type != "Period Closing Voucher") # CRITICAL: Exclude closing entries
    )
    
    # If period is "This Year", we want YTD from start of year
    # If period is "All Time", this might just be total retained earnings?
    # Let's stick to the logic: YTD Profit is strictly Income - Expense for the requested period.
    
    ytd_result = ytd_query.run(as_dict=True)
    ytd_profit = flt(ytd_result[0].profit) if ytd_result and ytd_result[0].profit else 0.0

    partners = {}
    retained_earnings = 0.0
    
    for row in account_balances:
        balance = flt(row.balance)
        if balance == 0:
            continue
            
        name_lower = row.account_name.lower()
        
        # Identify Partner/Category
        # Include "Net Income Summary" in Retained Earnings
        if "retained earnings" in name_lower or "net income summary" in name_lower:
            retained_earnings += balance
            continue
        
        # Skip if it's the auto-calculated profit/loss account often present in charts
        if "profit" in name_lower and "loss" in name_lower:
             continue

        partner_name = _("Other")
        if "mohamed gaber" in name_lower:
            partner_name = "Mohamed Gaber"
        elif "alsaid" in name_lower or "elsayed" in name_lower:
            partner_name = "Elsayed Said"
        else:
            # Maybe handle unknown partners? For now group as Other or skip?
            # If it's a Capital/Current account, it likely belongs to a partner.
            if "capital" not in name_lower and "current" not in name_lower and "withdrawal" not in name_lower:
                 # Likely some other equity account
                 pass
        
        if partner_name not in partners:
            partners[partner_name] = {
                "name": partner_name,
                "capital": 0.0,
                "current": 0.0,
                "withdrawals": 0.0,
                "net_equity": 0.0,
                "accounts": [],
                "withdrawal_accounts": []
            }
            
        # Classify
        if "capital" in name_lower:
            partners[partner_name]["capital"] += balance
        elif "current" in name_lower:
            partners[partner_name]["current"] += balance
        elif "withdrawal" in name_lower:
            partners[partner_name]["withdrawals"] += balance
            partners[partner_name]["withdrawal_accounts"].append(row.name)
        else:
            partners[partner_name]["current"] += balance # Default to current if unsure
            
        partners[partner_name]["net_equity"] += balance
        partners[partner_name]["accounts"].append({
            "name": row.account_name,
            "balance": balance
        })

    # Fetch Recent Withdrawals for each partner
    for p_name, p_data in partners.items():
        p_data["recent_withdrawals"] = []
        if p_data["withdrawal_accounts"]:
            # Fetch last 5 withdrawals
            w_gl = DocType("GL Entry")
            w_query = (
                frappe.qb.from_(w_gl)
                .select(w_gl.posting_date, w_gl.remarks, (w_gl.debit - w_gl.credit).as_("amount"))
                .where(w_gl.account.isin(p_data["withdrawal_accounts"]))
                .where(w_gl.is_cancelled == 0)
                .where(w_gl.company == company)
                .orderby(w_gl.posting_date, order=frappe.qb.desc)
                .limit(5)
            )
            withdrawals = w_query.run(as_dict=True)
            p_data["recent_withdrawals"] = withdrawals

    # Convert to list
    partner_list = list(partners.values())
    partner_list.sort(key=lambda x: x["net_equity"], reverse=True)
    
    return partner_list, retained_earnings, ytd_profit

def get_period_dates(period):
    """
    Helper to get dates.
    """
    current_date = getdate(today())
    
    if period == "This Month":
        return get_first_day(current_date), get_last_day(current_date)
    elif period == "Last Month":
        last_month = add_months(current_date, -1)
        return get_first_day(last_month), get_last_day(last_month)
    elif period == "This Year":
        return getdate(f"{current_date.year}-01-01"), getdate(f"{current_date.year}-12-31")
    elif period == "Last Year":
        last_year = current_date.year - 1
        return getdate(f"{last_year}-01-01"), getdate(f"{last_year}-12-31")
    elif period == "All Time":
        return getdate("2000-01-01"), current_date
    else:
        return get_first_day(current_date), get_last_day(current_date)
