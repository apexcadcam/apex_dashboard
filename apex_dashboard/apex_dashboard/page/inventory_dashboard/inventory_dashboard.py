import frappe
from frappe import _
from frappe.utils import flt, today
from frappe.query_builder import DocType
from frappe.query_builder.functions import Sum, Count

@frappe.whitelist()
def get_dashboard_data(company=None, period="This Month", from_date=None, to_date=None):
	"""
	Get inventory dashboard data with dynamic card configuration.
	"""
	# Check cache first
	cache_key = f"inventory_{company}_{period}_{from_date}_{to_date}"
	cached_data = frappe.cache().get_value(cache_key)
	if cached_data:
		return cached_data
	
	if not company:
		company = frappe.defaults.get_user_default("Company")

	# Get Company Currency
	currency = frappe.get_value("Company", company, "default_currency") or "EGP"

	# 1. Get Total Stock Value
	Bin = DocType("Bin")
	query_total = (
		frappe.qb.from_(Bin)
		.select(
			Count(Bin.item_code).distinct().as_("items_count"),
			Sum(Bin.stock_value).as_("total_value")
		)
		.where(Bin.actual_qty > 0)
	)
	total_stock = query_total.run(as_dict=True)[0]

	# 2. Define Categories (Groups)
	# We will try to fetch configuration from Apex Dashboard Card if available
	# Otherwise fallback to hardcoded defaults
	
	default_groups = [
		{
			"name": "Machines",
			"title": "🏭 Machines",
			"color": "#E91E63",
			"icon": "fa fa-cogs",
			"item_groups": [
				'3D Resin Printer', 'Metal Printer', 'Dental Milling machines',
				'Zircon Furnace', 'Extra Oral Scanner', 'Intra Oral Scanner'
			]
		},
		{
			"name": "Materials",
			"title": "📦 Materials",
			"color": "#9C27B0",
			"icon": "fa fa-cubes",
			"item_groups": [
				'Zircon Block', 'Zircon Disk', 'PMMA Disk', 'Titanium Disk',
				'Hybird Block', 'Lithium Disilicate Block', 'Lithium Disilicate Ingot',
				'3D Risen Material', 'Implant Accessories', 'Implant Fixture'
			]
		},
		{
			"name": "Software",
			"title": "💻 Software",
			"color": "#2196F3",
			"icon": "fa fa-laptop",
			"item_groups": ['CAD Software', 'CAM Software']
		},
		{
			"name": "Accessories",
			"title": "🔧 Accessories",
			"color": "#FF9800",
			"icon": "fa fa-wrench",
			"item_groups": ['Milling Tools', 'New Spare Parts', 'Suction']
		}
	]

	# Fetch dynamic config if exists
	cards = frappe.get_all("Apex Dashboard Card",
		filters={"category": "Inventory", "is_active": 1},
		fields=["name", "card_title", "color", "icon"]
	)
	
	# Map dynamic cards to groups if they match names, or append new ones?
	# For now, we'll stick to the fixed structure but override visual properties if a card matches the name
	# This is a hybrid approach to keep the logic simple without complex dynamic query generation for now
	
	card_map = {c.name: c for c in cards}
	
	groups_data = []
	
	for group in default_groups:
		# Override with dynamic config if available
		if group["name"] in card_map:
			card = card_map[group["name"]]
			group["title"] = card.card_title
			group["color"] = card.color
			group["icon"] = card.icon
			
		# Fetch data for this group
		group_data = get_group_data(group["item_groups"])
		
		groups_data.append({
			"name": group["title"], # Use title for display
			"color": group["color"],
			"icon": group["icon"],
			"value": group_data["value"],
			"qty": group_data["qty"],
			"items": group_data["items"],
			"details": group_data["details"]
		})

	# 3. Get Alerts (Low Stock & Out of Stock)
	alerts = get_alerts()

	# 4. Get Top Items
	top_items = get_top_items()

	# 5. Get Warehouse Breakdown
	warehouses = get_warehouse_breakdown()

	# Build response data
	data = {
		"currency": currency,
		"total_stock": {
			"items": total_stock.get('items_count') or 0,
			"value": total_stock.get('total_value') or 0
		},
		"groups": groups_data, # Standardized list for dynamic rendering
		"alerts": alerts,
		"warehouses": warehouses,
		"top_items": top_items,
		"period": {
			"from_date": from_date or today(),
			"to_date": to_date or today()
		}
	}
	
	# Cache for 5 minutes
	frappe.cache().set_value(cache_key, data, expires_in_sec=300)
	
	return data

def get_group_data(item_groups):
	"""Helper to fetch stock data for specific item groups using Query Builder"""
	Bin = DocType("Bin")
	Item = DocType("Item")
	
	query = (
		frappe.qb.from_(Bin)
		.join(Item).on(Bin.item_code == Item.name)
		.select(
			Item.item_group,
			Count(Bin.item_code).distinct().as_("count"),
			Sum(Bin.actual_qty).as_("qty"),
			Sum(Bin.stock_value).as_("value")
		)
		.where(Item.item_group.isin(item_groups))
		.where(Bin.actual_qty > 0)
		.where(Item.disabled == 0)
		.where(Bin.warehouse.isin(['Demo Machines - AP', 'Headquarter Warehouse - AP', 'Used Machines - AP']))
		.groupby(Item.item_group)
		.orderby(Sum(Bin.stock_value), order=frappe.qb.desc)
	)
	
	details = query.run(as_dict=True)
	
	return {
		'items': sum(d.get('count', 0) for d in details),
		'qty': sum(d.get('qty', 0) for d in details),
		'value': sum(d.get('value', 0) for d in details),
		'details': details
	}

def get_alerts():
	"""Fetch low stock and out of stock items"""
	Bin = DocType("Bin")
	Item = DocType("Item")
	
	# Low Stock (< 10)
	low_stock = (
		frappe.qb.from_(Bin)
		.join(Item).on(Bin.item_code == Item.name)
		.select(
			Item.item_name,
			Item.item_group,
			Bin.actual_qty,
			Bin.stock_value,
			Bin.warehouse,
			Item.stock_uom
		)
		.where(Bin.actual_qty > 0)
		.where(Bin.actual_qty < 10)
		.where(Item.disabled == 0)
		.orderby(Bin.stock_value, order=frappe.qb.desc)
		.limit(10)
	).run(as_dict=True)
	
	# Out of Stock (<= 0)
	out_of_stock = (
		frappe.qb.from_(Bin)
		.join(Item).on(Bin.item_code == Item.name)
		.select(
			Item.item_name,
			Item.item_group,
			Bin.actual_qty,
			Bin.warehouse,
			Item.stock_uom
		)
		.where(Bin.actual_qty <= 0)
		.where(Item.disabled == 0)
		.orderby(Bin.actual_qty, order=frappe.qb.asc)
		.limit(5)
	).run(as_dict=True)
	
	return {
		"low_stock": low_stock,
		"out_of_stock": out_of_stock,
		"total_alerts": len(low_stock) + len(out_of_stock)
	}

def get_top_items():
	"""Fetch top items by value"""
	Bin = DocType("Bin")
	Item = DocType("Item")
	
	return (
		frappe.qb.from_(Bin)
		.join(Item).on(Bin.item_code == Item.name)
		.select(
			Item.item_name,
			Item.item_group,
			Bin.actual_qty,
			Bin.stock_value,
			Item.stock_uom
		)
		.where(Bin.actual_qty > 0)
		.orderby(Bin.stock_value, order=frappe.qb.desc)
		.limit(10)
	).run(as_dict=True)

def get_warehouse_breakdown():
	"""Fetch warehouse breakdown"""
	Bin = DocType("Bin")
	
	return (
		frappe.qb.from_(Bin)
		.select(
			Bin.warehouse,
			Count(Bin.item_code).distinct().as_("items_count"),
			Sum(Bin.actual_qty).as_("total_qty"),
			Sum(Bin.stock_value).as_("total_value")
		)
		.where(Bin.actual_qty > 0)
		.groupby(Bin.warehouse)
		.orderby(Sum(Bin.stock_value), order=frappe.qb.desc)
		.limit(15)
	).run(as_dict=True)
