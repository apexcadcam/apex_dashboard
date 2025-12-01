import frappe
import sys

def fix():
    # 1. Create Page Record for Expenses Dashboard
    if not frappe.db.exists("Page", "expenses_dashboard"):
        try:
            doc = frappe.get_doc({
                "doctype": "Page",
                "page_name": "expenses_dashboard",
                "title": "Expenses Dashboard",
                "module": "Apex Dashboard",
                "standard": "Yes",
                "roles": [{"role": "System Manager"}]
            })
            doc.insert(ignore_permissions=True)
            print("✅ Created Page: expenses_dashboard")
        except Exception as e:
            print(f"❌ Failed to create Page expenses_dashboard: {e}")
    else:
        print("ℹ️  Page expenses_dashboard already exists")

    # 2. Check Liquidity Dashboard Import
    try:
        from apex_dashboard.apex_dashboard.page.liquidity_dashboard import liquidity_dashboard
        print("✅ Successfully imported liquidity_dashboard module")
    except ImportError as e:
        print(f"❌ Failed to import liquidity_dashboard: {e}")
    except Exception as e:
        print(f"❌ Error importing liquidity_dashboard: {e}")

    # 3. Check Apex Dashboard Config
    try:
        config = frappe.get_single("Apex Dashboard Config")
        print(f"ℹ️  Apex Dashboard Config found: {config.name}")
        if not config.cards:
            print("⚠️  Apex Dashboard Config has no cards linked!")
    except Exception as e:
        print(f"❌ Failed to get Apex Dashboard Config: {e}")

if __name__ == "__main__":
    frappe.connect()
    fix()
