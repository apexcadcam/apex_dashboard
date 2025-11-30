import frappe
import json

def execute():
    doctypes = ['GL Entry', 'Account']
    structure = {}
    
    for dt in doctypes:
        meta = frappe.get_meta(dt)
        fields = [{"fieldname": f.fieldname, "fieldtype": f.fieldtype, "label": f.label} for f in meta.fields]
        structure[dt] = fields
        
    print(json.dumps(structure, indent=2))
