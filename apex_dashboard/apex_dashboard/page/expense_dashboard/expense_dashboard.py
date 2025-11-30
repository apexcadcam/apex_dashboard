import frappe
from frappe import _
from frappe.utils import flt, getdate, add_months, add_days, get_first_day, get_last_day, today

@frappe.whitelist()
def get_dashboard_data(company=None, period="This Month", from_date=None, to_date=None):
    # Check cache first
    from apex_dashboard.cache_utils import get_cached_dashboard_data, set_dashboard_cache
    
    cache_key_suffix = f"{company}_{period}_{from_date}_{to_date}"
    cache_key = f"expense_{cache_key_suffix}"
    cached_data = frappe.cache().get_value(cache_key)
    if cached_data:
        return cached_data
    
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
    total_expense = 0.0
    
    # Fetch all relevant GL entries once (Optimization)
    gl_entries = frappe.db.sql("""
        SELECT account, debit
        FROM `tabGL Entry`
        WHERE company = %s 
            AND posting_date BETWEEN %s AND %s 
            AND is_cancelled = 0
            AND debit > 0
    """, (company, from_date, to_date), as_dict=1)

    if config.cards:
        for row in config.cards:
            # Fetch linked visual card details
            card_doc = frappe.get_doc("Apex Dashboard Card", row.card)
            
            if card_doc.category != "Expenses" or not card_doc.is_active:
                continue

            if row.card_source == "Static Value":
                static_value = flt(row.static_value)
                
                categories[card_doc.card_title] = {
                    'name': card_doc.card_title,
                    'total': static_value,
                    'color': card_doc.color,
                    'accounts': []
                }
                total_expense += static_value

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
                        
                        expense_value = sum(gl['debit'] for gl in account_gl_entries) if account_gl_entries else 0.0
                        
                        if expense_value > 0:
                            card_total += expense_value
                            account_details.append({
                                'account_name': account['account_name'],
                                'amount': expense_value
                            })
                    
                    if card_total > 0:
                        account_details.sort(key=lambda x: x['amount'], reverse=True)
                        
                        # Check if card already exists in categories (from previous row)
                        if card_doc.card_title in categories:
                            # Merge with existing data
                            categories[card_doc.card_title]['total'] += card_total
                            categories[card_doc.card_title]['accounts'].extend([
                                {'name': d['account_name'], 'balance': d['amount']} for d in account_details
                            ])
                            # Re-sort accounts by balance
                            categories[card_doc.card_title]['accounts'].sort(key=lambda x: x['balance'], reverse=True)
                        else:
                            # Create new entry
                            categories[card_doc.card_title] = {
                                'name': card_doc.card_title,
                                'total': card_total,
                                'color': card_doc.color, # Use hex color directly
                                'accounts': [
                                    {'name': d['account_name'], 'balance': d['amount']} for d in account_details
                                ]
                            }
                        total_expense += card_total

    # Convert dict to list and sort by total
    category_list = list(categories.values())
    category_list.sort(key=lambda x: x["total"], reverse=True)

    data = {
        'groups': category_list,
        'total_expense': total_expense,
        'currency': currency,
        'period': period,
        'from_date': str(from_date),
        'to_date': str(to_date)
    }
    
    # Cache for 5 minutes
    frappe.cache().set_value(cache_key, data, expires_in_sec=300)
    
    return data

def get_period_dates(period):
    current_date = getdate(today())
    
    if period == "Today":
        from_date = current_date
        to_date = current_date
    elif period == "This Week":
        # Week starts on Sunday (or Monday depending on locale, but let's assume standard start)
        # frappe.utils.get_first_day_of_week returns Monday usually
        # Let's use relative delta to find start of week
        from_date = add_days(current_date, -current_date.weekday()) # Monday
        to_date = add_days(from_date, 6) # Sunday
    elif period == "This Month":
        from_date = get_first_day(current_date)
        to_date = get_last_day(current_date)
    elif period == "Last Month":
        last_month = add_months(current_date, -1)
        from_date = get_first_day(last_month)
        to_date = get_last_day(last_month)
    elif period == "This Year":
        from_date = getdate(f"{current_date.year}-01-01")
        to_date = getdate(f"{current_date.year}-12-31")
    elif period == "Last Year":
        from_date = getdate(f"{current_date.year - 1}-01-01")
        to_date = getdate(f"{current_date.year - 1}-12-31")
    elif period == "All Time":
        from_date = getdate("1900-01-01")
        to_date = getdate("2099-12-31")
    else:
        # Default to this month
        from_date = get_first_day(current_date)
        to_date = get_last_day(current_date)
    
    return from_date, to_date
