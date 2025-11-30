import frappe
from frappe import _
from frappe.utils import flt, getdate, add_months, add_days, get_first_day, get_last_day, today

@frappe.whitelist()
def get_dashboard_data(company=None, period="This Month", from_date=None, to_date=None):
    if not company:
        company = frappe.defaults.get_user_default("Company")

    # Use custom dates if provided, otherwise calculate from period
    if period == "Custom" and from_date and to_date:
        from_date = getdate(from_date)
        to_date = getdate(to_date)
    else:
        from_date, to_date = get_period_dates(period)
    
    # Get Company Currency
    currency = frappe.get_value("Company", company, "default_currency")

    # Fetch Config
    config = frappe.get_single("Apex Dashboard Config")
    
    categories = {}
    total = 0.0
    
    # Fetch all relevant GL entries once (Optimization)
    gl_entries = frappe.db.sql("""
        SELECT account, debit, credit
        FROM `tabGL Entry`
        WHERE company = %s 
            AND posting_date BETWEEN %s AND %s 
            AND is_cancelled = 0
    """, (company, from_date, to_date), as_dict=1)

    if config.cards:
        for row in config.cards:
            # Fetch linked visual card details
            card_doc = frappe.get_doc("Apex Dashboard Card", row.card)
            
            # Filter by category here - replace "Equity" with actual category
            if card_doc.category != "Equity" or not card_doc.is_active:
                continue

            if row.card_source == "Static Value":
                static_value = flt(row.static_value)
                
                # Check if card already exists
                if card_doc.card_title in categories:
                    categories[card_doc.card_title]['total'] += static_value
                else:
                    categories[card_doc.card_title] = {
                        'name': card_doc.card_title,
                        'total': static_value,
                        'color': card_doc.color,
                        'accounts': []
                    }
                total += static_value

            elif row.card_source == "Chart of Accounts" and row.account:
                parent_account = row.account
                
                if not parent_account:
                    continue

                # Fetch all child accounts under the parent
                if frappe.db.exists("Account", parent_account):
                    parent_lft, parent_rgt = frappe.db.get_value("Account", parent_account, ["lft", "rgt"])
                    
                    child_accounts = frappe.db.sql("""
                        SELECT name, account_name 
                        FROM `tabAccount` 
                        WHERE lft >= %s AND rgt <= %s AND is_group = 0 AND docstatus = 0
                    """, (parent_lft, parent_rgt), as_dict=1)
                    
                    card_total = 0.0
                    account_details = []
                    
                    for account in child_accounts:
                        # Filter GL Entries for this account
                        account_gl_entries = [
                            gl for gl in gl_entries 
                            if gl.account == account['name']
                        ]
                        
                        # Calculate balance (debit - credit for assets/expenses, credit - debit for liabilities/equity/income)
                        balance = sum(gl['debit'] - gl['credit'] for gl in account_gl_entries) if account_gl_entries else 0.0
                        
                        if balance != 0:
                            card_total += balance
                            account_details.append({
                                'account_name': account['account_name'],
                                'amount': balance
                            })
                    
                    if card_total != 0 or len(account_details) > 0:
                        account_details.sort(key=lambda x: abs(x['amount']), reverse=True)
                        
                        # Check if card already exists
                        if card_doc.card_title in categories:
                            categories[card_doc.card_title]['total'] += card_total
                            categories[card_doc.card_title]['accounts'].extend([
                                {'name': d['account_name'], 'balance': d['amount']} for d in account_details
                            ])
                            categories[card_doc.card_title]['accounts'].sort(key=lambda x: abs(x['balance']), reverse=True)
                        else:
                            categories[card_doc.card_title] = {
                                'name': card_doc.card_title,
                                'total': card_total,
                                'color': card_doc.color,
                                'accounts': [
                                    {'name': d['account_name'], 'balance': d['amount']} for d in account_details
                                ]
                            }
                        total += card_total

    # Convert dict to list and sort by total
    category_list = list(categories.values())
    category_list.sort(key=lambda x: abs(x["total"]), reverse=True)

    return {
        "total": total,
        "currency": currency,
        "groups": category_list,
        "period": {
            "from_date": from_date,
            "to_date": to_date
        }
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
