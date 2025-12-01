import frappe

def test():
    from apex_dashboard.query_utils import get_expense_totals
    
    accounts = [
        '5101002 - Office Supplies Expenses - AP',
        '5101040 - Accounting Office Expenses - AP'
    ]
    
    result = get_expense_totals(
        accounts=accounts,
        from_date='2000-01-01',
        to_date='2099-12-31',
        company='APEX',
        group_by_currency=True
    )
    
    print("=" * 70)
    print("Testing get_expense_totals()")
    print("=" * 70)
    for account, data in result.items():
        print(f"\nAccount: {account}")
        print(f"  Amount (account currency): {data['amount_account']}")
        print(f"  Amount (base currency): {data['amount_base']}")
        print(f"  Currency: {data['currency']}")
    
    return result
