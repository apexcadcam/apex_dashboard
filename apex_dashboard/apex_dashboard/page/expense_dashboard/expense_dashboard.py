# -*- coding: utf-8 -*-
# Copyright (c) 2025
# For license information, please see license.txt

from __future__ import unicode_literals

import frappe
from frappe import _
from frappe.utils import today, cint

from apex_dashboard.expense_dashboard_utils import get_expense_dashboard_data


@frappe.whitelist()
def get_context(context):
	context.no_cache = 1
	context.today = today()
	return context


@frappe.whitelist()
def get_dashboard_data(
	date=None,
	company=None,
	include_zero: str | int = 0,
	period: str | None = None,
	from_date: str | None = None,
	to_date: str | None = None,
	compare_to_previous: str | int = 0,
):
	try:
		include_zero_flag = _coerce_bool(include_zero)
		compare_flag = _coerce_bool(compare_to_previous)

		data = get_expense_dashboard_data(
			date=date,
			company=company,
			include_zero=include_zero_flag,
			period=period,
			from_date=from_date,
			to_date=to_date,
			compare_to_previous=compare_flag,
		)

		period_info = data.get("period") or {}

		return {
			"success": True,
			"filters": {
				"company": company,
				"include_zero": include_zero_flag,
				"period": period_info.get("type") or period,
				"from_date": period_info.get("from_date") or from_date,
				"to_date": period_info.get("to_date") or to_date,
				"compare_to_previous": compare_flag,
			},
			"data": data,
		}

	except Exception as err:
		frappe.log_error(frappe.get_traceback(), "Expense Dashboard - get_dashboard_data")
		return {
			"success": False,
			"error": _(str(err)),
		}


def _coerce_bool(value) -> bool:
	if isinstance(value, bool):
		return value

	if isinstance(value, int):
		return value == 1

	if value is None:
		return False

	if isinstance(value, str):
		value = value.strip().lower()
		if value in {"1", "true", "yes", "y"}:
			return True
		if value in {"0", "false", "no", "n"}:
			return False

	return bool(cint(value))


