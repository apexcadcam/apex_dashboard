from __future__ import annotations

from typing import Dict, Optional

import frappe
from frappe import _
from frappe.utils import getdate, nowdate

from apex_dashboard.dashboard import utils as dashboard_utils


@frappe.whitelist()
def get_context(context):
	context.no_cache = 1
	context.page_title = _("Operations & Assets Dashboard")
	return context


@frappe.whitelist()
def get_dashboard_data(company: Optional[str] = None, posting_date: Optional[str] = None):
	try:
		posting_date = posting_date or nowdate()
		posting_date = str(getdate(posting_date))

		data = build_operations_snapshot(company=company, posting_date=posting_date)

		return {
			"success": True,
			"filters": {
				"company": company,
				"posting_date": posting_date,
			},
			"data": data,
		}
	except Exception as exc:
		frappe.log_error(frappe.get_traceback(), "Operations Assets Dashboard - get_dashboard_data")
		return {
			"success": False,
			"error": _(str(exc)),
		}


def build_operations_snapshot(company: Optional[str], posting_date: str) -> Dict[str, object]:
	mapping = dashboard_utils.get_accounts_for_section("operations_assets_dashboard")

	inventory_balances = dashboard_utils.get_balances_for_accounts(
		mapping.get("inventory", []), company=company, posting_date=posting_date
	)
	stock_in_transit_balances = dashboard_utils.get_balances_for_accounts(
		_normalize_list(mapping.get("stock_in_transit")), company=company, posting_date=posting_date
	)
	asset_in_transit_balances = dashboard_utils.get_balances_for_accounts(
		_normalize_list(mapping.get("asset_in_transit")), company=company, posting_date=posting_date
	)
	other_current = dashboard_utils.get_balances_for_accounts(
		mapping.get("other_current_assets", []), company=company, posting_date=posting_date
	)

	inventory_totals = {
		"by_currency": dashboard_utils.summarize_balances_by_currency(inventory_balances),
		"base": dashboard_utils.summarize_base_total(inventory_balances),
	}
	transit_totals = {
		"by_currency": dashboard_utils.summarize_balances_by_currency(
			stock_in_transit_balances + asset_in_transit_balances
		),
		"base": dashboard_utils.summarize_base_total(stock_in_transit_balances + asset_in_transit_balances),
	}
	current_totals = {
		"by_currency": dashboard_utils.summarize_balances_by_currency(other_current),
		"base": dashboard_utils.summarize_base_total(other_current),
	}

	kpis = [
		{
			"key": "inventory",
			"label": _("إجمالي المخزون"),
			"totals": inventory_totals,
			"indicator": "info",
		},
		{
			"key": "in_transit",
			"label": _("المخزون قيد الوصول"),
			"totals": transit_totals,
			"indicator": "warning" if transit_totals["base"] > 0 else "info",
		},
		{
			"key": "other_current",
			"label": _("الأصول المتداولة الأخرى"),
			"totals": current_totals,
			"indicator": "info",
		},
	]

	return {
		"kpis": kpis,
		"inventory": {
			"label": _("تفاصيل المخزون"),
			"balances": [balance.__dict__ for balance in inventory_balances],
			"totals": inventory_totals,
		},
		"in_transit": {
			"label": _("مخزون/أصول قيد الوصول"),
			"stock": [balance.__dict__ for balance in stock_in_transit_balances],
			"asset": [balance.__dict__ for balance in asset_in_transit_balances],
			"totals": transit_totals,
		},
		"other_assets": {
			"label": _("الأصول المتداولة الأخرى"),
			"balances": [balance.__dict__ for balance in other_current],
			"totals": current_totals,
		},
	}


def _normalize_list(value) -> list[str]:
	if isinstance(value, (list, tuple)):
		return list(value)
	if value:
		return [value]
	return []

