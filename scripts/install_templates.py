#!/usr/bin/env python3
"""
Install Template Dashboards to Database
Creates Apex Dashboard records for all 20 templates
"""

import frappe
from frappe import _

def install_templates():
    """Install all 20 template dashboards"""
    
    print("="*70)
    print("INSTALLING TEMPLATE DASHBOARDS TO DATABASE")
    print("="*70)
    print()
    
    # Create Templates category if doesn't exist
    if not frappe.db.exists("Apex Dashboard Category", "Templates"):
        cat = frappe.get_doc({
            "doctype": "Apex Dashboard Category",
            "category_name": "Templates",
            "description": "Template dashboards for activation"
        })
        cat.insert()
        print("✓ Created 'Templates' category")
    
    created = 0
    skipped = 0
    
    for i in range(1, 21):
        route = f"template_dashboard_{i:02d}"
        title = f"Template Dashboard {i:02d}"
        
        # Check if already exists
        if frappe.db.exists("Apex Dashboard", route):
            print(f"⊙ Skipped: {route} (already exists)")
            skipped += 1
            continue
        
        # Create dashboard record
        try:
            doc = frappe.get_doc({
                "doctype": "Apex Dashboard",
                "name": route,
                "title": title,
                "route": route,
                "category": "Templates",
                "dashboard_type": "Custom Page",
                "is_active": 0,  # Inactive by default
                "is_template": 1  # Mark as template
            })
            doc.insert()
            created += 1
            print(f"✓ Created: {route}")
        except Exception as e:
            print(f"✗ Error creating {route}: {str(e)}")
    
    frappe.db.commit()
    
    print()
    print("="*70)
    print(f"✅ INSTALLATION COMPLETE!")
    print("="*70)
    print(f"Created: {created} templates")
    print(f"Skipped: {skipped} (already exist)")
    print()
    print("Next steps:")
    print("1. Run: bench migrate")
    print("2. Run: bench clear-cache && bench restart")
    print("3. Go to Apex Dashboard → Filter: Templates")
    print("4. Activate any template!")

if __name__ == "__main__":
    # Initialize Frappe
    import sys
    sys.path.insert(0, "/home/frappe/frappe-bench/apps/frappe")
    sys.path.insert(0, "/home/frappe/frappe-bench/apps/erpnext")
    
    import frappe
    frappe.init(site="site1")
    frappe.connect()
    
    install_templates()
    
    frappe.destroy()
