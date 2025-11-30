#!/usr/bin/env python3
"""
Add caching to all remaining dashboards
Applies the same optimization as Liquidity and Expense dashboards
"""

import os
from pathlib import Path

def add_caching_to_dashboard(dashboard_path, dashboard_name):
    """Add caching to a dashboard Python file"""
    
    if not dashboard_path.exists():
        print(f"⚠ {dashboard_name} not found")
        return False
    
    with open(dashboard_path, 'r') as f:
        content = f.read()
    
    # Check if already has caching
    if 'cache_key' in content and 'frappe.cache()' in content:
        print(f"✓ {dashboard_name} already has caching")
        return False
    
    lines = content.split('\n')
    new_lines = []
    
    for i, line in enumerate(lines):
        new_lines.append(line)
        
        # Add cache check after function definition
        if 'def get_dashboard_data(company=None' in line:
            # Find next non-comment, non-docstring line
            j = i + 1
            while j < len(lines) and (lines[j].strip().startswith('#') or lines[j].strip().startswith('"""') or lines[j].strip().startswith("'''") or lines[j].strip() == ''):
                new_lines.append(lines[j])
                j += 1
            
            # Add cache check
            new_lines.append('    # Check cache first')
            new_lines.append('    cache_key = f"' + dashboard_name + '_{company}_{period}_{from_date}_{to_date}"')
            new_lines.append('    cached_data = frappe.cache().get_value(cache_key)')
            new_lines.append('    if cached_data:')
            new_lines.append('        return cached_data')
            new_lines.append('    ')
            
            # Skip lines we already added
            while i < j - 1:
                i += 1
                if i < len(lines):
                    lines[i] = None  # Mark as processed
        
        # Add cache store before return
        if line.strip().startswith('return {') and i > 0:
            # Find the complete return statement
            indent = len(line) - len(line.lstrip())
            new_lines.insert(-1, ' ' * indent + '# Cache for 5 minutes')
            new_lines.insert(-1, ' ' * indent + 'frappe.cache().set_value(cache_key, data, expires_in_sec=300)')
            new_lines.insert(-1, ' ' * indent + '')
            # Change return { to data = {
            new_lines[-1] = new_lines[-1].replace('return {', 'data = {')
            # Need to add return data at the end
    
    # Filter None and add final return
    new_lines = [line for line in new_lines if line is not None]
    
    # Find last closing brace of data dict and add return
    for i in range(len(new_lines) - 1, -1, -1):
        if new_lines[i].strip() == '}':
            indent = len(new_lines[i]) - len(new_lines[i].lstrip())
            new_lines.insert(i + 1, '')
            new_lines.insert(i + 2, ' ' * indent + 'return data')
            break
    
    # Write back
    new_content = '\n'.join(new_lines)
    with open(dashboard_path, 'w') as f:
        f.write(new_content)
    
    print(f"✓ Added caching to {dashboard_name}")
    return True

def main():
    base_path = Path("/home/frappe/frappe-bench/apps/apex_dashboard/apex_dashboard/apex_dashboard/page")
    
    dashboards = {
        'equity': base_path / 'equity_dashboard' / 'equity_dashboard.py',
        'sales': base_path / 'sales_dashboard' / 'sales_dashboard.py',
        'crm': base_path / 'crm_dashboard' / 'crm_dashboard.py',
        'tax': base_path / 'tax_dashboard' / 'tax_dashboard.py',
        'inventory': base_path / 'inventory_dashboard' / 'inventory_dashboard.py',
        'suppliers': base_path / 'suppliers_dashboard' / 'suppliers_dashboard.py',
        'test': base_path / 'test_dashboard' / 'test_dashboard.py',
    }
    
    print("="*70)
    print("ADDING CACHING TO REMAINING DASHBOARDS")
    print("="*70)
    print()
    
    updated = 0
    for name, path in dashboards.items():
        if add_caching_to_dashboard(path, name):
            updated += 1
    
    print()
    print("="*70)
    print(f"✓ Updated {updated} dashboards with caching")
    print("="*70)
    print()
    print("Next step: bench restart")

if __name__ == "__main__":
    main()
