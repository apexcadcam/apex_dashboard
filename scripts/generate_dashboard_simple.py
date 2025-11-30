#!/usr/bin/env python3
"""
Dashboard Generator - Simple Version
Generates all necessary files for a new Custom Page Dashboard

Usage:
    python3 generate_dashboard_simple.py <dashboard_route> <dashboard_title> <category>
    
Example:
    python3 generate_dashboard_simple.py revenue_dashboard "Revenue Dashboard" Revenue
"""

import os
import sys
from pathlib import Path

def generate_dashboard_files(route, title, category):
    """Generate all dashboard files"""
    
    base_path = Path("/home/frappe/frappe-bench/apps/apex_dashboard/apex_dashboard/apex_dashboard/page")
    dashboard_path = base_path / route
    
    print("="*70)
    print(f"GENERATING DASHBOARD: {title}")
    print("="*70)
    print(f"Route: {route}")
    print(f"Title: {title}")
    print(f"Category: {category}")
    print(f"Path: {dashboard_path}")
    print()
    
    # Check if exists
    if dashboard_path.exists():
        print(f"❌ Error: Dashboard already exists at {dashboard_path}")
        return False
    
    # Create directory
    dashboard_path.mkdir(parents=True, exist_ok=True)
    print(f"✓ Created directory: {dashboard_path}")
    
    # Generate Python file
    py_content = f'''import frappe
from frappe import _
from frappe.utils import flt, getdate, add_months, add_days, get_first_day, get_last_day, today

@frappe.whitelist()
def get_dashboard_data(company=None, period="This Month", from_date=None, to_date=None):
    # Check cache first
    cache_key = f"{route}_{{company}}_{{period}}_{{from_date}}_{{to_date}}"
    cached_data = frappe.cache().get_value(cache_key)
    if cached_data:
        return cached_data
    
    if not company:
        company = frappe.defaults.get_user_default("Company")

    # Use custom dates if provided, otherwise calculate from period
    if period == "Custom" and from_date and to_date:
        from_date = getdate(from_date)
        to_date = getdate(to_date)
    else:
        from_date, to_date = get_period_dates(period)
    
    # Get Company Currency
    currency = frappe.get_value("Company", company, "default_currency")

    # Fetch Config
    config = frappe.get_single("Apex Dashboard Config")
    
    categories = {{}}
    total = 0.0
    
    # Fetch all relevant GL entries once (Optimization)
    gl_entries = frappe.db.sql("""
        SELECT account, debit, credit
        FROM `tabGL Entry`
        WHERE company = %s 
            AND posting_date BETWEEN %s AND %s 
            AND is_cancelled = 0
    """, (company, from_date, to_date), as_dict=1)

    if config.cards:
        for row in config.cards:
            # Fetch linked visual card details
            card_doc = frappe.get_doc("Apex Dashboard Card", row.card)
            
            if card_doc.category != "{category}" or not card_doc.is_active:
                continue

            if row.card_source == "Static Value":
                static_value = flt(row.static_value)
                
                if card_doc.card_title in categories:
                    categories[card_doc.card_title]['total'] += static_value
                else:
                    categories[card_doc.card_title] = {{
                        'name': card_doc.card_title,
                        'total': static_value,
                        'color': card_doc.color,
                        'accounts': []
                    }}
                total += static_value

            elif row.card_source == "Chart of Accounts" and row.account:
                parent_account = row.account
                
                if not parent_account:
                    continue

                if frappe.db.exists("Account", parent_account):
                    parent_lft, parent_rgt = frappe.db.get_value("Account", parent_account, ["lft", "rgt"])
                    
                    child_accounts = frappe.db.sql("""
                        SELECT name, account_name 
                        FROM `tabAccount` 
                        WHERE lft >= %s AND rgt <= %s AND is_group = 0 AND docstatus = 0
                    """, (parent_lft, parent_rgt), as_dict=1)
                    
                    card_total = 0.0
                    account_details = []
                    
                    for account in child_accounts:
                        account_gl_entries = [
                            gl for gl in gl_entries 
                            if gl.account == account['name']
                        ]
                        
                        balance = sum(gl['debit'] - gl['credit'] for gl in account_gl_entries) if account_gl_entries else 0.0
                        
                        if balance != 0:
                            card_total += balance
                            account_details.append({{
                                'account_name': account['account_name'],
                                'amount': balance
                            }})
                    
                    if card_total != 0 or len(account_details) > 0:
                        account_details.sort(key=lambda x: abs(x['amount']), reverse=True)
                        
                        if card_doc.card_title in categories:
                            categories[card_doc.card_title]['total'] += card_total
                            categories[card_doc.card_title]['accounts'].extend([
                                {{'name': d['account_name'], 'balance': d['amount']}} for d in account_details
                            ])
                            categories[card_doc.card_title]['accounts'].sort(key=lambda x: abs(x['balance']), reverse=True)
                        else:
                            categories[card_doc.card_title] = {{
                                'name': card_doc.card_title,
                                'total': card_total,
                                'color': card_doc.color,
                                'accounts': [
                                    {{'name': d['account_name'], 'balance': d['amount']}} for d in account_details
                                ]
                            }}
                        total += card_total

    category_list = list(categories.values())
    category_list.sort(key=lambda x: abs(x["total"]), reverse=True)

    data = {{
        "total": total,
        "currency": currency,
        "groups": category_list,
        "period": {{
            "from_date": from_date,
            "to_date": to_date
        }}
    }}
    
    # Cache for 5 minutes
    frappe.cache().set_value(cache_key, data, expires_in_sec=300)
    
    return data

def get_period_dates(period):
    current_date = getdate(today())
    
    if period == "Today":
        return current_date, current_date
    elif period == "This Week":
        start = add_days(current_date, -current_date.weekday())
        end = add_days(start, 6)
        return start, end
    elif period == "This Month":
        return get_first_day(current_date), get_last_day(current_date)
    elif period == "Last Month":
        last_month = add_months(current_date, -1)
        return get_first_day(last_month), get_last_day(last_month)
    elif period == "This Year":
        return getdate(f"{{current_date.year}}-01-01"), getdate(f"{{current_date.year}}-12-31")
    elif period == "Last Year":
        last_year = current_date.year - 1
        return getdate(f"{{last_year}}-01-01"), getdate(f"{{last_year}}-12-31")
    elif period == "All Time":
        return getdate("2000-01-01"), current_date
    else:
        return get_first_day(current_date), get_last_day(current_date)
'''
    
    with open(dashboard_path / f"{route}.py", 'w') as f:
        f.write(py_content)
    print(f"✓ Created: {route}.py")
    
    # Generate JSON file
    json_content = f'''{{
 "creation": "2025-01-01 00:00:00.000000",
 "docstatus": 0,
 "doctype": "Page",
 "idx": 0,
 "modified": "2025-01-01 00:00:00.000000",
 "modified_by": "Administrator",
 "module": "Apex Dashboard",
 "name": "{route}",
 "owner": "Administrator",
 "page_name": "{route}",
 "roles": [],
 "standard": "Yes",
 "system_page": 0,
 "title": "{title}"
}}'''
    
    with open(dashboard_path / f"{route}.json", 'w') as f:
        f.write(json_content)
    print(f"✓ Created: {route}.json")
    
    # Generate JS file
    js_content = f'''frappe.pages['{route}'].on_page_load = function(wrapper) {{
    new {title.replace(" ", "")}(wrapper);
}};

class {title.replace(" ", "")} {{
    constructor(wrapper) {{
        this.page = frappe.ui.make_app_page({{
            parent: wrapper,
            title: '{title}',
            single_column: true
        }});
        
        this.wrapper = $(wrapper);
        this.page.main.addClass('{route.replace("_", "-")}');
        
        this.setup_filters();
        this.load_data();
    }}
    
    setup_filters() {{
        // Company filter
        this.page.add_field({{
            fieldname: 'company',
            label: __('Company'),
            fieldtype: 'Link',
            options: 'Company',
            default: frappe.defaults.get_user_default('Company'),
            change: () => this.load_data()
        }});
        
        // Period filter
        this.page.add_field({{
            fieldname: 'period',
            label: __('Period'),
            fieldtype: 'Select',
            options: ['Today', 'This Week', 'This Month', 'Last Month', 'This Year', 'Last Year', 'Custom', 'All Time'],
            default: 'This Month',
            change: () => {{
                if (this.page.fields_dict.period.get_value() === 'Custom') {{
                    this.page.fields_dict.from_date.$wrapper.show();
                    this.page.fields_dict.to_date.$wrapper.show();
                }} else {{
                    this.page.fields_dict.from_date.$wrapper.hide();
                    this.page.fields_dict.to_date.$wrapper.hide();
                    this.load_data();
                }}
            }}
        }});
        
        // Date range filters (hidden by default)
        this.page.add_field({{
            fieldname: 'from_date',
            label: __('From Date'),
            fieldtype: 'Date',
            hidden: 1,
            change: () => this.load_data()
        }});
        
        this.page.add_field({{
            fieldname: 'to_date',
            label: __('To Date'),
            fieldtype: 'Date',
            hidden: 1,
            change: () => this.load_data()
        }});
    }}
    
    load_data() {{
        const company = this.page.fields_dict.company.get_value();
        const period = this.page.fields_dict.period.get_value();
        const from_date = this.page.fields_dict.from_date.get_value();
        const to_date = this.page.fields_dict.to_date.get_value();
        
        frappe.call({{
            method: 'apex_dashboard.apex_dashboard.page.{route}.{route}.get_dashboard_data',
            args: {{ company, period, from_date, to_date }},
            callback: (r) => {{
                if (r.message) {{
                    this.render(r.message);
                }}
            }}
        }});
    }}
    
    render(data) {{
        this.page.main.html(`
            <div class="dashboard-container">
                <div class="dashboard-header">
                    <h2>Total: ${{this.format_currency(data.total, data.currency)}}</h2>
                    <p>Period: ${{data.period.from_date}} to ${{data.period.to_date}}</p>
                </div>
                <div class="dashboard-grid">
                    ${{data.groups.map(group => this.render_card(group, data.currency)).join('')}}
                </div>
            </div>
        `);
    }}
    
    render_card(group, currency) {{
        const accountsHtml = group.accounts && group.accounts.length > 0 
            ? `<div class="card-body" style="display: none;">
                ${{group.accounts.map(acc => `
                    <div class="account-row">
                        <span class="account-name">${{acc.name}}</span>
                        <span class="account-balance">${{this.format_currency(acc.balance, currency)}}</span>
                    </div>
                `).join('')}}
               </div>`
            : '';
        
        return `
            <div class="category-card" style="border-left: 4px solid ${{group.color}}">
                <div class="card-header">
                    <h3>${{group.name}}</h3>
                    <div class="card-amount">${{this.format_currency(group.total, currency)}}</div>
                </div>
                ${{accountsHtml}}
            </div>
        `;
    }}
    
    format_currency(value, currency = 'EGP') {{
        return `${{parseFloat(value).toLocaleString('en-US', {{
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }})}} ${{currency}}`;
    }}
}}'''
    
    with open(dashboard_path / f"{route}.js", 'w') as f:
        f.write(js_content)
    print(f"✓ Created: {route}.js")
    
    # Generate CSS file
    css_content = f'''.{route.replace("_", "-")} {{
    background: transparent;
}}

.{route.replace("_", "-")} .dashboard-container {{
    padding: 20px;
}}

.{route.replace("_", "-")} .dashboard-header {{
    margin-bottom: 30px;
    text-align: center;
}}

.{route.replace("_", "-")} .dashboard-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
}}

.{route.replace("_", "-")} .category-card {{
    background: var(--card-bg);
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}}

.{route.replace("_", "-")} .card-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
}}

.{route.replace("_", "-")} .card-amount {{
    font-size: 1.5em;
    font-weight: bold;
    color: var(--text-color);
}}

.{route.replace("_", "-")} .account-row {{
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color);
}}'''
    
    with open(dashboard_path / f"{route}.css", 'w') as f:
        f.write(css_content)
    print(f"✓ Created: {route}.css")
    
    print()
    print("="*70)
    print("✅ DASHBOARD FILES GENERATED SUCCESSFULLY!")
    print("="*70)
    print()
    print("Next steps:")
    print("1. Run: cd /home/frappe/frappe-bench && bench migrate")
    print("2. Run: bench clear-cache")
    print("3. Run: bench restart")
    print(f"4. Access at: http://localhost:8000/app/{route}")
    print()
    
    return True

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3 generate_dashboard_simple.py <route> <title> <category>")
        print('Example: python3 generate_dashboard_simple.py revenue_dashboard "Revenue Dashboard" Revenue')
        sys.exit(1)
    
    route = sys.argv[1]
    title = sys.argv[2]
    category = sys.argv[3]
    
    success = generate_dashboard_files(route, title, category)
    sys.exit(0 if success else 1)
