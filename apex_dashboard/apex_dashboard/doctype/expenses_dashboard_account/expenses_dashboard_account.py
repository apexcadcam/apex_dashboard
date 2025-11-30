import frappe
from frappe.model.document import Document

class ExpensesDashboardAccount(Document):
	pass

@frappe.whitelist()
def get_account_query(doctype, txt, searchfield, start, page_len, filters):
	"""Filter accounts based on parent account from parent row"""
	# Get parent document
	parent_doc = frappe.get_doc(filters.get('parent_doctype'), filters.get('parent'))
	
	# Find the current row in expense_groups
	parent_account = None
	for group in parent_doc.expense_groups:
		if group.name == filters.get('parentfield_name'):
			parent_account = group.parent_account
			break
	
	if not parent_account:
		return []
	
	# Get lft/rgt for hierarchical query
	parent_lft, parent_rgt = frappe.db.get_value("Account", parent_account, ["lft", "rgt"])
	
	return frappe.db.sql("""
		SELECT name, account_name
		FROM `tabAccount`
		WHERE lft > %s AND rgt < %s 
			AND is_group = 0 
			AND docstatus = 0
			AND ({key} LIKE %s OR account_name LIKE %s)
		ORDER BY name
		LIMIT %s OFFSET %s
	""".format(key=searchfield), (parent_lft, parent_rgt, f"%{txt}%", f"%{txt}%", page_len, start))
