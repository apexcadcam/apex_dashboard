#!/usr/bin/env python3
"""
Script to add caching to all dashboard Python files
"""

import os
from pathlib import Path

def add_caching_to_dashboard(dashboard_path, dashboard_name):
    """Add caching logic to a dashboard file"""
    
    with open(dashboard_path, 'r') as f:
        content = f.read()
    
    # Check if already has caching
    if 'get_cached_dashboard_data' in content:
        print(f"✓ {dashboard_name} already has caching")
        return False
    
    # Find the @frappe.whitelist() decorator and function
    lines = content.split('\n')
    new_lines = []
    added_cache_check = False
    added_cache_store = False
    
    for i, line in enumerate(lines):
        new_lines.append(line)
        
        # Add cache check after function definition
        if not added_cache_check and line.strip().startswith('def get_dashboard_data('):
            # Add cache import and check after the function signature
            # Find the docstring end or first real line
            j = i + 1
            while j < len(lines) and (lines[j].strip().startswith('"""') or lines[j].strip().startswith("'''") or lines[j].strip() == ''):
                new_lines.append(lines[j])
                j += 1
            
            # Add cache check
            new_lines.append('    # Check cache first')
            new_lines.append('    from apex_dashboard.cache_utils import get_cached_dashboard_data, set_dashboard_cache')
            new_lines.append('    ')
            new_lines.append(f'    cached_data = get_cached_dashboard_data(\'{dashboard_name}\')')
            new_lines.append('    if cached_data:')
            new_lines.append('        return cached_data')
            new_lines.append('    ')
            
            added_cache_check = True
            # Skip the lines we already added
            for k in range(i + 1, j):
                lines[k] = None  # Mark as processed
        
        # Add cache store before return statement
        if not added_cache_store and line.strip().startswith('return ') and 'data' in line:
            # Add cache store before return
            indent = len(line) - len(line.lstrip())
            new_lines.insert(-1, ' ' * indent + f'# Cache the result for 5 minutes')
            new_lines.insert(-1, ' ' * indent + f'set_dashboard_cache(\'{dashboard_name}\', data, ttl=300)')
            new_lines.insert(-1, ' ' * indent + '')
            added_cache_store = True
    
    # Filter out None lines
    new_lines = [line for line in new_lines if line is not None]
    
    # Write back
    new_content = '\n'.join(new_lines)
    with open(dashboard_path, 'w') as f:
        f.write(new_content)
    
    print(f"✓ Added caching to {dashboard_name}")
    return True

def main():
    base_path = Path("/home/frappe/frappe-bench/apps/apex_dashboard/apex_dashboard/apex_dashboard/page")
    
    dashboards = {
        'expense': 'expense_dashboard/expense_dashboard.py',
        'equity': 'equity_dashboard/equity_dashboard.py',
        'tax': 'tax_dashboard/tax_dashboard.py',
        'inventory': 'inventory_dashboard/inventory_dashboard.py',
        'sales': 'sales_dashboard/sales_dashboard.py',
        'crm': 'crm_dashboard/crm_dashboard.py',
        'suppliers': 'suppliers_dashboard/suppliers_dashboard.py',
        'test': 'test_dashboard/test_dashboard.py',
    }
    
    print("="*70)
    print("ADDING CACHING TO DASHBOARDS")
    print("="*70)
    print()
    
    updated = 0
    for name, path in dashboards.items():
        full_path = base_path / path
        if full_path.exists():
            if add_caching_to_dashboard(full_path, name):
                updated += 1
        else:
            print(f"⚠ {name} not found at {full_path}")
    
    print()
    print("="*70)
    print(f"✓ Updated {updated} dashboards with caching")
    print("="*70)

if __name__ == "__main__":
    main()
