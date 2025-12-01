import frappe
import json

def test():
    from apex_dashboard.expense_dashboard_utils import get_expense_dashboard_data
    
    result = get_expense_dashboard_data(
        company='APEX',
        period='custom',
        from_date='2000-01-01',
        to_date='2099-12-31',
        include_zero=False
    )
    
    print("=" * 70)
    print("Testing get_expense_dashboard_data()")
    print("=" * 70)
    print(f"Grand Total: {result.get('grand_total')}")
    print(f"Number of categories: {len(result.get('categories', []))}")
    
    if result.get('categories'):
        for i, cat in enumerate(result['categories'][:3]):
            print(f"\n--- Category {i+1}: {cat.get('label')} ---")
            print(f"Total EGP: {cat.get('total_egp')}")
            print(f"Number of accounts: {len(cat.get('accounts', []))}")
            if cat.get('accounts'):
                for j, acc in enumerate(cat['accounts'][:3]):
                    print(f"  Account {j+1}: {acc.get('account_name')} = {acc.get('balance_in_egp')}")
    
    return result
