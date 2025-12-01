import frappe
import json

def test():
    from apex_dashboard.apex_dashboard.page.expenses_dashboard.expenses_dashboard import get_dashboard_data
    
    result = get_dashboard_data(company='APEX', period='All Time')
    
    print("=" * 70)
    print("Testing expenses_dashboard.get_dashboard_data()")
    print("=" * 70)
    print(f"Total Expenses: {result.get('total_expenses')}")
    print(f"Currency: {result.get('currency')}")
    print(f"Number of groups: {len(result.get('groups', []))}")
    
    if result.get('groups'):
        for i, group in enumerate(result['groups'][:3]):
            print(f"\n--- Group {i+1}: {group.get('name')} ---")
            print(f"Total: {group.get('total')}")
            print(f"Color: {group.get('color')}")
            print(f"Number of accounts: {len(group.get('accounts', []))}")
            if group.get('accounts'):
                for j, acc in enumerate(group['accounts'][:3]):
                    print(f"  Account {j+1}: {acc.get('name')} = {acc.get('balance')}")
    
    return result
