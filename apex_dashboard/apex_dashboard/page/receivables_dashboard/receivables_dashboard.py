from __future__ import annotations

from typing import Dict, List, Optional

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate

from apex_dashboard.dashboard import utils as dashboard_utils


@frappe.whitelist()
def get_context(context):
	context.no_cache = 1
	context.page_title = _("Receivables Dashboard")
	return context


@frappe.whitelist()
def get_dashboard_data(company: Optional[str] = None, posting_date: Optional[str] = None):
	try:
		posting_date = posting_date or nowdate()
		posting_date = str(getdate(posting_date))

		data = build_receivables_snapshot(company=company, posting_date=posting_date)

		return {
			"success": True,
			"filters": {
				"company": company,
				"posting_date": posting_date,
			},
			"data": data,
		}
	except Exception as exc:
		frappe.log_error(frappe.get_traceback(), "Receivables Dashboard - get_dashboard_data")
		return {
			"success": False,
			"error": _(str(exc)),
		}


def build_receivables_snapshot(company: Optional[str], posting_date: str) -> Dict[str, object]:
	mapping = dashboard_utils.get_accounts_for_section("receivables_dashboard")

	customers = dashboard_utils.get_balances_for_accounts(
		mapping.get("customers", []), company=company, posting_date=posting_date
	)
	notes = dashboard_utils.get_balances_for_accounts(
		mapping.get("notes_receivable", []), company=company, posting_date=posting_date
	)
	cheques = dashboard_utils.get_balances_for_accounts(
		mapping.get("outstanding_cheques", []), company=company, posting_date=posting_date
	)

	customer_totals = {
		"by_currency": dashboard_utils.summarize_balances_by_currency(customers),
		"base": dashboard_utils.summarize_base_total(customers),
	}
	note_totals = {
		"by_currency": dashboard_utils.summarize_balances_by_currency(notes),
		"base": dashboard_utils.summarize_base_total(notes),
	}
	cheque_totals = {
		"by_currency": dashboard_utils.summarize_balances_by_currency(cheques),
		"base": dashboard_utils.summarize_base_total(cheques),
	}

	customer_aging = _get_customer_aging(company, posting_date)

	kpis = [
		{
			"key": "customers",
			"label": _("إجمالي العملاء"),
			"totals": customer_totals,
			"indicator": "info",
		},
		{
			"key": "notes",
			"label": _("إجمالي Notes Receivable"),
			"totals": note_totals,
			"indicator": "info",
		},
		{
			"key": "cheques",
			"label": _("الشيكات تحت التحصيل"),
			"totals": cheque_totals,
			"indicator": "warning" if cheque_totals["base"] > 0 else "info",
		},
		{
			"key": "overdue",
			"label": _("الرصيد المتأخر (>30 يوم)"),
			"totals": {
				"by_currency": customer_aging.get("overdue_by_currency", {}),
				"base": customer_aging.get("overdue_base", 0),
			},
			"indicator": "danger" if customer_aging.get("overdue_base", 0) > 0 else "positive",
		},
	]

	return {
		"kpis": kpis,
		"customers": {
			"label": _("أرصدة العملاء"),
			"balances": [balance.__dict__ for balance in customers],
			"totals": customer_totals,
		},
		"notes_receivable": {
			"label": _("Notes Receivable"),
			"balances": [balance.__dict__ for balance in notes],
			"totals": note_totals,
		},
		"outstanding_cheques": {
			"label": _("Outstanding Cheques"),
			"balances": [balance.__dict__ for balance in cheques],
			"totals": cheque_totals,
		},
		"aging": customer_aging,
	}


def _get_customer_aging(company: Optional[str], posting_date: str) -> Dict[str, object]:
	if not frappe.db.exists("DocType", "Sales Invoice"):
		return {
			"buckets": [],
			"top_overdue": [],
			"overdue_by_currency": {},
			"overdue_base": 0,
		}

	conditions = ["docstatus = 1", "outstanding_amount > 0"]
	values = {"posting_date": posting_date}

	if company:
		conditions.append("company = %(company)s")
		values["company"] = company

	query = f"""
		SELECT
			customer,
			currency,
			SUM(outstanding_amount) AS outstanding,
			SUM(CASE WHEN DATEDIFF(%(posting_date)s, COALESCE(due_date, %(posting_date)s)) <= 0 THEN outstanding_amount ELSE 0 END) AS bucket_current,
			SUM(CASE WHEN DATEDIFF(%(posting_date)s, COALESCE(due_date, %(posting_date)s)) BETWEEN 1 AND 30 THEN outstanding_amount ELSE 0 END) AS bucket_30,
			SUM(CASE WHEN DATEDIFF(%(posting_date)s, COALESCE(due_date, %(posting_date)s)) BETWEEN 31 AND 60 THEN outstanding_amount ELSE 0 END) AS bucket_60,
			SUM(CASE WHEN DATEDIFF(%(posting_date)s, COALESCE(due_date, %(posting_date)s)) BETWEEN 61 AND 90 THEN outstanding_amount ELSE 0 END) AS bucket_90,
			SUM(CASE WHEN DATEDIFF(%(posting_date)s, COALESCE(due_date, %(posting_date)s)) > 90 THEN outstanding_amount ELSE 0 END) AS bucket_90_plus
		FROM `tabSales Invoice`
		WHERE {' AND '.join(conditions)}
		GROUP BY customer, currency
	"""

	rows = frappe.db.sql(query, values=values, as_dict=True)

	buckets = []
	overdue_by_currency: Dict[str, float] = {}
	overdue_base_total = 0.0
	company_currency = dashboard_utils.get_company_currency(company)

	for row in rows:
		overdue_amount = flt(row.bucket_30) + flt(row.bucket_60) + flt(row.bucket_90) + flt(row.bucket_90_plus)
		if overdue_amount > 0:
			overdue_by_currency[row.currency] = overdue_by_currency.get(row.currency, 0.0) + overdue_amount
			overdue_base_total += dashboard_utils.convert_to_company_currency(
				overdue_amount, row.currency, company_currency, posting_date
			)

		buckets.append(
			{
				"customer": row.customer,
				"currency": row.currency,
				"outstanding": row.outstanding,
				"bucket_current": row.bucket_current,
				"bucket_30": row.bucket_30,
				"bucket_60": row.bucket_60,
				"bucket_90": row.bucket_90,
				"bucket_90_plus": row.bucket_90_plus,
				"overdue": overdue_amount,
			}
		)

	buckets.sort(key=lambda entry: entry.get("overdue", 0), reverse=True)

	return {
		"buckets": buckets,
		"top_overdue": buckets[:5],
		"overdue_by_currency": overdue_by_currency,
		"overdue_base": overdue_base_total,
	}

