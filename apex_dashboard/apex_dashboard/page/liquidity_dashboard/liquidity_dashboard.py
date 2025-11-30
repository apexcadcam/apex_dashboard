import frappe
from frappe import _
import requests
import json
from frappe.utils import flt, nowdate, add_days
from erpnext.accounts.utils import get_balance_on

def get_context(context):
    context.no_cache = 1

@frappe.whitelist()
def get_dashboard_data():
    """
    Get liquidity dashboard data with account grouping and live exchange rates.
    Data is cached for 5 minutes for better performance.
    
    Returns:
        dict: Dashboard data containing:
            - groups (list): List of account groups with balances
            - total_liquidity (float): Total liquidity in base currency
            - metrics (dict): Calculated metrics (largest bank, foreign currency stats, etc.)
            - last_updated (str): Timestamp of last update
    
    Example:
        frappe.call({
            method: "apex_dashboard.apex_dashboard.page.liquidity_dashboard.liquidity_dashboard.get_dashboard_data",
            callback: function(r) {
                console.log("Total Liquidity:", r.message.total_liquidity);
                console.log("Groups:", r.message.groups);
            }
        })
    """
    # Check cache first
    from apex_dashboard.cache_utils import get_cached_dashboard_data, set_dashboard_cache
    
    cached_data = get_cached_dashboard_data('liquidity')
    if cached_data:
        return cached_data
    
    # 1. Get Settings & Config
    config = frappe.get_single("Apex Dashboard Config")
    
    # 2. Get Rates
    api_key = config.api_key
    rates = get_exchange_rates(api_key)
    
    data = {
        "groups": [],
        "total_liquidity": 0.0,
        "last_updated": frappe.utils.now()
    }

    # 3. Fetch Cards from Config Table
    # We need to filter by category 'Liquidity'. 
    # Since 'cards' is a child table, we iterate and check the linked card's category.
    
    if not config.cards:
        return data

    # Optimize: Fetch all cards in one query instead of loop with get_doc()
    card_names = [row.card for row in config.cards]
    if not card_names:
        return data
    
    cards = frappe.get_all("Apex Dashboard Card",
        filters={
            "name": ["in", card_names],
            "category": "Liquidity",
            "is_active": 1
        },
        fields=["name", "card_title", "color", "width", "icon"]
    )
    
    # Create lookup dict for fast access
    card_map = {card["name"]: card for card in cards}
    
    for row in config.cards:
        # Skip if card not in filtered results
        if row.card not in card_map:
            continue
        
        card_doc = card_map[row.card]

        group_data = {
            "name": card_doc["card_title"],
            "total_egp": 0.0,
            "accounts": [],
            "color": card_doc["color"],
            "width": card_doc["width"],
            "icon": card_doc["icon"]
        }

        # Handle Static Value
        if row.card_source == "Static Value":
            static_val = flt(row.static_value)
            group_data["total_egp"] = static_val
            group_data["accounts"].append({
                "name": "Manual Entry",
                "currency": config.default_currency or "EGP",
                "balance": static_val,
                "rate": 1.0,
                "balance_egp": static_val
            })

        # Handle Chart of Accounts
        elif row.card_source == "Chart of Accounts" and row.account:
             if not frappe.db.exists("Account", row.account):
                continue
                
             account_doc = frappe.get_doc("Account", row.account)
             
             # Fetch Leaf Accounts
             leaf_accounts = []
             if account_doc.is_group:
                 leaf_accounts = frappe.db.get_all("Account", filters={
                     "lft": [">", account_doc.lft],
                     "rgt": ["<", account_doc.rgt],
                     "is_group": 0,
                     "company": account_doc.company
                 }, fields=["name", "account_currency", "account_name", "dashboard_label"])
             else:
                 leaf_accounts = [{"name": row.account, "account_currency": account_doc.account_currency, "account_name": account_doc.account_name, "dashboard_label": account_doc.dashboard_label}]
                 
             # Calculate Balances - Optimized bulk fetch
             from apex_dashboard.cache_utils import get_balances_bulk
             account_names = [leaf["name"] for leaf in leaf_accounts]
             balances = get_balances_bulk(account_names, company=account_doc.company)
             
             for leaf in leaf_accounts:
                 balance = balances.get(leaf["name"], 0)
                 
                 currency = leaf["account_currency"]
                 rate = rates.get(currency, 1.0)
                 if currency == "EGP":
                     rate = 1.0
                     
                 balance_egp = flt(balance) * flt(rate)
                 
                 group_data["accounts"].append({
                     "name": leaf.get("dashboard_label") or leaf["account_name"],
                     "currency": currency,
                     "balance": balance,
                     "rate": rate,
                     "balance_egp": balance_egp
                 })
                 
                 group_data["total_egp"] += balance_egp

        # Add group if it has data
        if group_data["accounts"] or group_data["total_egp"] != 0:
            data["groups"].append(group_data)
            data["total_liquidity"] += group_data["total_egp"]

    # Sort by Total EGP descending
    data["groups"].sort(key=lambda x: x["total_egp"], reverse=True)
    
    # Calculate Metrics for Dashboard
    metrics = calculate_metrics(data["groups"], data["total_liquidity"])
    data["metrics"] = metrics
    
    # Cache the result for 5 minutes
    set_dashboard_cache('liquidity', data, ttl=300)
    
    return data

def get_exchange_rates(api_key):
    """
    Fetches exchange rates from OpenExchangeRates or cache.
    """
    cache_key = "liquidity_dashboard_rates"
    cached_rates = frappe.cache().get_value(cache_key)
    
    if cached_rates:
        return cached_rates
        
    if not api_key:
        return get_erpnext_rates()

    try:
        url = f"https://openexchangerates.org/api/latest.json?app_id={api_key}&base=USD"
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        # Convert to EGP base
        if "EGP" not in data["rates"]:
             return get_erpnext_rates()

        usd_to_egp = data["rates"]["EGP"]
        rates = {}
        for currency, rate_in_usd in data["rates"].items():
            # 1 USD = X EGP
            # 1 Currency = (1/rate_in_usd) USD = (1/rate_in_usd) * usd_to_egp EGP
            if currency == "USD":
                rates[currency] = usd_to_egp
            else:
                if rate_in_usd > 0:
                    rates[currency] = usd_to_egp / rate_in_usd
                else:
                    rates[currency] = 0.0
                    
        frappe.cache().set_value(cache_key, rates, expires_in_sec=3600) # Cache for 1 hour
        return rates
    except Exception as e:
        frappe.log_error(f"OpenExchangeRates Error: {str(e)}")
        return get_erpnext_rates()

def get_erpnext_rates():
    """
    Fallback to fetch rates from Currency Exchange in ERPNext.
    """
    rates = {}
    currencies = frappe.db.get_all("Currency", pluck="name")
    for currency in currencies:
        if currency == "EGP":
            rates[currency] = 1.0
            continue
            
        rate = frappe.utils.get_exchange_rate(currency, "EGP")
        rates[currency] = rate
    return rates

def calculate_metrics(groups, total_liquidity):
    """
    Calculate key metrics for dashboard.
    """
    if not groups or total_liquidity == 0:
        return {
            "total_liquidity": 0,
            "largest_bank": {"name": "N/A", "amount": 0, "percentage": 0},
            "foreign_currency": {"percentage": 0, "amount": 0, "count": 0},
            "bank_count": {"total": 0, "active": 0},
            "chart_data": {"series": [], "labels": [], "colors": []}
        }
    
    # Find largest bank
    largest = max(groups, key=lambda x: x["total_egp"])
    largest_bank = {
        "name": largest["name"],
        "amount": largest["total_egp"],
        "percentage": round((largest["total_egp"] / total_liquidity * 100), 2) if total_liquidity > 0 else 0
    }
    
    # Calculate foreign currency stats
    foreign_amount = 0
    foreign_currencies = set()
    
    for group in groups:
        for account in group.get("accounts", []):
            currency = account.get("currency", "EGP")
            if currency != "EGP":
                foreign_amount += account.get("balance_egp", 0)
                foreign_currencies.add(currency)
    
    foreign_currency = {
        "percentage": round((foreign_amount / total_liquidity * 100), 2) if total_liquidity > 0 else 0,
        "amount": foreign_amount,
        "count": len(foreign_currencies)
    }
    
    # Bank count
    bank_count = {
        "total": len(groups),
        "active": len(groups)  # All groups in list are active
    }
    
    # Chart data
    chart_data = {
        "series": [round(group["total_egp"], 2) for group in groups],
        "labels": [group["name"] for group in groups],
        "colors": [group.get("color", "#3b82f6") for group in groups]
    }
    
    return {
        "total_liquidity": round(total_liquidity, 2),
        "largest_bank": largest_bank,
        "foreign_currency": foreign_currency,
        "bank_count": bank_count,
        "chart_data": chart_data
    }
