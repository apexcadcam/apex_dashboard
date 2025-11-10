from __future__ import annotations

from typing import Dict, List, Optional

import frappe
from frappe import _
from frappe.utils import getdate, nowdate

from apex_dashboard.dashboard import utils as dashboard_utils


@frappe.whitelist()
def get_context(context):
	context.no_cache = 1
	context.page_title = _("Fixed Assets Dashboard")
	return context


@frappe.whitelist()
def get_dashboard_data(company: Optional[str] = None, posting_date: Optional[str] = None):
	try:
		posting_date = posting_date or nowdate()
		posting_date = str(getdate(posting_date))

		data = build_fixed_assets_snapshot(company=company, posting_date=posting_date)

		return {
			"success": True,
			"filters": {
				"company": company,
				"posting_date": posting_date,
			},
			"data": data,
		}
	except Exception as exc:
		frappe.log_error(frappe.get_traceback(), "Fixed Assets Dashboard - get_dashboard_data")
		return {
			"success": False,
			"error": _(str(exc)),
		}


def build_fixed_assets_snapshot(company: Optional[str], posting_date: str) -> Dict[str, object]:
	mapping = dashboard_utils.get_accounts_for_section("fixed_assets_dashboard")

	category_keys = [
		("furniture", _("أثاث وتجهيزات")),
		("computers", _("أجهزة الكمبيوتر")),
		("electronics", _("الأجهزة الإلكترونية")),
		("maintenance_tools", _("معدات الصيانة")),
		("dental_machines", _("معدات طبية")),
		("software", _("برمجيات")),
		("buildings", _("مبانٍ")),
	]

	categories: List[Dict[str, object]] = []
	total_base = 0.0

	for key, label in category_keys:
		accounts = mapping.get(key, [])
		balances = dashboard_utils.get_balances_for_accounts(accounts, company=company, posting_date=posting_date)
		by_currency = dashboard_utils.summarize_balances_by_currency(balances)
		base_total = dashboard_utils.summarize_base_total(balances)
		total_base += base_total

		categories.append(
			{
				"key": key,
				"label": label,
				"accounts": accounts,
				"balances": [balance.__dict__ for balance in balances],
				"totals": {
					"by_currency": by_currency,
					"base": base_total,
				},
			}
		)

	cwip_balances = dashboard_utils.get_balances_for_accounts(
		_normalize_list(mapping.get("cwip")), company=company, posting_date=posting_date
	)
	cwip_totals = {
		"by_currency": dashboard_utils.summarize_balances_by_currency(cwip_balances),
		"base": dashboard_utils.summarize_base_total(cwip_balances),
	}

	dep_balances = dashboard_utils.get_balances_for_accounts(
		mapping.get("depreciation_expense", []), company=company, posting_date=posting_date
	)
	dep_totals = {
		"by_currency": dashboard_utils.summarize_balances_by_currency(dep_balances),
		"base": dashboard_utils.summarize_base_total(dep_balances),
	}

	kpis = [
		{
			"key": "net_fixed_assets",
			"label": _("صافي الأصول الثابتة"),
			"totals": {
				"by_currency": _merge_currency_totals([category["totals"]["by_currency"] for category in categories]),
				"base": total_base,
			},
			"indicator": "info",
		},
		{
			"key": "cwip",
			"label": _("أصول تحت التنفيذ (CWIP)"),
			"totals": cwip_totals,
			"indicator": "warning" if cwip_totals["base"] > 0 else "info",
		},
		{
			"key": "depreciation",
			"label": _("مصاريف الإهلاك التراكمية"),
			"totals": dep_totals,
			"indicator": "danger" if dep_totals["base"] > 0 else "info",
		},
	]

	return {
		"kpis": kpis,
		"categories": categories,
		"cwip": {
			"label": _("أصول تحت التنفيذ"),
			"balances": [balance.__dict__ for balance in cwip_balances],
			"totals": cwip_totals,
		},
		"depreciation": {
			"label": _("تفاصيل مصاريف الإهلاك"),
			"balances": [balance.__dict__ for balance in dep_balances],
			"totals": dep_totals,
		},
	}


def _merge_currency_totals(collections: List[Dict[str, float]]) -> Dict[str, float]:
	result: Dict[str, float] = {}
	for entry in collections:
		if not entry:
			continue
		for currency, amount in entry.items():
			result[currency] = result.get(currency, 0.0) + amount
	return result


def _normalize_list(value) -> list[str]:
	if isinstance(value, (list, tuple)):
		return list(value)
	if value:
		return [value]
	return []

