from __future__ import annotations

from typing import Dict, List, Optional, Sequence, Tuple

import frappe
from frappe import _
from frappe.utils import getdate, nowdate

from apex_dashboard.dashboard import utils as dashboard_utils


@frappe.whitelist()
def get_context(context):
	context.no_cache = 1
	context.page_title = _("Liabilities Dashboard")
	return context


@frappe.whitelist()
def get_dashboard_data(company: Optional[str] = None, posting_date: Optional[str] = None):
	try:
		posting_date = posting_date or nowdate()
		posting_date = str(getdate(posting_date))

		data = build_liabilities_snapshot(company=company, posting_date=posting_date)

		return {
			"success": True,
			"filters": {
				"company": company,
				"posting_date": posting_date,
			},
			"data": data,
		}
	except Exception as exc:
		frappe.log_error(frappe.get_traceback(), "Liabilities Dashboard - get_dashboard_data")
		return {
			"success": False,
			"error": _(str(exc)),
		}


def build_liabilities_snapshot(company: Optional[str], posting_date: str) -> Dict[str, object]:
	mapping = dashboard_utils.get_accounts_for_section("liabilities_dashboard")

	sections: List[Dict[str, object]] = []

	suppliers_section = _build_section(
		title=_("الموردون وشركات الخدمات"),
		entries=[
			(_("الموردون"), mapping.get("suppliers")),
			(_("شركات الشحن"), mapping.get("shipping")),
			(_("الجمارك"), mapping.get("customs")),
		],
		company=company,
		posting_date=posting_date,
	)
	sections.append(suppliers_section)

	employees_section = _build_section(
		title=_("مستحقات الموظفين والشركاء"),
		entries=[
			(_("رواتب الموظفين"), mapping.get("employees")),
			(_("شركاء المبيعات"), mapping.get("partners")),
			(_("دائنون آخرون"), mapping.get("other_creditors")),
		],
		company=company,
		posting_date=posting_date,
	)
	sections.append(employees_section)

	notes_section = _build_section(
		title=_("Notes Payable"),
		entries=[(_("Notes Payable"), mapping.get("notes_payable"))],
		company=company,
		posting_date=posting_date,
	)
	sections.append(notes_section)

	taxes_section = _build_section(
		title=_("الضرائب والجهات السيادية"),
		entries=[(_("الضرائب والرسوم"), mapping.get("taxes"))],
		company=company,
		posting_date=posting_date,
	)
	sections.append(taxes_section)

	other_section = _build_section(
		title=_("التزامات أخرى"),
		entries=[
			(_("التزامات المخزون"), mapping.get("stock_liabilities")),
			(_("أرصدة دائنة متنوعة"), mapping.get("credit_balances")),
			(_("السحب على المكشوف"), mapping.get("overdrafts")),
		],
		company=company,
		posting_date=posting_date,
	)
	sections.append(other_section)

	kpis = _build_kpis(suppliers_section, taxes_section, employees_section, notes_section, other_section)
	alerts = _generate_liability_alerts(taxes_section, employees_section, other_section)

	return {
		"kpis": kpis,
		"sections": sections,
		"alerts": alerts,
	}


def _build_section(
	title: str,
	entries: Sequence[Tuple[str, object]],
	company: Optional[str],
	posting_date: str,
) -> Dict[str, object]:
	groups: List[Dict[str, object]] = []
	total_currency: Dict[str, float] = {}
	total_base = 0.0

	for label, config in entries:
		accounts = _normalize_accounts(config)
		balances = dashboard_utils.get_balances_for_accounts(accounts, company=company, posting_date=posting_date)
		by_currency = dashboard_utils.summarize_balances_by_currency(balances)
		base_total = dashboard_utils.summarize_base_total(balances)

		for currency, amount in by_currency.items():
			total_currency[currency] = total_currency.get(currency, 0.0) + amount
		total_base += base_total

		groups.append(
			{
				"label": label,
				"accounts": accounts,
				"balances": [balance.__dict__ for balance in balances],
				"totals": {
					"by_currency": by_currency,
					"base": base_total,
				},
			}
		)

	return {
		"title": title,
		"groups": groups,
		"totals": {
			"by_currency": total_currency,
			"base": total_base,
		},
	}


def _normalize_accounts(config: object) -> List[str]:
	if isinstance(config, dict) and "accounts" in config:
		return config.get("accounts") or []
	if isinstance(config, dict):
		return []
	if isinstance(config, (list, tuple)):
		return list(config)
	if config:
		return [config]
	return []


def _build_kpis(*sections: Dict[str, object]) -> List[Dict[str, object]]:
	kpis: List[Dict[str, object]] = []
	names = ["suppliers", "taxes", "employees", "notes", "others"]
	labels = [
		_("إجمالي الموردين"),
		_("إجمالي الضرائب"),
		_("مستحقات الموظفين"),
		_("Notes Payable"),
		_("التزامات أخرى"),
	]

	for idx, section in enumerate(sections):
		if not section:
			continue
		totals = section.get("totals") or {}
		kpis.append(
			{
				"key": names[idx],
				"label": labels[idx],
				"totals": totals,
				"indicator": "danger" if (totals.get("base") or 0) > 0 else "info",
			}
		)

	return kpis


def _generate_liability_alerts(
	taxes_section: Dict[str, object],
	employees_section: Dict[str, object],
	other_section: Dict[str, object],
) -> List[Dict[str, object]]:
	alerts: List[Dict[str, object]] = []

	tax_total = (taxes_section.get("totals") or {}).get("base", 0) if taxes_section else 0
	if tax_total and tax_total > 0:
		alerts.append(
			{
				"level": "warning",
				"message": _("هناك ضرائب مستحقة الدفع، راجع جدول السداد."),
			}
		)

	employee_total = (employees_section.get("totals") or {}).get("base", 0) if employees_section else 0
	if employee_total and employee_total > 0:
		alerts.append(
			{
				"level": "danger",
				"message": _("لا تزال مستحقات الموظفين معلقة، يُرجى صرفها قبل موعد الرواتب."),
			}
		)

	overdraft_total = 0
	if other_section:
		for group in other_section.get("groups", []):
			if _("السحب على المكشوف") in group.get("label", ""):
				overdraft_total = group.get("totals", {}).get("base", 0)
				break

	if overdraft_total and overdraft_total > 0:
		alerts.append(
			{
				"level": "warning",
				"message": _("هناك استخدام للسحب على المكشوف، راجع خطط التمويل."),
			}
		)

	if not alerts:
		alerts.append(
			{
				"level": "info",
				"message": _("لا توجد تنبيهات حرجة في الوقت الحالي."),
			}
		)

	return alerts

