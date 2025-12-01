import frappe
from frappe import _

def setup_defaults():
    """Setup default categories and dashboards."""
    print("Setting up default Apex Dashboard data...")
    
    setup_categories()
    setup_core_dashboards()
    
    frappe.db.commit()
    print("✅ Default data setup complete!")

def setup_categories():
    categories = [
        {"category_name": "Finance", "icon": "fa fa-money", "color": "#10b981"},
        {"category_name": "Operations", "icon": "fa fa-cogs", "color": "#3b82f6"},
        {"category_name": "HR", "icon": "fa fa-users", "color": "#f59e0b"},
        {"category_name": "Sales", "icon": "fa fa-chart-line", "color": "#ef4444"},
        {"category_name": "Templates", "icon": "fa fa-copy", "color": "#6b7280"}
    ]
    
    for cat in categories:
        if not frappe.db.exists("Apex Dashboard Category", cat["category_name"]):
            doc = frappe.get_doc({
                "doctype": "Apex Dashboard Category",
                **cat
            })
            doc.insert(ignore_permissions=True)
            print(f"  + Created Category: {cat['category_name']}")

def setup_core_dashboards():
    dashboards = [
        {
            "name": "equity_dashboard",
            "title": "Equity Dashboard",
            "route": "equity_dashboard",
            "category": "Finance",
            "icon": "fa fa-balance-scale",
            "color": "#10b981",
            "dashboard_type": "Custom Page",
            "is_active": 1
        },
        {
            "name": "profitability_dashboard",
            "title": "Profitability Dashboard",
            "route": "profitability_dashboard",
            "category": "Finance",
            "icon": "fa fa-chart-bar",
            "color": "#3b82f6",
            "dashboard_type": "Custom Page",
            "is_active": 1
        },
        {
            "name": "liquidity_dashboard",
            "title": "Liquidity Dashboard",
            "route": "liquidity_dashboard",
            "category": "Finance",
            "icon": "fa fa-university",
            "color": "#f59e0b",
            "dashboard_type": "Custom Page",
            "is_active": 1
        },
        {
            "name": "expenses_dashboard",
            "title": "Expenses Dashboard",
            "route": "expenses_dashboard",
            "category": "Finance",
            "icon": "fa fa-credit-card",
            "color": "#ef4444",
            "dashboard_type": "Custom Page",
            "is_active": 1
        },
        {
            "name": "inventory_dashboard",
            "title": "Inventory Dashboard",
            "route": "inventory_dashboard",
            "category": "Operations",
            "icon": "fa fa-cubes",
            "color": "#8b5cf6",
            "dashboard_type": "Custom Page",
            "is_active": 1
        },
        {
            "name": "suppliers_dashboard",
            "title": "Suppliers Dashboard",
            "route": "suppliers_dashboard",
            "category": "Operations",
            "icon": "fa fa-truck",
            "color": "#ec4899",
            "dashboard_type": "Custom Page",
            "is_active": 1
        }
    ]
    
    for dash in dashboards:
        # Check by route to avoid duplicates
        existing = frappe.db.get_value("Apex Dashboard", {"route": dash["route"]}, "name")
        
        if not existing:
            doc = frappe.get_doc({
                "doctype": "Apex Dashboard",
                "title": dash["title"],
                "route": dash["route"],
                "category": dash["category"],
                "icon": dash.get("icon"),
                "color": dash.get("color"),
                "dashboard_type": dash["dashboard_type"],
                "is_active": dash["is_active"]
            })
            doc.insert(ignore_permissions=True)
            print(f"  + Created Dashboard: {dash['title']}")
        else:
            # Update existing to ensure correct config
            doc = frappe.get_doc("Apex Dashboard", existing)
            doc.title = dash["title"]
            doc.route = dash["route"]
            doc.category = dash["category"]
            doc.icon = dash.get("icon")
            doc.color = dash.get("color")
            doc.dashboard_type = dash["dashboard_type"]
            doc.is_active = dash["is_active"]
            doc.save(ignore_permissions=True)
            print(f"  * Updated Dashboard: {dash['title']}")

if __name__ == "__main__":
    frappe.connect()
    setup_defaults()
