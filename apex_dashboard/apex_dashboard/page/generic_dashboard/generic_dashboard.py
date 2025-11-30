import frappe
from frappe.utils import flt

@frappe.whitelist()
def get_dashboard_config(dashboard_name):
    """Get dashboard configuration by name or route"""
    try:
        # Try to find by route first
        dashboard = frappe.get_all(
            "Apex Dashboard",
            filters={"route": dashboard_name, "is_active": 1},
            fields=["name", "title", "category", "route", "icon"],
            limit=1
        )
        
        if not dashboard:
            # Try to find by name
            dashboard = frappe.get_all(
                "Apex Dashboard",
                filters={"name": dashboard_name, "is_active": 1},
                fields=["name", "title", "category", "route", "icon"],
                limit=1
            )
        
        if not dashboard:
            frappe.throw(f"Dashboard '{dashboard_name}' not found or inactive")
        
        dash = dashboard[0]
        
        # Get cards for this category
        cards = get_cards_for_category(dash['category'])
        
        # Return dashboard config with cards
        return {
            "name": dash['name'],
            "title": dash['title'],
            "category": dash['category'],
            "route": dash['route'],
            "icon": dash['icon'],
            "cards": cards
        }
            
    except Exception as e:
        frappe.log_error(f"Error loading dashboard: {str(e)}")
        frappe.throw(str(e))


def get_cards_for_category(category):
    """Get all cards for a specific category from Config"""
    
    # Get config
    config = frappe.get_single("Apex Dashboard Config")
    
    cards_data = []
    
    for row in config.cards:
        # Get card details
        card = frappe.get_doc("Apex Dashboard Card", row.card)
        
        # Check if card matches category and is active
        if card.category != category or not card.is_active:
            continue
        
        # Get card value based on source
        value = 0
        description = ""
        
        if row.card_source == "Static Value":
            value = flt(row.static_value)
            description = "Static Value"
            
        elif row.card_source == "Chart of Accounts" and row.account:
            # Get account balance
            account_balance = get_account_balance(row.account)
            value = account_balance
            description = row.account
        
        # Add card data
        cards_data.append({
            "label": card.card_title,
            "value": f"{value:,.2f} EGP",
            "color": card.color or "#007aff",
            "description": description
        })
    
    return cards_data


def get_account_balance(account):
    """Get account balance from GL Entry"""
    
    # Get account balance
    balance = frappe.db.sql("""
        SELECT 
            SUM(debit) - SUM(credit) as balance
        FROM `tabGL Entry`
        WHERE account = %s
            AND is_cancelled = 0
    """, (account,), as_dict=1)
    
    if balance and balance[0]:
        return flt(balance[0].balance)
    
    return 0.0
