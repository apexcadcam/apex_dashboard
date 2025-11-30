import frappe
from apex_dashboard.apex_dashboard.page.profitability_dashboard.profitability_dashboard import get_dashboard_data

frappe.connect(site="site1")
data = get_dashboard_data(period="Last Month") # Oct 2025
print("Best Item:", data['summary']['best_item'])
print("Best Supplier:", data['summary']['best_supplier'])
