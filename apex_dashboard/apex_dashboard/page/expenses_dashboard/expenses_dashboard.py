import frappe
from frappe import _
from frappe.utils import flt, getdate, add_months, add_days, get_first_day, get_last_day, today

@frappe.whitelist()
def get_dashboard_data(company=None, period="This Month", from_date=None, to_date=None, fiscal_year=None):
    """
    Get expense dashboard data using the standalone expense_dashboard_utils.
    This function is called by the frontend JavaScript.
    """
    # Import the standalone utility function
    from apex_dashboard.expense_dashboard_utils import get_expense_dashboard_data
    
    # Map the period parameter to the format expected by the utility
    period_mapping = {
        "Today": "daily",
        "This Week": "weekly",
        "This Month": "monthly",
        "Last Month": "monthly",
        "This Year": "yearly",
        "Last Year": "yearly",
        "Fiscal Year": "yearly",
        "All Time": "custom",
        "Custom": "custom"
    }
    
    mapped_period = period_mapping.get(period, "monthly")
    
    # Calculate dates
    if fiscal_year:
        from_date, to_date = frappe.db.get_value("Fiscal Year", fiscal_year, ["year_start_date", "year_end_date"])
    elif period == "Custom" and from_date and to_date:
        from_date = getdate(from_date)
        to_date = getdate(to_date)
    else:
        if not period:
            period = "This Month"
        from_date, to_date = get_period_dates(period)
    
    # Call the standalone utility function
    data = get_expense_dashboard_data(
        company=company,
        period=mapped_period,
        from_date=str(from_date),
        to_date=str(to_date),
        include_zero=False,
        compare_to_previous=False
    )
    
    # Transform the data to match the frontend expectations
    transformed_data = {
        'groups': [],
        'total_expenses': data.get('grand_total', 0),
        'currency': data.get('currency', 'EGP'),
        'period': period,
        'from_date': str(from_date),
        'to_date': str(to_date)
    }
    
    # Transform categories to groups format expected by frontend
    for category in data.get('categories', []):
        group = {
            'name': category.get('label', category.get('name', 'Unknown')),
            'total': category.get('total_egp', 0),
            'color': category.get('color', '#9E9E9E'),
            'accounts': []
        }
        
        # Transform accounts
        for account in category.get('accounts', []):
            group['accounts'].append({
                'name': account.get('account_name', account.get('account', 'Unknown')),
                'balance': account.get('balance_in_egp', 0)
            })
        
        # Only include groups with data
        if group['total'] > 0 or group['accounts']:
            transformed_data['groups'].append(group)
    
    return transformed_data

def get_period_dates(period):
    """Calculate date range based on period string."""
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
        return getdate("2000-01-01"), getdate("2099-12-31")
    else:
        return get_first_day(current_date), get_last_day(current_date)
