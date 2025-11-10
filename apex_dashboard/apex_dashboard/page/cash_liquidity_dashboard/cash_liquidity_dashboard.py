from __future__ import annotations

from typing import Dict, List, Optional

import frappe
from frappe import _
from frappe.utils import getdate, nowdate

from apex_dashboard.dashboard import utils as dashboard_utils


@frappe.whitelist()
def get_context(context):
	context.no_cache = 1
	context.page_title = _("Cash & Liquidity Dashboard")
	return context


@frappe.whitelist()
def get_dashboard_data(company: Optional[str] = None, posting_date: Optional[str] = None):
	try:
		posting_date = posting_date or nowdate()
		posting_date = str(getdate(posting_date))

		data = build_cash_snapshot(company=company, posting_date=posting_date)

		return {
			"success": True,
			"filters": {
				"company": company,
				"posting_date": posting_date,
			},
			"data": data,
		}
	except Exception as exc:
		frappe.log_error(frappe.get_traceback(), "Cash & Liquidity Dashboard - get_dashboard_data")
		return {
			"success": False,
			"error": _(str(exc)),
		}


def build_cash_snapshot(company: Optional[str], posting_date: str) -> Dict[str, object]:
	mapping = dashboard_utils.get_accounts_for_section("cash_liquidity_dashboard")

	treasury = _build_account_collection(mapping.get("treasury"), company, posting_date, label=_("خزينة HQ"))
	banks = _build_grouped_collection(mapping.get("banks"), company, posting_date, group_label=_("البنوك"))
	credit_cards = _build_grouped_collection(
		mapping.get("credit_cards"), company, posting_date, group_label=_("بطاقات الائتمان")
	)
	facilities = _build_grouped_collection(
		mapping.get("facilities"), company, posting_date, group_label=_("التسهيلات والقروض")
	)

	total_cash_base = treasury["totals"]["base"] + banks["totals"]["base"]
	card_base = credit_cards["totals"]["base"]
	facility_base = facilities["totals"]["base"]
	net_liquidity = total_cash_base - max(facility_base, 0)

	kpis = [
		{
			"key": "total_cash",
			"label": _("إجمالي السيولة المتاحة"),
			"totals": _merge_totals([treasury["totals"], banks["totals"]]),
			"indicator": "positive",
		},
		{
			"key": "credit_cards",
			"label": _("رصيد بطاقات الائتمان"),
			"totals": credit_cards["totals"],
			"indicator": "warning" if card_base < 0 else "info",
		},
		{
			"key": "facilities",
			"label": _("التسهيلات والقروض"),
			"totals": facilities["totals"],
			"indicator": "danger" if facility_base > 0 else "info",
		},
		{
			"key": "net_liquidity",
			"label": _("صافي السيولة بعد الالتزامات"),
			"totals": {
				"by_currency": {},
				"base": net_liquidity,
			},
			"indicator": "positive" if net_liquidity >= 0 else "danger",
		},
	]

	return {
		"kpis": kpis,
		"treasury": treasury,
		"banks": banks,
		"credit_cards": credit_cards,
		"facilities": facilities,
	}


def _build_account_collection(
	config: Optional[object],
	company: Optional[str],
	posting_date: str,
	label: Optional[str] = None,
) -> Dict[str, object]:
	if isinstance(config, dict):
		accounts = config.get("accounts") or []
		name = config.get("name") or label
	else:
		accounts = config or []
		name = label

	balances = dashboard_utils.get_balances_for_accounts(accounts, company=company, posting_date=posting_date)

	return {
		"label": name or _("إجمالي"),
		"accounts": accounts,
		"balances": [balance.__dict__ for balance in balances],
		"totals": {
			"by_currency": dashboard_utils.summarize_balances_by_currency(balances),
			"base": dashboard_utils.summarize_base_total(balances),
		},
	}


def _build_grouped_collection(
	group_config: Optional[object],
	company: Optional[str],
	posting_date: str,
	group_label: Optional[str] = None,
) -> Dict[str, object]:
	results: List[Dict[str, object]] = []
	total_by_currency: Dict[str, float] = {}
	total_base = 0.0

	if isinstance(group_config, dict):
		iterable = group_config.items()
	elif isinstance(group_config, (list, tuple)):
		iterable = enumerate(group_config)
	else:
		iterable = []

	for key, accounts in iterable:
		if isinstance(accounts, dict) and "accounts" in accounts:
			account_list = accounts.get("accounts") or []
			name = accounts.get("name") or str(key)
		elif isinstance(accounts, (list, tuple)):
			account_list = list(accounts)
			name = str(key)
		else:
			account_list = [accounts] if accounts else []
			name = str(key)

		balances = dashboard_utils.get_balances_for_accounts(account_list, company=company, posting_date=posting_date)
		by_currency = dashboard_utils.summarize_balances_by_currency(balances)
		base_total = dashboard_utils.summarize_base_total(balances)

		total_base += base_total
		for currency, amount in by_currency.items():
			total_by_currency[currency] = total_by_currency.get(currency, 0.0) + amount

		results.append(
			{
				"label": name,
				"accounts": account_list,
				"balances": [balance.__dict__ for balance in balances],
				"totals": {
					"by_currency": by_currency,
					"base": base_total,
				},
			}
		)

	return {
		"label": group_label or "",
		"groups": results,
		"totals": {
			"by_currency": total_by_currency,
			"base": total_base,
		},
	}


def _merge_totals(collections: List[Dict[str, object]]) -> Dict[str, object]:
	by_currency: Dict[str, float] = {}
	base_total = 0.0
	for entry in collections:
		if not entry:
			continue
		for currency, amount in (entry.get("by_currency") or {}).items():
			by_currency[currency] = by_currency.get(currency, 0.0) + amount
		base_total += entry.get("base") or 0.0

	return {
		"by_currency": by_currency,
		"base": base_total,
	}

