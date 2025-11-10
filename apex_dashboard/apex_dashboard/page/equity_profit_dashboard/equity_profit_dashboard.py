from __future__ import annotations

from datetime import date
from typing import Dict, List, Optional

import frappe
from frappe import _
from frappe.utils import add_months, format_date, get_first_day, getdate, nowdate

from apex_dashboard.dashboard import utils as dashboard_utils


@frappe.whitelist()
def get_context(context):
	context.no_cache = 1
	context.page_title = _("Equity & Profit Dashboard")
	return context


@frappe.whitelist()
def get_dashboard_data(company: Optional[str] = None, posting_date: Optional[str] = None):
	try:
		posting_date = posting_date or nowdate()
		posting_date = str(getdate(posting_date))

		data = build_equity_snapshot(company=company, posting_date=posting_date)

		return {
			"success": True,
			"filters": {
				"company": company,
				"posting_date": posting_date,
			},
			"data": data,
		}
	except Exception as exc:
		frappe.log_error(frappe.get_traceback(), "Equity & Profit Dashboard - get_dashboard_data")
		return {
			"success": False,
			"error": _(str(exc)),
		}


def build_equity_snapshot(company: Optional[str], posting_date: str) -> Dict[str, object]:
	mapping = dashboard_utils.get_accounts_for_section("equity_profit_dashboard")

	capital_balances = dashboard_utils.get_balances_for_accounts(mapping.get("capital", []), company, posting_date)
	owner_balances = dashboard_utils.get_balances_for_accounts(mapping.get("owner_equity", []), company, posting_date)
	retained_balances = dashboard_utils.get_balances_for_accounts(
		mapping.get("retained_earnings", []), company, posting_date
	)
	net_income_balances = dashboard_utils.get_balances_for_accounts(mapping.get("net_income", []), company, posting_date)

	capital_totals = _totals(capital_balances)
	owner_totals = _totals(owner_balances)
	retained_totals = _totals(retained_balances)
	net_income_totals = _totals(net_income_balances)

	kpis = [
		{
			"key": "capital",
			"label": _("رأس المال"),
			"totals": capital_totals,
			"indicator": "info",
		},
		{
			"key": "owner_equity",
			"label": _("حقوق الشركاء"),
			"totals": owner_totals,
			"indicator": "info",
		},
		{
			"key": "retained",
			"label": _("الأرباح المحتجزة"),
			"totals": retained_totals,
			"indicator": "positive" if retained_totals["base"] >= 0 else "warning",
		},
		{
			"key": "net_income",
			"label": _("صافي الدخل"),
			"totals": net_income_totals,
			"indicator": "positive" if net_income_totals["base"] >= 0 else "danger",
		},
	]

	chart = _build_income_trend(mapping.get("net_income", []), company, posting_date)

	return {
		"kpis": kpis,
		"capital": _format_group(_("رأس المال"), capital_balances, capital_totals),
		"owner_equity": _format_group(_("حقوق الشركاء"), owner_balances, owner_totals),
		"retained_earnings": _format_group(_("الأرباح المحتجزة"), retained_balances, retained_totals),
		"net_income": _format_group(_("صافي الدخل"), net_income_balances, net_income_totals),
		"chart": chart,
	}


def _totals(balances: List[dashboard_utils.AccountBalance]) -> Dict[str, object]:
	return {
		"by_currency": dashboard_utils.summarize_balances_by_currency(balances),
		"base": dashboard_utils.summarize_base_total(balances),
	}


def _format_group(label: str, balances: List[dashboard_utils.AccountBalance], totals: Dict[str, object]) -> Dict[str, object]:
	return {
		"label": label,
		"totals": totals,
		"balances": [balance.__dict__ for balance in balances],
	}


def _build_income_trend(accounts: List[str], company: Optional[str], posting_date: str) -> Dict[str, object]:
	if not accounts:
		return {"labels": [], "values": [], "currency": dashboard_utils.get_company_currency(company)}

	end_date = getdate(posting_date)
	labels: List[str] = []
	values: List[float] = []

	for idx in range(5, -1, -1):
		month_end = add_months(end_date, -idx)
		month_start = get_first_day(month_end)

		amount = _get_period_income(accounts, company, month_start, month_end)
		labels.append(format_date(month_end, "MMM yyyy"))
		values.append(amount)

	return {
		"labels": labels,
		"values": values,
		"currency": dashboard_utils.get_company_currency(company),
	}


def _get_period_income(accounts: List[str], company: Optional[str], from_date: date, to_date: date) -> float:
	conditions = [
		"gl.account in %(accounts)s",
		"gl.docstatus = 1",
		"gl.posting_date BETWEEN %(from_date)s AND %(to_date)s",
	]
	values = {
		"accounts": tuple(accounts),
		"from_date": from_date,
		"to_date": to_date,
	}
	if company:
		conditions.append("gl.company = %(company)s")
		values["company"] = company

	query = f"""
		SELECT
			COALESCE(SUM(gl.credit - gl.debit), 0) AS amount
		FROM `tabGL Entry` gl
		WHERE {' AND '.join(conditions)}
	"""

	result = frappe.db.sql(query, values=values, as_dict=True)
	return result[0].amount if result else 0.0

