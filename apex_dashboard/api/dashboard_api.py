import frappe
from frappe import _
from frappe.query_builder import DocType
from frappe.utils import flt, getdate, today
from apex_dashboard.query_utils import get_gl_balances

@frappe.whitelist()
def get_dashboard_stats(dashboard_name):
    """
    Get statistics for a specific dashboard.
    Uses caching for performance.
    """
    # 1. Validate Input
    if not dashboard_name:
        frappe.throw(_("Dashboard Name is required"))

    # 2. Check Cache
    cache_key = f"dashboard_stats:{dashboard_name}"
    cached_data = frappe.cache().get_value(cache_key)
    if cached_data:
        return cached_data

    # 3. Get Dashboard Config
    if not frappe.db.exists("Apex Dashboard", dashboard_name):
         frappe.throw(_("Dashboard not found"))
         
    dashboard = frappe.get_doc("Apex Dashboard", dashboard_name)
    
    # 4. Calculate Stats based on category/type
    stats = {}
    
    # Dynamic dispatch based on category could go here
    if dashboard.category == "Finance":
        stats = _get_finance_stats()
    
    # 5. Set Cache (5 minutes)
    frappe.cache().set_value(cache_key, stats, expires_in_sec=300)
    
    return stats

def _get_finance_stats():
    """
    Internal function to calculate finance stats using Query Builder.
    Demonstrates joining tables and aggregation.
    """
    GL = DocType("GL Entry")
    Account = DocType("Account")
    
    current_year_start = f"{getdate(today()).year}-01-01"
    
    # Calculate Total Income YTD
    # Join GL Entry with Account to filter by root_type='Income'
    query = (
        frappe.qb.from_(GL)
        .join(Account).on(GL.account == Account.name)
        .select(
            (frappe.qb.functions.Sum(GL.credit) - frappe.qb.functions.Sum(GL.debit)).as_("total")
        )
        .where(GL.posting_date >= current_year_start)
        .where(GL.is_cancelled == 0)
        .where(Account.root_type == "Income")
        .where(GL.company == frappe.defaults.get_user_default("Company"))
    )
    
    income_data = query.run(as_dict=True)
    
    return {
        "total_income_ytd": flt(income_data[0].total) if income_data and income_data[0].total else 0.0,
        "currency": frappe.get_cached_value('Company',  frappe.defaults.get_user_default("Company"),  "default_currency")
    }
