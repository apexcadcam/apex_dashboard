import frappe
from apex_dashboard.api.equity_v2 import get_dashboard_data as api_get_dashboard_data
from apex_dashboard.api.finance_api import get_equity_trends as api_get_equity_trends

@frappe.whitelist()
def get_dashboard_data(company=None, period="This Month", from_date=None, to_date=None):
    """
    Proxy method for backward compatibility.
    Delegates to api.equity_v2.get_dashboard_data
    """
    return api_get_dashboard_data(company, period, from_date, to_date)

@frappe.whitelist()
def get_equity_trends(company=None):
    """
    Proxy method for backward compatibility.
    Delegates to api.finance_api.get_equity_trends
    """
    return api_get_equity_trends(company)
