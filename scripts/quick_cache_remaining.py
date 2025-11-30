#!/usr/bin/env python3
"""
Quick script to add caching to Inventory, Suppliers, and Test dashboards
"""

import re
from pathlib import Path

def add_caching(file_path, dashboard_name):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Check if already has caching
    if 'cache_key' in content:
        print(f"✓ {dashboard_name} already has caching")
        return False
    
    # Add cache check after function definition
    pattern = r'(@frappe\.whitelist\(\)\ndef get_dashboard_data\(.*?\):\n)(    if not company:)'
    replacement = r'\1    # Check cache first\n    cache_key = f"' + dashboard_name + r'_{company}_{period}_{from_date}_{to_date}"\n    cached_data = frappe.cache().get_value(cache_key)\n    if cached_data:\n        return cached_data\n    \n\2'
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    # Change return { to data = { and add caching before return
    pattern = r'(    # Convert dict to list and sort by total\n    category_list = list\(categories\.values\(\)\)\n    category_list\.sort\(key=lambda x: abs\(x\["total"\]\), reverse=True\)\n\n)(    return \{)'
    replacement = r'\1    data = {'
    content = re.sub(pattern, replacement, content)
    
    # Add cache store and return after closing brace
    pattern = r'(        \}\n    \})\n\ndef get_period_dates'
    replacement = r'\1\n    \n    # Cache for 5 minutes\n    frappe.cache().set_value(cache_key, data, expires_in_sec=300)\n    \n    return data\n\ndef get_period_dates'
    content = re.sub(pattern, replacement, content)
    
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"✓ Added caching to {dashboard_name}")
    return True

# Add caching to remaining dashboards
dashboards = [
    ('/home/frappe/frappe-bench/apps/apex_dashboard/apex_dashboard/apex_dashboard/page/inventory_dashboard/inventory_dashboard.py', 'inventory'),
    ('/home/frappe/frappe-bench/apps/apex_dashboard/apex_dashboard/apex_dashboard/page/suppliers_dashboard/suppliers_dashboard.py', 'suppliers'),
    ('/home/frappe/frappe-bench/apps/apex_dashboard/apex_dashboard/apex_dashboard/page/test_dashboard/test_dashboard.py', 'test'),
]

print("="*70)
print("ADDING CACHING TO REMAINING DASHBOARDS")
print("="*70)
print()

for path, name in dashboards:
    if Path(path).exists():
        add_caching(path, name)
    else:
        print(f"⚠ {name} not found")

print()
print("="*70)
print("✅ CACHING COMPLETE!")
print("="*70)
