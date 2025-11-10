from __future__ import annotations

from typing import Dict, List, Optional, Sequence

import frappe
from frappe import _
from frappe.utils import get_first_day, getdate, nowdate

from apex_dashboard.dashboard import utils as dashboard_utils


@frappe.whitelist()
def get_context(context):
	context.no_cache = 1
	context.page_title = _("P&L Performance Dashboard")
	return context


@frappe.whitelist()
def get_dashboard_data(
	company: Optional[str] = None,
	posting_date: Optional[str] = None,
	from_date: Optional[str] = None,
	to_date: Optional[str] = None,
):
	try:
		posting_date = posting_date or nowdate()
		posting_date = str(getdate(posting_date))

		from_date = from_date or str(get_first_day(posting_date))
		to_date = to_date or posting_date

		data = build_pl_snapshot(company=company, from_date=from_date, to_date=to_date)

		return {
			"success": True,
			"filters": {
				"company": company,
				"posting_date": posting_date,
				"from_date": from_date,
				"to_date": to_date,
			},
			"data": data,
		}
	except Exception as exc:
		frappe.log_error(frappe.get_traceback(), "P&L Performance Dashboard - get_dashboard_data")
		return {
			"success": False,
			"error": _(str(exc)),
		}


def build_pl_snapshot(company: Optional[str], from_date: str, to_date: str) -> Dict[str, object]:
	mapping = dashboard_utils.get_accounts_for_section("pl_performance_dashboard")
	company_currency = dashboard_utils.get_company_currency(company)

	direct_income = _get_period_balances(mapping.get("direct_income", []), company, from_date, to_date)
	indirect_income = _get_period_balances(mapping.get("indirect_income", []), company, from_date, to_date)
	direct_expenses = _get_period_balances(mapping.get("direct_expenses", []), company, from_date, to_date)
	indirect_expenses = _get_period_balances(mapping.get("indirect_expenses", []), company, from_date, to_date)

	direct_income_total = sum(entry["amount"] for entry in direct_income)
	indirect_income_total = sum(entry["amount"] for entry in indirect_income)
	direct_expense_total = sum(entry["amount"] for entry in direct_expenses)
	indirect_expense_total = sum(entry["amount"] for entry in indirect_expenses)

	net_profit = (direct_income_total + indirect_income_total + direct_expense_total + indirect_expense_total)

	kpis = [
		{
			"key": "direct_income",
			"label": _("الدخل المباشر"),
			"totals": _format_totals(direct_income_total, company_currency),
			"indicator": "positive",
		},
		{
			"key": "indirect_income",
			"label": _("الدخل غير المباشر"),
			"totals": _format_totals(indirect_income_total, company_currency),
			"indicator": "info",
		},
		{
			"key": "direct_expenses",
			"label": _("المصروفات المباشرة"),
			"totals": _format_totals(direct_expense_total, company_currency),
			"indicator": "danger" if direct_expense_total < 0 else "info",
		},
		{
			"key": "indirect_expenses",
			"label": _("المصروفات غير المباشرة"),
			"totals": _format_totals(indirect_expense_total, company_currency),
			"indicator": "danger" if indirect_expense_total < 0 else "info",
		},
		{
			"key": "net_profit",
			"label": _("صافي الربح"),
			"totals": _format_totals(net_profit, company_currency),
			"indicator": "positive" if net_profit >= 0 else "danger",
		},
	]

	return {
		"kpis": kpis,
		"sections": [
			_format_section(_("الدخل المباشر"), direct_income, company_currency),
			_format_section(_("الدخل غير المباشر"), indirect_income, company_currency),
			_format_section(_("المصروفات المباشرة"), direct_expenses, company_currency),
			_format_section(_("المصروفات غير المباشرة"), indirect_expenses, company_currency),
		],
		"chart": _build_chart_data(
			direct_income_total,
			indirect_income_total,
			abs(direct_expense_total),
			abs(indirect_expense_total),
			net_profit,
			company_currency,
		),
	}


def _get_period_balances(
	accounts: Sequence[str],
	company: Optional[str],
	from_date: str,
	to_date: str,
) -> List[Dict[str, object]]:
	if not accounts:
		return []

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
			gl.account,
			SUM(gl.credit - gl.debit) AS amount
		FROM `tabGL Entry` gl
		WHERE {' AND '.join(conditions)}
		GROUP BY gl.account
	"""

	rows = frappe.db.sql(query, values=values, as_dict=True)

	results: List[Dict[str, object]] = []
	for row in rows:
		account = row.account
		amount = row.amount or 0
		currency = frappe.get_cached_value("Account", account, "account_currency") or ""
		results.append(
			{
				"account": account,
				"amount": amount,
				"currency": currency,
			}
		)

	return results


def _format_totals(amount: float, currency: str) -> Dict[str, object]:
	return {
		"by_currency": {currency: amount},
		"base": amount,
	}


def _format_section(label: str, entries: List[Dict[str, object]], company_currency: str) -> Dict[str, object]:
	totals = sum(entry["amount"] for entry in entries)
	return {
		"label": label,
		"totals": _format_totals(totals, company_currency),
		"balances": [
			{
				"account": entry["account"],
				"balance": entry["amount"],
				"currency": company_currency,
				"base_balance": entry["amount"],
			}
			for entry in entries
		],
	}


def _build_chart_data(
	direct_income: float,
	indirect_income: float,
	direct_expenses: float,
	indirect_expenses: float,
	net_profit: float,
	currency: str,
) -> Dict[str, object]:
	return {
		"currency": currency,
		"series": [
			{"name": _("الدخل المباشر"), "value": direct_income},
			{"name": _("الدخل غير المباشر"), "value": indirect_income},
			{"name": _("المصروفات المباشرة"), "value": -direct_expenses},
			{"name": _("المصروفات غير المباشرة"), "value": -indirect_expenses},
			{"name": _("صافي الربح"), "value": net_profit},
		],
	}

