import frappe
from frappe.utils import flt

def execute():
    company = "APEX"
    
    print(f"--- Debugging Yearly Profits for {company} ---")
    
    # 1. Check GL Entry Count per Year for Income/Expense
    print("\n1. GL Entry Count per Year (Income/Expense):")
    counts = frappe.db.sql("""
        SELECT 
            YEAR(posting_date) as year,
            COUNT(*) as count
        FROM `tabGL Entry` gl
        JOIN `tabAccount` acc ON gl.account = acc.name
        WHERE gl.company = %s 
        AND gl.is_cancelled = 0
        AND acc.root_type IN ('Income', 'Expense')
        GROUP BY YEAR(posting_date)
        ORDER BY year DESC
    """, (company,), as_dict=1)
    
    for c in counts:
        print(f"{c.year}: {c.count} entries")
        
    # 2. Check Voucher Types for a past year (e.g., 2024 or 2023)
    # Find a year with entries but 0 profit
    target_year = None
    for c in counts:
        if c.year < 2025:
            target_year = c.year
            break
            
    if target_year:
        print(f"\n2. Voucher Types for {target_year}:")
        vouchers = frappe.db.sql("""
            SELECT 
                voucher_type,
                COUNT(*) as count,
                SUM(credit - debit) as net_impact
            FROM `tabGL Entry` gl
            JOIN `tabAccount` acc ON gl.account = acc.name
            WHERE gl.company = %s 
            AND gl.is_cancelled = 0
            AND acc.root_type IN ('Income', 'Expense')
            AND YEAR(posting_date) = %s
            GROUP BY voucher_type
        """, (company, target_year), as_dict=1)
        
        for v in vouchers:
            print(f"{v.voucher_type}: {v.count} entries, Net Impact: {flt(v.net_impact)}")
            
        # 3. Check Total Profit for that year (Raw Sum)
        print(f"\n3. Total Raw Profit for {target_year}:")
        total = frappe.db.sql("""
            SELECT SUM(credit - debit) as profit
            FROM `tabGL Entry` gl
            JOIN `tabAccount` acc ON gl.account = acc.name
            WHERE gl.company = %s 
            AND gl.is_cancelled = 0
            AND acc.root_type IN ('Income', 'Expense')
            AND YEAR(posting_date) = %s
        """, (company, target_year))[0][0]
        print(f"Total: {flt(total)}")
        
        # 4. Check Total Profit EXCLUDING Period Closing Voucher
        print(f"\n4. Total Profit EXCLUDING Period Closing Voucher for {target_year}:")
        total_excl = frappe.db.sql("""
            SELECT SUM(credit - debit) as profit
            FROM `tabGL Entry` gl
            JOIN `tabAccount` acc ON gl.account = acc.name
            WHERE gl.company = %s 
            AND gl.is_cancelled = 0
            AND acc.root_type IN ('Income', 'Expense')
            AND YEAR(posting_date) = %s
            AND gl.voucher_type != 'Period Closing Voucher'
        """, (company, target_year))[0][0]
        print(f"Total (Excl Closing): {flt(total_excl)}")

    else:
        print("\nNo historical data found for previous years.")

if __name__ == "__main__":
    pass
