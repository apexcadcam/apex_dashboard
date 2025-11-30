import frappe
from frappe import _
from frappe.utils import flt, getdate, add_months, add_days, get_first_day, get_last_day, today
from apex_dashboard.query_utils import get_gl_balances

@frappe.whitelist()
def get_dashboard_data(company=None, period="This Month", from_date=None, to_date=None):
    """
    Get equity dashboard data with partner breakdowns and company metrics.
    
    Args:
        company: Company name
        period: Period selection
        from_date: Custom start date
        to_date: Custom end date
        
    Returns:
        dict: Dashboard data with partners, metrics, and trends
    """
    # Check cache first
    cache_key = f"equity_enhanced_{company}_{period}_{from_date}_{to_date}"
    cached_data = frappe.cache().get_value(cache_key)
    if cached_data:
        return cached_data
    
    if not company:
        company = frappe.defaults.get_user_default("Company")

    if period == "Custom" and from_date and to_date:
        from_date = getdate(from_date)
        to_date = getdate(to_date)
    else:
        from_date, to_date = get_period_dates(period)
    
    currency = frappe.get_value("Company", company, "default_currency")
    
    # Determine period label and calculation method
    period_label = ""
    calculate_ytd = False
    
    if period == "This Month":
        period_label = f"هذا الشهر ({from_date.strftime('%B %Y')})"
    elif period == "Last Month":
        period_label = f"الشهر الماضي ({from_date.strftime('%B %Y')})"
    elif period == "This Year":
        period_label = f"هذا العام ({from_date.year})"
        calculate_ytd = True
    elif period == "Last Year":
        period_label = f"العام الماضي ({from_date.year})"
    elif period == "All Time":
        period_label = "كل الوقت"
    else:
        period_label = f"من {from_date} إلى {to_date}"
    
    # Get fiscal year start for YTD calculation (only if This Year selected)
    if calculate_ytd:
        fiscal_year = frappe.db.sql("""
            SELECT year_start_date, year_end_date 
            FROM `tabFiscal Year`
            WHERE is_short_year = 0
            ORDER BY year_start_date DESC
            LIMIT 1
        """, as_dict=1)
        
        ytd_from_date = fiscal_year[0].year_start_date if fiscal_year else getdate(f"{getdate(to_date).year}-01-01")
    else:
        ytd_from_date = from_date
    
    # 1. Fetch All Equity Accounts & Balances
    equity_root_type = "Equity"
    
    # Calculate Total Equity directly via SQL to ensure accuracy (Credit - Debit)
    total_equity_data = frappe.db.sql("""
        SELECT SUM(credit - debit) as net_equity 
        FROM `tabGL Entry` gl 
        JOIN `tabAccount` acc ON gl.account = acc.name 
        WHERE gl.company = %s 
        AND gl.is_cancelled = 0 
        AND acc.root_type = 'Equity'
        AND gl.posting_date <= %s
    """, (company, to_date), as_dict=1)
    
    total_equity = flt(total_equity_data[0].net_equity) if total_equity_data else 0

    # Get individual account balances for breakdown
    all_equity_accounts = frappe.db.get_all("Account", 
        filters={"root_type": equity_root_type, "company": company, "is_group": 0},
        fields=["name", "account_name", "parent_account", "account_type"]
    )
    
    account_names = [acc.name for acc in all_equity_accounts]
    
    balance_map = get_gl_balances(
        accounts=account_names,
        company=company,
        from_date="2000-01-01",
        to_date=to_date,
        group_by_currency=True
    )
    
    # 2. Calculate YTD Profit (Income - Expense for fiscal year)
    ytd_profit = frappe.db.sql("""
        SELECT SUM(credit - debit) 
        FROM `tabGL Entry` gl
        JOIN `tabAccount` acc ON gl.account = acc.name
        WHERE gl.company = %s 
        AND gl.posting_date >= %s
        AND gl.posting_date <= %s
        AND gl.is_cancelled = 0
        AND acc.root_type IN ('Income', 'Expense')
    """, (company, ytd_from_date, to_date))[0][0] or 0.0
    
    # 3. Get Yearly Profits for comparison (All history)
    yearly_profits = frappe.db.sql("""
        SELECT 
            YEAR(posting_date) as year,
            SUM(credit - debit) as profit
        FROM `tabGL Entry` gl
        JOIN `tabAccount` acc ON gl.account = acc.name
        WHERE gl.company = %s 
        AND gl.is_cancelled = 0
        AND gl.voucher_type != 'Period Closing Voucher'
        AND acc.root_type IN ('Income', 'Expense')
        GROUP BY YEAR(posting_date)
        ORDER BY year DESC
    """, (company,), as_dict=1)
    
    # 4. Classify & Group by Partner/Category
    partners = {}
    company_metrics = {
        "retained_earnings": 0.0,
        "ytd_profit": flt(ytd_profit),
        "total_equity": 0.0,
        "yearly_profits": yearly_profits
    }
    
    # Helper to normalize balance (Credit is positive for Equity)
    def get_net_balance(acc_name):
        if acc_name in balance_map:
            return -1 * flt(balance_map[acc_name].get("amount_base", 0))
        return 0.0

    # 4. Process Partners
    partners = {}
    
    for acc in all_equity_accounts:
        balance = get_net_balance(acc.name)
        if balance == 0:
            continue
            
        company_metrics["total_equity"] += balance
        
        name_lower = acc.account_name.lower()
        
        # Identify Partner
        partner_name = "Other"
        if "mohamed gaber" in name_lower:
            partner_name = "Mohamed Gaber"
        elif "alsaid" in name_lower or "elsayed" in name_lower:
            partner_name = "Elsayed Said"
        elif "retained earnings" in name_lower:
            company_metrics["retained_earnings"] += balance
            continue
        elif "net income" in name_lower or "profit" in name_lower or "loss" in name_lower:
            # Skip - already calculated in ytd_profit
            continue
            
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
            
        # Classify Type
        if "capital" in name_lower:
            partners[partner_name]["capital"] += balance
        elif "current" in name_lower:
            partners[partner_name]["current"] += balance
        elif "withdrawal" in name_lower:
            partners[partner_name]["withdrawals"] += balance 
            partners[partner_name]["withdrawal_accounts"].append(acc.name)
        else:
            partners[partner_name]["current"] += balance
            
        partners[partner_name]["net_equity"] += balance
        partners[partner_name]["accounts"].append({
            "name": acc.account_name,
            "balance": balance
        })

    # Fetch last 10 withdrawals for each partner
    for partner_name, p_data in partners.items():
        if p_data.get("withdrawal_accounts"):
            withdrawals = frappe.db.get_all("GL Entry",
                filters={
                    "account": ["in", p_data["withdrawal_accounts"]],
                    "is_cancelled": 0,
                    "company": company
                },
                fields=["posting_date", "remarks", "debit", "credit"],
                order_by="posting_date desc",
                limit=10
            )
            
            formatted_withdrawals = []
            for w in withdrawals:
                formatted_withdrawals.append({
                    "date": w.posting_date,
                    "remarks": w.remarks,
                    "amount": w.debit - w.credit
                })
            
            p_data["recent_withdrawals"] = formatted_withdrawals
        else:
            p_data["recent_withdrawals"] = []

    # Convert partners dict to list and calculate percentages based on CAPITAL (50/50)
    partner_list = list(partners.values())
    partner_list.sort(key=lambda x: x["net_equity"], reverse=True)
    
    total_partner_capital = sum(p["capital"] for p in partner_list)
    for p in partner_list:
        # Percentage based on capital contribution (should be 50/50)
        p["equity_percentage"] = (p["capital"] / total_partner_capital * 100) if total_partner_capital else 0
        p["equity_share"] = p["net_equity"]  # Actual equity value

    data = {
        "total_equity": company_metrics["total_equity"],
        "currency": currency,
        "partners": partner_list,
        "metrics": company_metrics,
        "period": {
            "from_date": from_date,
            "to_date": to_date,
            "ytd_from_date": ytd_from_date,
            "label": period_label,
            "selected": period
        },
        "retained_earnings_cutoff": getdate(f"{getdate(to_date).year - 1}-12-31") if period == "This Year" else to_date
    }
    
    frappe.cache().set_value(cache_key, data, expires_in_sec=300)
    
    return data

@frappe.whitelist()
def get_equity_trends(company=None, months=12):
    """
    Get monthly equity trends for charting.
    """
    if not company:
        company = frappe.defaults.get_user_default("Company")
    
    end_date = today()
    
    # Handle 'all' option - fetch from first transaction
    if months == 'all':
        first_entry = frappe.db.sql("""
            SELECT MIN(posting_date) as start_date 
            FROM `tabGL Entry` 
            WHERE company = %s
        """, company, as_dict=1)
        start_date = first_entry[0].start_date if first_entry else add_months(end_date, -12)
    else:
        months = int(months)
        start_date = add_months(end_date, -months)
    
    # Generate monthly labels
    labels = []
    values = []
    
    current_date = getdate(start_date)
    # Align to start of month
    current_date = getdate(f"{current_date.year}-{current_date.month}-01")
    
    while current_date <= getdate(end_date):
        month_end = get_last_day(current_date)
        
        # Get equity balance as of month end
        # Optimization: Calculate total equity via SQL for speed
        period_equity = frappe.db.sql("""
            SELECT SUM(credit - debit) as net_equity 
            FROM `tabGL Entry` gl 
            JOIN `tabAccount` acc ON gl.account = acc.name 
            WHERE gl.company = %s 
            AND gl.is_cancelled = 0 
            AND acc.root_type = 'Equity'
            AND gl.posting_date <= %s
        """, (company, month_end), as_dict=1)
        
        total = flt(period_equity[0].net_equity) if period_equity else 0
        
        # Format label
        label = current_date.strftime("%b %Y")
        labels.append(label)
        values.append(total)
        
        current_date = add_months(current_date, 1)
    
    return {
        "labels": labels,
        "datasets": [{
            "name": "Total Equity",
            "values": values
        }]
    }

def get_period_dates(period):
    current_date = getdate(today())
    
    if period == "Today":
        return current_date, current_date
    elif period == "This Week":
        start = add_days(current_date, -current_date.weekday())
        end = add_days(start, 6)
        return start, end
    elif period == "This Month":
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
