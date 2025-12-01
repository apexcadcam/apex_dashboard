import frappe
import json

def test():
    from apex_dashboard.apex_dashboard.page.liquidity_dashboard.liquidity_dashboard import get_dashboard_data
    
    print("Fetching Liquidity Dashboard Data...")
    try:
        data = get_dashboard_data()
        print("\nSuccess!")
        print(f"Total Liquidity: {data.get('total_liquidity')}")
        print(f"Groups: {len(data.get('groups', []))}")
        
        for group in data.get('groups', []):
            print(f"\nGroup: {group.get('name')} ({group.get('total_egp')} EGP)")
            for acc in group.get('accounts', []):
                print(f"  - {acc.get('name')}: {acc.get('balance')} {acc.get('currency')}")
                
    except Exception as e:
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()

