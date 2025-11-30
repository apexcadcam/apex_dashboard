import frappe
import json
from apex_dashboard.api.equity_v2 import get_dashboard_data

def execute():
    print("--- Testing Equity API v2 ---")
    try:
        data = get_dashboard_data(company="APEX", period="All Time")
        print(json.dumps(data, indent=2, default=str))
    except Exception as e:
        print(f"Error: {e}")
        frappe.log_error(frappe.get_traceback(), "Equity API v2 Test Error")
