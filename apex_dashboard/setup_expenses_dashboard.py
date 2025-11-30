import frappe

def execute():
    dashboard_name = "Expenses Dashboard"
    
    # Check if exists
    if not frappe.db.exists("Apex Dashboard", dashboard_name):
        doc = frappe.get_doc({
            "doctype": "Apex Dashboard",
            "title": dashboard_name,
            "category": "Finance", # Assuming Finance category exists
            "route": "expenses_dashboard",
            "icon": "fa fa-money",
            "color": "#ff4d4d",
            "dashboard_type": "Custom Page",
            "is_active": 1
        })
        doc.insert()
        print(f"Created {dashboard_name}")
    else:
        print(f"{dashboard_name} already exists")
        # Update it to ensure it's correct
        doc = frappe.get_doc("Apex Dashboard", dashboard_name)
        doc.dashboard_type = "Custom Page"
        doc.route = "expenses_dashboard"
        doc.save()
        print(f"Updated {dashboard_name}")

    frappe.db.commit()

if __name__ == "__main__":
    execute()
