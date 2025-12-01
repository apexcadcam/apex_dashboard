import frappe

frappe.init(site="site1")
frappe.connect()

print("=" * 70)
print("Testing Expenses Dashboard API")
print("=" * 70)

from apex_dashboard.apex_dashboard.page.expenses_dashboard.expenses_dashboard import get_dashboard_data

result = get_dashboard_data(company="APEX", period="All Time")

print(f"\nTotal Expenses: {result.get('total_expenses')}")
print(f"Currency: {result.get('currency')}")
print(f"Period: {result.get('period')}")
print(f"From: {result.get('from_date')} To: {result.get('to_date')}")
print(f"\nNumber of groups: {len(result.get('groups', []))}")

if result.get('groups'):
    print("\nFirst 3 groups:")
    for i, group in enumerate(result['groups'][:3]):
        print(f"\n{i+1}. {group.get('name')}")
        print(f"   Total: {group.get('total')}")
        print(f"   Color: {group.get('color')}")
        print(f"   Accounts: {len(group.get('accounts', []))}")
        if group.get('accounts'):
            print(f"   First account: {group['accounts'][0]}")

print("\n" + "=" * 70)
print("Testing Liquidity Dashboard API")
print("=" * 70)

from apex_dashboard.apex_dashboard.page.liquidity_dashboard.liquidity_dashboard import get_dashboard_data as get_liquidity_data

try:
    liq_result = get_liquidity_data()
    print(f"\nTotal Liquidity: {liq_result.get('total_liquidity')}")
    print(f"Number of groups: {len(liq_result.get('groups', []))}")
    if liq_result.get('groups'):
        print(f"First group: {liq_result['groups'][0].get('name')}")
except Exception as e:
    print(f"\nError: {e}")
    import traceback
    traceback.print_exc()

frappe.destroy()
