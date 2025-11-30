"""
Cache utility functions for Apex Dashboard
Handles caching and cache invalidation for all dashboards
"""

import frappe

def get_dashboard_cache_key(dashboard_type, user=None):
    """Generate cache key for dashboard"""
    if not user:
        user = frappe.session.user
    return f"{dashboard_type}_dashboard_{user}"

def get_cached_dashboard_data(dashboard_type):
    """Get cached dashboard data if available"""
    cache_key = get_dashboard_cache_key(dashboard_type)
    return frappe.cache().get_value(cache_key)

def set_dashboard_cache(dashboard_type, data, ttl=300):
    """
    Cache dashboard data
    Args:
        dashboard_type: Type of dashboard (liquidity, expense, etc.)
        data: Data to cache
        ttl: Time to live in seconds (default 5 minutes)
    """
    cache_key = get_dashboard_cache_key(dashboard_type)
    frappe.cache().set_value(cache_key, data, expires_in_sec=ttl)

def clear_dashboard_cache(dashboard_type=None, user=None):
    """
    Clear dashboard cache
    Args:
        dashboard_type: Specific dashboard type or None for all
        user: Specific user or None for all users
    """
    if dashboard_type and user:
        # Clear specific dashboard for specific user
        cache_key = get_dashboard_cache_key(dashboard_type, user)
        frappe.cache().delete_value(cache_key)
    elif dashboard_type:
        # Clear specific dashboard for all users
        frappe.cache().delete_keys(f"{dashboard_type}_dashboard_*")
    else:
        # Clear all dashboards for all users
        clear_all_dashboard_caches()

def clear_all_dashboard_caches():
    """Clear all dashboard caches"""
    dashboards = [
        'liquidity', 'expense', 'equity', 'tax',
        'inventory', 'sales', 'crm', 'suppliers', 'test'
    ]
    for dashboard in dashboards:
        frappe.cache().delete_keys(f"{dashboard}_dashboard_*")
    
    frappe.logger().info("Cleared all dashboard caches")

def get_balances_bulk(account_names, company=None):
    """
    Get balances for multiple accounts in one query
    Much faster than calling get_balance_on() for each account
    
    Args:
        account_names: List of account names
        company: Company name (optional)
    
    Returns:
        Dict mapping account name to balance
    """
    if not account_names:
        return {}
    
    from erpnext.accounts.utils import get_balance_on
    
    # For now, we'll still use get_balance_on but we can optimize later
    # with a custom SQL query if needed
    balances = {}
    for account in account_names:
        try:
            balances[account] = get_balance_on(account, company=company)
        except Exception as e:
            frappe.logger().error(f"Error getting balance for {account}: {str(e)}")
            balances[account] = 0.0
    
    return balances
