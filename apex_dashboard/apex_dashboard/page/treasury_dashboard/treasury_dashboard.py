# -*- coding: utf-8 -*-
# Copyright (c) 2025, Gaber and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import today, flt
from erpnext.accounts.utils import get_balance_on

@frappe.whitelist()
def get_context(context):
    """Page context"""
    context.no_cache = 1
    return context

@frappe.whitelist()
def get_all_balances():
    """Get all financial balances including treasury, banks, and other accounts"""
    try:
        # Define account mappings
        treasury_accounts = get_treasury_accounts()
        bank_accounts = get_bank_accounts()
        other_accounts = get_other_accounts()
        
        # Get balances
        treasury_data = get_accounts_balance(treasury_accounts)
        banks_data = get_accounts_balance(bank_accounts)
        other_data = get_accounts_balance(other_accounts)
        
        return {
            'success': True,
            'treasury': treasury_data,
            'banks': banks_data,
            'other_accounts': other_data,
            'date': today()
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), 'Treasury Dashboard - Get All Balances Error')
        return {
            'success': False,
            'error': str(e)
        }

def get_treasury_accounts():
    """Get treasury account configurations"""
    
    # FIRST: Check for manually configured accounts via custom field
    manual_accounts = frappe.get_all(
        'Account',
        filters={
            'dashboard_category': 'Treasury',
            'is_group': 0,
            'disabled': 0
        },
        fields=['name', 'account_name', 'account_currency', 'dashboard_sort_order'],
        order_by='dashboard_sort_order asc, name asc'  # Sort by custom order, then alphabetically
    )
    
    if manual_accounts:
        return manual_accounts
    
    # FALLBACK: Auto-detect based on account type (existing logic)
    # Accounts to exclude from treasury
    exclude_accounts = [
        'Employee Custody',
        'Cash'
    ]
    
    # Get all Cash type accounts that don't have a dashboard category set
    all_cash_accounts = frappe.get_all(
        'Account',
        filters={
            'account_type': 'Cash',
            'is_group': 0,
            'disabled': 0,
            'dashboard_category': ['in', ['', None]]  # Only auto-detect if not manually set
        },
        fields=['name', 'account_name', 'account_currency', 'dashboard_sort_order'],
        order_by='dashboard_sort_order asc, name asc'  # Sort by custom order
    )
    
    # Filter out excluded accounts
    accounts = []
    for acc in all_cash_accounts:
        # Check if account name contains any excluded keyword
        excluded = False
        for exclude in exclude_accounts:
            if exclude.lower() in acc['name'].lower() or exclude.lower() in (acc['account_name'] or '').lower():
                excluded = True
                break
        
        if not excluded:
            accounts.append(acc)
    
    return accounts

def get_bank_accounts():
    """Get bank account configurations including CIB accounts"""
    
    # FIRST: Check for manually configured accounts via custom field
    manual_accounts = frappe.get_all(
        'Account',
        filters={
            'dashboard_category': 'Bank',
            'is_group': 0,
            'disabled': 0
        },
        fields=['name', 'account_name', 'account_currency', 'dashboard_sort_order'],
        order_by='dashboard_sort_order asc, name asc'  # Sort by custom order, then alphabetically
    )
    
    if manual_accounts:
        return manual_accounts
    
    # FALLBACK: Auto-detect based on account type (existing logic)
    bank_accounts = []
    
    # Keywords to exclude from banks (moved to other accounts)
    exclude_keywords = [
        'Notes Receivable',
        'Notes Payable',
        'Outstanding Cheques',
        'Employee Custody'
    ]
    
    # Standard Bank accounts that don't have a dashboard category set
    all_bank_accounts = frappe.get_all(
        'Account',
        filters={
            'account_type': 'Bank',
            'is_group': 0,
            'disabled': 0,
            'dashboard_category': ['in', ['', None]]  # Only auto-detect if not manually set
        },
        fields=['name', 'account_name', 'account_currency', 'dashboard_sort_order'],
        order_by='dashboard_sort_order asc, name asc'  # Sort by custom order
    )
    
    # Filter out excluded accounts
    for acc in all_bank_accounts:
        excluded = False
        for keyword in exclude_keywords:
            if keyword.lower() in acc['name'].lower() or keyword.lower() in (acc['account_name'] or '').lower():
                excluded = True
                break
        
        if not excluded:
            bank_accounts.append(acc)
    
    # Additional CIB Credit accounts (only if not manually categorized)
    cib_accounts = [
        '2203005001 - CIB - Credit Overdraft - MG - AP',
        '1202003005002 - CIB - EGP - Credit Cards - SS - AP',
        '2203005002 - CIB - Credit Overdraft - SS - AP',
        'CIB - EGP - Credit Cards - MG - AP'
    ]
    
    for acc_name in cib_accounts:
        if frappe.db.exists('Account', acc_name):
            acc_doc = frappe.get_doc('Account', acc_name)
            # Only add if not manually categorized elsewhere
            if not acc_doc.get('dashboard_category'):
                bank_accounts.append({
                    'name': acc_doc.name,
                    'account_name': acc_doc.account_name,
                    'account_currency': acc_doc.account_currency or 'EGP'
                })
    
    return bank_accounts

def get_other_accounts():
    """Get other financial accounts (Notes, Custody, Outstanding Cheques, etc.)"""
    
    # FIRST: Check for manually configured accounts via custom field
    manual_accounts = frappe.get_all(
        'Account',
        filters={
            'dashboard_category': 'Other Accounts',
            'is_group': 0,
            'disabled': 0
        },
        fields=['name', 'account_name', 'account_currency', 'dashboard_sort_order'],
        order_by='dashboard_sort_order asc, name asc'  # Sort by custom order, then alphabetically
    )
    
    if manual_accounts:
        return manual_accounts
    
    # FALLBACK: Auto-detect based on keywords (existing logic)
    other_accounts = []
    
    # Keywords to include in other accounts
    include_keywords = [
        'Notes Receivable',
        'Notes Payable',
        'Outstanding Cheques',
        'Employee Custody'
    ]
    
    # Search in both Bank and Cash accounts for these keywords (only if not manually categorized)
    all_accounts = frappe.get_all(
        'Account',
        filters={
            'account_type': ['in', ['Bank', 'Cash', 'Receivable', 'Payable']],
            'is_group': 0,
            'disabled': 0,
            'dashboard_category': ['in', ['', None]]  # Only auto-detect if not manually set
        },
        fields=['name', 'account_name', 'account_currency', 'dashboard_sort_order'],
        order_by='dashboard_sort_order asc, name asc'  # Sort by custom order
    )
    
    for acc in all_accounts:
        for keyword in include_keywords:
            if keyword.lower() in acc['name'].lower() or keyword.lower() in (acc['account_name'] or '').lower():
                other_accounts.append({
                    'name': acc['name'],
                    'account_name': acc.get('account_name', acc['name']),
                    'account_currency': acc.get('account_currency') or 'EGP'
                })
                break
    
    return other_accounts

def get_exchange_rate(currency):
    """Get LIVE exchange rate for currency to EGP"""
    if currency == 'EGP':
        return 1.0
    
    # FIRST: Try to get LIVE rate from Apex Customization's API function
    try:
        from apex_customization.apex_customization.utils.balance_utils import get_live_exchange_rate_from_api
        live_rate = get_live_exchange_rate_from_api(currency, 'EGP')
        if live_rate:
            return flt(live_rate, 2)
    except Exception as e:
        frappe.log_error(f"Failed to get live rate for {currency}: {str(e)}", "Apex Dashboard - Live Rate Error")
    
    # SECOND: Try to get from Currency Exchange table
    try:
        rate = frappe.db.get_value(
            'Currency Exchange',
            {'from_currency': currency, 'to_currency': 'EGP'},
            'exchange_rate'
        )
        if rate:
            return flt(rate, 2)
    except:
        pass
    
    # THIRD: Fallback rates (emergency only)
    default_rates = {
        'USD': 50.0,
        'EUR': 54.5,
        'SAR': 13.3,
        'AED': 13.6,
        'GBP': 63.0
    }
    
    return default_rates.get(currency, 1.0)

def get_accounts_balance(accounts):
    """Get balance for list of accounts"""
    result = {
        'accounts': [],
        'total_egp': 0,
        'by_currency': {}
    }
    
    for acc in accounts:
        try:
            balance = get_balance_on(acc['name'], today())
            currency = acc.get('account_currency') or 'EGP'
            
            # Get exchange rate
            exchange_rate = get_exchange_rate(currency)
            balance_in_egp = flt(balance * exchange_rate, 2)
            
            account_data = {
                'account': acc['name'],
                'account_name': acc.get('account_name', acc['name']),
                'balance': flt(balance, 2),
                'currency': currency,
                'exchange_rate': exchange_rate,
                'balance_in_egp': balance_in_egp
            }
            
            result['accounts'].append(account_data)
            
            # Group by currency
            if currency not in result['by_currency']:
                result['by_currency'][currency] = {
                    'total': 0,
                    'accounts': []
                }
            
            result['by_currency'][currency]['total'] += flt(balance, 2)
            result['by_currency'][currency]['accounts'].append(account_data)
            
            # Add to total EGP
            result['total_egp'] += balance_in_egp
                
        except Exception as e:
            frappe.log_error(f"Error getting balance for {acc['name']}: {str(e)}")
            continue
    
    return result
