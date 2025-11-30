import frappe
from apex_dashboard.apex_dashboard.page.profitability_dashboard.profitability_dashboard import get_dashboard_data, get_exchange_rates

def execute():
    print("--- Debugging Profitability Dashboard ---")
    
    # 1. Check Exchange Rates
    print("\n[1] Checking Exchange Rates...")
    try:
        rates = get_exchange_rates()
        print(f"Rates: {rates}")
    except Exception as e:
        print(f"Error fetching rates: {e}")

    # 2. Check Data Existence
    print("\n[2] Checking Data Existence...")
    si_count = frappe.db.count("Sales Invoice", {"docstatus": 1})
    pi_count = frappe.db.count("Purchase Invoice", {"docstatus": 1})
    print(f"Submitted Sales Invoices: {si_count}")
    print(f"Submitted Purchase Invoices: {pi_count}")

    if si_count == 0:
        print("WARNING: No submitted Sales Invoices found. Dashboard will be empty.")
    
    # 3. Test get_dashboard_data with default period
    print("\n[3] Testing get_dashboard_data (This Month)...")
    try:
        data = get_dashboard_data(period="This Month")
        print(f"Summary: {data.get('summary')}")
        print(f"Item Count: {len(data.get('item_profitability', []))}")
        print(f"Supplier Count: {len(data.get('supplier_profitability', []))}")
    except Exception as e:
        print(f"Error in get_dashboard_data: {e}")

    # 4. Test get_dashboard_data with All Time
    print("\n[4] Testing get_dashboard_data (All Time)...")
    try:
        data = get_dashboard_data(period="All Time")
        print(f"Summary: {data.get('summary')}")
        print(f"Item Count: {len(data.get('item_profitability', []))}")
        print(f"Supplier Count: {len(data.get('supplier_profitability', []))}")
        if len(data.get('item_profitability', [])) > 0:
            print(f"Top Item: {data['item_profitability'][0]}")
    except Exception as e:
        print(f"Error in get_dashboard_data (All Time): {e}")
