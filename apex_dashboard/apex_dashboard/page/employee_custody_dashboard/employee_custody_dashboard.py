from __future__ import annotations

from typing import Dict, List, Optional

import frappe
from frappe import _
from frappe.utils import getdate, nowdate

from apex_dashboard.dashboard import utils as dashboard_utils


@frappe.whitelist()
def get_context(context):
	context.no_cache = 1
	context.page_title = _("Employee Custody Dashboard")
	return context


@frappe.whitelist()
def get_dashboard_data(company: Optional[str] = None, posting_date: Optional[str] = None):
	try:
		posting_date = posting_date or nowdate()
		posting_date = str(getdate(posting_date))

		data = build_employee_custody_snapshot(company=company, posting_date=posting_date)

		return {
			"success": True,
			"filters": {
				"company": company,
				"posting_date": posting_date,
			},
			"data": data,
		}
	except Exception as exc:
		frappe.log_error(frappe.get_traceback(), "Employee Custody Dashboard - get_dashboard_data")
		return {
			"success": False,
			"error": _(str(exc)),
		}


def build_employee_custody_snapshot(company: Optional[str], posting_date: str) -> Dict[str, object]:
	mapping = dashboard_utils.get_accounts_for_section("employee_custody_dashboard")

	custody = dashboard_utils.get_balances_for_accounts(mapping.get("custody", []), company, posting_date)
	refundable = dashboard_utils.get_balances_for_accounts(mapping.get("refundable_withdrawals", []), company, posting_date)
	cash_advances = dashboard_utils.get_balances_for_accounts(mapping.get("cash_advances", []), company, posting_date)
	consignment = dashboard_utils.get_balances_for_accounts(mapping.get("consignment_goods", []), company, posting_date)
	payables = dashboard_utils.get_balances_for_accounts(mapping.get("payables", []), company, posting_date)

	kpis = [
		{
			"key": "custody",
			"label": _("عهد الموظفين"),
			"totals": _totals(custody),
			"indicator": "warning" if _totals(custody)["base"] > 0 else "info",
		},
		{
			"key": "refundable",
			"label": _("سلف مستردة"),
			"totals": _totals(refundable),
			"indicator": "info",
		},
		{
			"key": "cash_advances",
			"label": _("سلف نقدية"),
			"totals": _totals(cash_advances),
			"indicator": "danger" if _totals(cash_advances)["base"] > 0 else "info",
		},
		{
			"key": "consignment",
			"label": _("بضائع بالعارية"),
			"totals": _totals(consignment),
			"indicator": "warning" if _totals(consignment)["base"] > 0 else "info",
		},
		{
			"key": "payables",
			"label": _("مستحقات الموظفين"),
			"totals": _totals(payables),
			"indicator": "danger" if _totals(payables)["base"] > 0 else "info",
		},
	]

	alerts = _build_alerts(custody, cash_advances, payables)

	return {
		"kpis": kpis,
		"sections": [
			_format_section(_("عهد الموظفين"), custody),
			_format_section(_("سلف مستردة"), refundable),
			_format_section(_("سلف نقدية"), cash_advances),
			_format_section(_("بضائع بالعارية"), consignment),
			_format_section(_("مستحقات الموظفين (خصوم)"), payables),
		],
		"alerts": alerts,
	}


def _totals(balances: List[dashboard_utils.AccountBalance]) -> Dict[str, object]:
	return {
		"by_currency": dashboard_utils.summarize_balances_by_currency(balances),
		"base": dashboard_utils.summarize_base_total(balances),
	}


def _format_section(label: str, balances: List[dashboard_utils.AccountBalance]) -> Dict[str, object]:
	return {
		"label": label,
		"totals": _totals(balances),
		"balances": [balance.__dict__ for balance in balances],
	}


def _build_alerts(
	custody: List[dashboard_utils.AccountBalance],
	cash_advances: List[dashboard_utils.AccountBalance],
	payables: List[dashboard_utils.AccountBalance],
) -> List[Dict[str, object]]:
	alerts: List[Dict[str, object]] = []

	custody_total = _totals(custody)["base"]
	if custody_total > 0:
		alerts.append(
			{
				"level": "warning",
				"message": _("هناك عهد قائمة لم تُسوى بعد، يُنصح بمتابعة الموظفين المعنيين."),
			}
		)

	cash_total = _totals(cash_advances)["base"]
	if cash_total > 0:
		alerts.append(
			{
				"level": "danger",
				"message": _("سلف نقدية مفتوحة تحتاج لتسوية أو خصم قريباً."),
			}
		)

	payable_total = _totals(payables)["base"]
	if payable_total > 0:
		alerts.append(
			{
				"level": "info",
				"message": _("هناك مستحقات رواتب أو عمولات معلقة على الموظفين، تأكد من السداد في الجدول الزمني."),
			}
		)

	if not alerts:
		alerts.append(
			{
				"level": "info",
				"message": _("لا توجد تنبيهات حالية على عهد الموظفين."),
			}
		)

	return alerts

