from __future__ import annotations

from typing import Dict, List, Optional

import frappe
from frappe import _
from frappe.utils import getdate, nowdate

from apex_dashboard.dashboard import utils as dashboard_utils


@frappe.whitelist()
def get_context(context):
	context.no_cache = 1
	context.page_title = _("Executive Control Center")
	return context


@frappe.whitelist()
def get_dashboard_data(company: Optional[str] = None, posting_date: Optional[str] = None):
	try:
		posting_date = posting_date or nowdate()
		posting_date = str(getdate(posting_date))

		data = build_executive_snapshot(company=company, posting_date=posting_date)

		return {
			"success": True,
			"filters": {
				"company": company,
				"posting_date": posting_date,
			},
			"data": data,
		}
	except Exception as exc:
		frappe.log_error(frappe.get_traceback(), "Executive Control Center - get_dashboard_data")
		return {
			"success": False,
			"error": _(str(exc)),
		}


def build_executive_snapshot(company: Optional[str], posting_date: str) -> Dict[str, object]:
	account_map = dashboard_utils.get_dashboard_account_groups().get("executive_control_center", {})
	kpi_map: Dict[str, object] = account_map.get("kpis", {}) if isinstance(account_map, dict) else {}

	total_cash_entry = _prepare_total_cash_entry(kpi_map, company, posting_date)
	net_working_capital_entry = _prepare_working_capital_entry(kpi_map, company, posting_date)
	net_profit_entry = _prepare_net_profit_entry(kpi_map, company, posting_date)
	critical_entry = _prepare_critical_commitments_entry(kpi_map, company, posting_date)

	alerts = _generate_alerts(
		total_cash_entry,
		net_working_capital_entry,
		critical_entry,
	)

	shortcuts = [
		{"label": _("السيولة والتمويل"), "route": ["page", "cash-liquidity-dashboard"]},
		{"label": _("الذمم والتحصيل"), "route": ["page", "receivables-dashboard"]},
		{"label": _("الالتزامات والضرائب"), "route": ["page", "liabilities-dashboard"]},
		{"label": _("الأداء الربحي"), "route": ["page", "pl-performance-dashboard"]},
	]

	return {
		"kpis": [
			total_cash_entry,
			net_working_capital_entry,
			net_profit_entry,
			critical_entry,
		],
		"alerts": alerts,
		"shortcuts": shortcuts,
	}


def _prepare_total_cash_entry(kpi_map, company: Optional[str], posting_date: str) -> Dict[str, object]:
	accounts = []
	if isinstance(kpi_map, dict):
		accounts = kpi_map.get("total_cash") or []

	balances = dashboard_utils.get_balances_for_accounts(accounts, company=company, posting_date=posting_date)
	return {
		"key": "total_cash",
		"label": _("إجمالي السيولة"),
		"totals": {
			"by_currency": dashboard_utils.summarize_balances_by_currency(balances),
			"base": dashboard_utils.summarize_base_total(balances),
		},
		"accounts": accounts,
		"balances": [balance.__dict__ for balance in balances],
		"indicator": "positive",
	}


def _prepare_working_capital_entry(kpi_map, company: Optional[str], posting_date: str) -> Dict[str, object]:
	assets = []
	liabilities = []

	if isinstance(kpi_map, dict):
		wc_map = kpi_map.get("net_working_capital") or {}
		if isinstance(wc_map, dict):
			assets = wc_map.get("assets") or []
			liabilities = wc_map.get("liabilities") or []

	asset_balances = dashboard_utils.get_balances_for_accounts(assets, company=company, posting_date=posting_date)
	liability_balances = dashboard_utils.get_balances_for_accounts(
		liabilities, company=company, posting_date=posting_date
	)

	asset_base = dashboard_utils.summarize_base_total(asset_balances)
	liability_base = dashboard_utils.summarize_base_total(liability_balances)
	net_base = asset_base - liability_base

	return {
		"key": "net_working_capital",
		"label": _("صافي رأس المال العامل"),
		"totals": {
			"assets": dashboard_utils.summarize_balances_by_currency(asset_balances),
			"liabilities": dashboard_utils.summarize_balances_by_currency(liability_balances),
			"base": net_base,
		},
		"accounts": {
			"assets": assets,
			"liabilities": liabilities,
		},
		"balances": {
			"assets": [balance.__dict__ for balance in asset_balances],
			"liabilities": [balance.__dict__ for balance in liability_balances],
		},
		"indicator": "info" if net_base >= 0 else "danger",
	}


def _prepare_net_profit_entry(kpi_map, company: Optional[str], posting_date: str) -> Dict[str, object]:
	accounts = []
	if isinstance(kpi_map, dict):
		accounts = kpi_map.get("net_profit") or []

	balances = dashboard_utils.get_balances_for_accounts(accounts, company=company, posting_date=posting_date)
	total_base = dashboard_utils.summarize_base_total(balances)

	return {
		"key": "net_profit",
		"label": _("صافي الربحية التراكمية"),
		"totals": {
			"by_currency": dashboard_utils.summarize_balances_by_currency(balances),
			"base": total_base,
		},
		"accounts": accounts,
		"balances": [balance.__dict__ for balance in balances],
		"indicator": "positive" if total_base >= 0 else "warning",
	}


def _prepare_critical_commitments_entry(kpi_map, company: Optional[str], posting_date: str) -> Dict[str, object]:
	accounts = []
	if isinstance(kpi_map, dict):
		accounts = kpi_map.get("critical_commitments") or []

	balances = dashboard_utils.get_balances_for_accounts(accounts, company=company, posting_date=posting_date)
	total_base = dashboard_utils.summarize_base_total(balances)

	return {
		"key": "critical_commitments",
		"label": _("الالتزامات الحرجة"),
		"totals": {
			"by_currency": dashboard_utils.summarize_balances_by_currency(balances),
			"base": total_base,
		},
		"accounts": accounts,
		"balances": [balance.__dict__ for balance in balances],
		"indicator": "danger" if total_base > 0 else "info",
	}


def _generate_alerts(
	total_cash_entry: Dict[str, object],
	net_working_capital_entry: Dict[str, object],
	critical_entry: Dict[str, object],
) -> List[Dict[str, object]]:
	alerts: List[Dict[str, object]] = []

	total_cash = (total_cash_entry.get("totals") or {}).get("base", 0)
	net_wc = (net_working_capital_entry.get("totals") or {}).get("base", 0)
	critical = (critical_entry.get("totals") or {}).get("base", 0)

	if total_cash is not None and critical is not None and total_cash < critical:
		alerts.append(
			{
				"level": "danger",
				"message": _("السيولة الحالية أقل من الالتزامات الحرجة، يُرجى مراجعة خطة التمويل."),
			}
		)

	if net_wc is not None and net_wc < 0:
		alerts.append(
			{
				"level": "warning",
				"message": _("صافي رأس المال العامل بالسالب، قد تواجه ضغطًا في التمويل قصير الأجل."),
			}
		)

	if not alerts:
		alerts.append(
			{
				"level": "info",
				"message": _("لا توجد تنبيهات حرجة حالياً."),
			}
		)

	return alerts

