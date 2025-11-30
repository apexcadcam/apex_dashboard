import frappe

def execute():
    # Find the dashboard entry for Expenses
    # The name in DB is "Expenses" based on previous query
    dashboard_name = "Expenses"
    
    if frappe.db.exists("Apex Dashboard", dashboard_name):
        doc = frappe.get_doc("Apex Dashboard", dashboard_name)
        doc.route = "expenses_dashboard" # The new plural route
        doc.dashboard_type = "Custom Page"
        doc.save()
        frappe.db.commit()
        print(f"Updated {dashboard_name} route to expenses_dashboard")
    else:
        print(f"Dashboard {dashboard_name} not found. Creating new one.")
        doc = frappe.get_doc({
            "doctype": "Apex Dashboard",
            "title": "Expenses Dashboard",
            "category": "Finance",
            "route": "expenses_dashboard",
            "icon": "fa fa-money",
            "color": "#ff4d4d",
            "dashboard_type": "Custom Page",
            "is_active": 1
        })
        doc.insert()
        frappe.db.commit()
        print("Created Expenses Dashboard")

if __name__ == "__main__":
    execute()
