"""
Query Builder Utilities for Apex Dashboard
Reusable functions to replace raw SQL queries across all dashboards
"""

import frappe
from frappe.query_builder import DocType
from frappe.query_builder.functions import Sum, Coalesce
from typing import List, Dict, Optional
from frappe.utils import flt


def get_gl_balances(
    accounts: List[str],
    from_date: str,
    to_date: str,
    company: Optional[str] = None,
    group_by_currency: bool = True
) -> Dict[str, Dict]:
    """
    Get GL Entry balances for multiple accounts using Query Builder
    
    Args:
        accounts: List of account names
        from_date: Start date (YYYY-MM-DD)
        to_date: End date (YYYY-MM-DD)
        company: Optional company filter
        group_by_currency: If True, group by account and currency
    
    Returns:
        Dict mapping account name to balance data:
        {
            "Account Name": {
                "amount_account": float,  # Balance in account currency
                "amount_base": float,      # Balance in company currency
                "currency": str            # Account currency
            }
        }
    
    Example:
        balances = get_gl_balances(
            accounts=["Cash - A", "Bank - A"],
            from_date="2025-01-01",
            to_date="2025-12-31",
            company="Apex Company"
        )
    """
    if not accounts:
        return {}
    
    GLEntry = DocType("GL Entry")
    
    # Build base query
    query = (
        frappe.qb.from_(GLEntry)
        .select(
            GLEntry.account,
            Coalesce(GLEntry.account_currency, '').as_('account_currency'),
            (Sum(GLEntry.debit_in_account_currency) - Sum(GLEntry.credit_in_account_currency)).as_('amount_account'),
            (Sum(GLEntry.debit) - Sum(GLEntry.credit)).as_('amount_base')
        )
        .where(GLEntry.account.isin(accounts))
        .where(GLEntry.posting_date.between(from_date, to_date))
        .where(GLEntry.is_cancelled == 0)
    )
    
    # Add company filter if provided
    if company:
        query = query.where(GLEntry.company == company)
    
    # Group by account and optionally currency
    if group_by_currency:
        query = query.groupby(GLEntry.account, GLEntry.account_currency)
    else:
        query = query.groupby(GLEntry.account)
    
    # Execute query
    rows = query.run(as_dict=True)
    
    # Format results
    result = {}
    for row in rows:
        result[row.account] = {
            "amount_account": flt(row.amount_account or 0.0, 2),
            "amount_base": flt(row.amount_base or 0.0, 2),
            "currency": row.account_currency or ""
        }
    
    return result


def get_expense_totals(
    accounts: List[str],
    from_date: str,
    to_date: str,
    company: Optional[str] = None,
    group_by_currency: bool = True
) -> Dict[str, Dict]:
    """
    Get GL Entry totals for expense accounts (debit only, no credit subtraction)
    
    Args:
        accounts: List of expense account names
        from_date: Start date (YYYY-MM-DD)
        to_date: End date (YYYY-MM-DD)
        company: Optional company filter
        group_by_currency: If True, group by account and currency
    
    Returns:
        Dict mapping account name to expense data:
        {
            "Account Name": {
                "amount_account": float,  # Total debit in account currency
                "amount_base": float,      # Total debit in company currency
                "currency": str            # Account currency
            }
        }
    
    Example:
        expenses = get_expense_totals(
            accounts=["Salaries - A", "Rent - A"],
            from_date="2025-01-01",
            to_date="2025-12-31",
            company="Apex Company"
        )
    """
    if not accounts:
        return {}
    
    GLEntry = DocType("GL Entry")
    
    # Build base query - for expenses, we only sum debits
    query = (
        frappe.qb.from_(GLEntry)
        .select(
            GLEntry.account,
            Coalesce(GLEntry.account_currency, '').as_('account_currency'),
            Sum(GLEntry.debit_in_account_currency).as_('amount_account'),
            Sum(GLEntry.debit).as_('amount_base')
        )
        .where(GLEntry.account.isin(accounts))
        .where(GLEntry.posting_date.between(from_date, to_date))
        .where(GLEntry.is_cancelled == 0)
    )
    
    # Add company filter if provided
    if company:
        query = query.where(GLEntry.company == company)
    
    # Group by account and optionally currency
    if group_by_currency:
        query = query.groupby(GLEntry.account, GLEntry.account_currency)
    else:
        query = query.groupby(GLEntry.account)
    
    # Execute query
    rows = query.run(as_dict=True)
    
    # Format results
    result = {}
    for row in rows:
        result[row.account] = {
            "amount_account": flt(row.amount_account or 0.0, 2),
            "amount_base": flt(row.amount_base or 0.0, 2),
            "currency": row.account_currency or ""
        }
    
    return result



def get_child_accounts(
    parent_account: str,
    company: str,
    is_group: int = 0
) -> List[Dict]:
    """
    Get child accounts for a parent account using Query Builder
    
    Args:
        parent_account: Parent account name
        company: Company name
        is_group: Filter by is_group (0 = leaf accounts, 1 = group accounts)
    
    Returns:
        List of account dictionaries with fields:
        - name
        - account_name
        - account_currency
        - is_group
    
    Example:
        leaf_accounts = get_child_accounts(
            parent_account="Assets - A",
            company="Apex Company",
            is_group=0
        )
    """
    # Get parent account details
    parent = frappe.get_doc("Account", parent_account)
    
    Account = DocType("Account")
    
    query = (
        frappe.qb.from_(Account)
        .select(
            Account.name,
            Account.account_name,
            Account.account_currency,
            Account.is_group,
            Account.account_type
        )
        .where(Account.lft > parent.lft)
        .where(Account.rgt < parent.rgt)
        .where(Account.company == company)
    )
    
    # Filter by is_group if specified
    if is_group is not None:
        query = query.where(Account.is_group == is_group)
    
    return query.run(as_dict=True)


def get_account_balance_on_date(
    account: str,
    date: str,
    company: Optional[str] = None
) -> float:
    """
    Get account balance on a specific date using Query Builder
    
    Args:
        account: Account name
        date: Date (YYYY-MM-DD)
        company: Optional company filter
    
    Returns:
        float: Account balance
    
    Example:
        balance = get_account_balance_on_date(
            account="Cash - A",
            date="2025-12-31",
            company="Apex Company"
        )
    """
    GLEntry = DocType("GL Entry")
    
    query = (
        frappe.qb.from_(GLEntry)
        .select(
            (Sum(GLEntry.debit) - Sum(GLEntry.credit)).as_('balance')
        )
        .where(GLEntry.account == account)
        .where(GLEntry.posting_date <= date)
        .where(GLEntry.is_cancelled == 0)
    )
    
    if company:
        query = query.where(GLEntry.company == company)
    
    result = query.run(as_dict=True)
    
    if result and result[0]:
        return flt(result[0].get('balance', 0), 2)
    
    return 0.0


def get_exchange_rates_bulk(
    currencies: List[str],
    to_currency: str = "EGP"
) -> Dict[str, float]:
    """
    Get latest exchange rates for multiple currencies using Query Builder
    
    Args:
        currencies: List of currency codes
        to_currency: Target currency (default: EGP)
    
    Returns:
        Dict mapping currency to exchange rate:
        {"USD": 50.0, "EUR": 54.5, ...}
    """
    if not currencies:
        return {}
    
    CurrencyExchange = DocType("Currency Exchange")
    
    # Fetch all rates for these currencies, ordered by date desc
    query = (
        frappe.qb.from_(CurrencyExchange)
        .select(
            CurrencyExchange.from_currency,
            CurrencyExchange.exchange_rate,
            CurrencyExchange.date
        )
        .where(CurrencyExchange.from_currency.isin(currencies))
        .where(CurrencyExchange.to_currency == to_currency)
        .where(CurrencyExchange.for_selling == 1)
        .orderby(CurrencyExchange.date, order=frappe.qb.desc)
    )
    
    rows = query.run(as_dict=True)
    
    # Build result dict (first occurrence is latest due to sort)
    result = {}
    for row in rows:
        if row.from_currency not in result:
            result[row.from_currency] = flt(row.exchange_rate, 4)
    
    # Add default rate for target currency
    result[to_currency] = 1.0
    
    # Add fallback rates for missing currencies
    default_rates = {
        "USD": 50.0,
        "EUR": 54.5,
        "SAR": 13.3,
        "AED": 13.6,
        "GBP": 63.0,
    }
    
    for currency in currencies:
        if currency not in result:
            result[currency] = default_rates.get(currency, 1.0)
    
    return result


def get_accounts_by_type(
    account_type: str,
    company: Optional[str] = None,
    is_group: int = 0
) -> List[Dict]:
    """
    Get accounts filtered by account type using Query Builder
    
    Args:
        account_type: Account type (e.g., "Bank", "Cash", "Receivable")
        company: Optional company filter
        is_group: Filter by is_group (0 = leaf accounts)
    
    Returns:
        List of account dictionaries
    
    Example:
        bank_accounts = get_accounts_by_type(
            account_type="Bank",
            company="Apex Company",
            is_group=0
        )
    """
    Account = DocType("Account")
    
    query = (
        frappe.qb.from_(Account)
        .select(
            Account.name,
            Account.account_name,
            Account.account_currency,
            Account.account_type,
            Account.company
        )
        .where(Account.account_type == account_type)
        .where(Account.is_group == is_group)
        .where(Account.disabled == 0)
    )
    
    if company:
        query = query.where(Account.company == company)
    
    return query.orderby(Account.name).run(as_dict=True)
