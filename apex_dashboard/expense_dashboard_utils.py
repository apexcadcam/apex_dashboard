from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Dict, List, Optional, Tuple

import frappe
from frappe.utils import (
	add_days,
	add_months,
	get_first_day,
	get_last_day,
	getdate,
	nowdate,
	today,
	flt,
)


@dataclass(frozen=True)
class ExpenseCategory:
	value: str
	label: str
	color: str
	keywords: tuple[str, ...] = ()
	parent_keywords: tuple[str, ...] = ()
	account_types: tuple[str, ...] = ()


EXPENSE_CATEGORY_CONFIG: tuple[ExpenseCategory, ...] = (
	ExpenseCategory(
		value="Operations",
		label="Operations",
		color="#4CAF50",
		keywords=(
			"rent",
			"lease",
			"utility",
			"electric",
			"power",
			"water",
			"maintenance",
			"supplies",
			"office",
			"facility",
			"cleaning",
			"admin",
			"stationery",
		),
		parent_keywords=("operating", "administrative", "general expenses"),
	),
	ExpenseCategory(
		value="HR",
		label="HR & Payroll",
		color="#FF9800",
		keywords=(
			"salary",
			"payroll",
			"wage",
			"benefit",
			"bonus",
			"incentive",
			"allowance",
			"hr",
			"social insurance",
			"pension",
			"medical",
			"training",
			"recruit",
		),
		parent_keywords=("payroll", "human resources"),
	),
	ExpenseCategory(
		value="Sales & Marketing",
		label="Sales & Marketing",
		color="#2196F3",
		keywords=(
			"marketing",
			"advertising",
			"campaign",
			"promotion",
			"sales expense",
			"commission",
			"event",
			"exhibition",
			"customer visit",
			"trade show",
			"branding",
			"lead",
		),
		parent_keywords=("sales expenses", "marketing", "commercial"),
	),
	ExpenseCategory(
		value="Logistics",
		label="Logistics & Shipping",
		color="#795548",
		keywords=(
			"logistic",
			"shipping",
			"freight",
			"transport",
			"delivery",
			"courier",
			"customs",
			"duty",
			"warehouse",
			"handling",
			"clearance",
		),
		parent_keywords=("logistics", "transportation"),
	),
	ExpenseCategory(
		value="Production",
		label="Production",
		color="#9C27B0",
		keywords=(
			"factory",
			"production",
			"manufacturing",
			"workshop",
			"machine",
			"tooling",
			"process",
			"plant",
			"fabrication",
			"direct labor",
		),
		parent_keywords=("manufacturing", "production expenses"),
	),
	ExpenseCategory(
		value="Finance & Legal",
		label="Finance & Legal",
		color="#607D8B",
		keywords=(
			"bank charge",
			"interest",
			"finance",
			"loan",
			"legal",
			"law",
			"consult",
			"audit",
			"professional",
			"fees",
			"attorney",
		),
		parent_keywords=("financial expenses", "legal"),
	),
	ExpenseCategory(
		value="IT & Systems",
		label="IT & Systems",
		color="#3F51B5",
		keywords=(
			"it",
			"software",
			"license",
			"subscription",
			"cloud",
			"erp",
			"crm",
			"system",
			"hosting",
			"server",
			"domain",
			"email",
			"hardware",
		),
		parent_keywords=("it expenses", "technology"),
	),
	ExpenseCategory(
		value="Taxes & Government",
		label="Taxes & Government",
		color="#F44336",
		keywords=(
			"tax",
			"vat",
			"withholding",
			"gst",
			"zakat",
			"stamp",
			"duty",
			"gov",
			"government",
			"permit",
			"license",
			"fees",
		),
		parent_keywords=("taxes", "government", "duty"),
	),
	ExpenseCategory(
		value="Capital Expenditure",
		label="Capital Expenditure",
		color="#009688",
		keywords=(
			"capital",
			"capex",
			"asset",
			"improvement",
			"upgrade",
			"renovation",
			"equipment",
			"furniture",
			"construction",
			"fitout",
			"leasehold",
		),
		parent_keywords=("capital expenditure", "fixed asset"),
	),
	ExpenseCategory(
		value="Miscellaneous",
		label="Miscellaneous",
		color="#9E9E9E",
	),
)

DEFAULT_CATEGORY = "Miscellaneous"
HIDDEN_CATEGORY = "Hidden"


def get_expense_category_config() -> tuple[ExpenseCategory, ...]:
	return EXPENSE_CATEGORY_CONFIG


def detect_category(account: Dict[str, Optional[str]]) -> str:
	name = (account.get("name") or "").lower()
	account_name = (account.get("account_name") or "").lower()
	parent = (account.get("parent_account") or "").lower()

	for category in EXPENSE_CATEGORY_CONFIG:
		if category.value == DEFAULT_CATEGORY:
			continue

		if category.account_types and (
			account.get("account_type") or ""
		) in category.account_types:
			return category.value

		if category.keywords and _matches_keyword(name, account_name, category.keywords):
			return category.value

		if category.parent_keywords and any(keyword in parent for keyword in category.parent_keywords):
			return category.value

	return DEFAULT_CATEGORY


def _matches_keyword(name: str, account_name: str, keywords: tuple[str, ...]) -> bool:
	for keyword in keywords:
		if keyword and (keyword in name or keyword in account_name):
			return True
	return False


def fetch_expense_accounts(company: Optional[str] = None) -> List[Dict]:
	"""
	Fetch all expense accounts with their dashboard configuration.
	
	Args:
		company: Company name to filter accounts
		
	Returns:
		List[Dict]: List of account dictionaries with fields:
			- name, account_name, account_currency
			- category (detected or manual)
			- dashboard_sort_order
			
	Example:
		accounts = fetch_expense_accounts("Apex Company")
	"""
	filters = {
		"root_type": "Expense",
		"is_group": 0,
		"disabled": 0,
	}
	if company:
		filters["company"] = company

	fields = [
		"name",
		"account_name",
		"account_currency",
		"parent_account",
		"account_type",
		"company",
		"dashboard_category",
		"dashboard_sort_order",
	]

	accounts = frappe.get_all("Account", filters=filters, fields=fields, order_by="name asc")

	for account in accounts:
		manual_category = (account.get("dashboard_category") or "").strip()
		if manual_category == HIDDEN_CATEGORY:
			account["category"] = HIDDEN_CATEGORY
		elif manual_category:
			account["category"] = manual_category
		else:
			account["category"] = detect_category(account)

		if account.get("dashboard_sort_order") is None:
			account["dashboard_sort_order"] = 0

	return accounts


def get_exchange_rate(currency: str) -> float:
	if not currency or currency.upper() == "EGP":
		return 1.0

	currency = currency.upper()

	try:
		from apex_customization.apex_customization.utils.balance_utils import get_live_exchange_rate_from_api

		live_rate = get_live_exchange_rate_from_api(currency, "EGP")
		if live_rate:
			return flt(live_rate, 4)
	except Exception:
		frappe.log_error(frappe.get_traceback(), "Expense Dashboard - Live Exchange Rate Error")

	try:
		rate = frappe.db.get_value(
			"Currency Exchange",
			{"from_currency": currency, "to_currency": "EGP"},
			"exchange_rate",
		)
		if rate:
			return flt(rate, 4)
	except Exception:
		pass

	default_rates = {
		"USD": 50.0,
		"EUR": 54.5,
		"SAR": 13.3,
		"AED": 13.6,
		"GBP": 63.0,
	}

	return default_rates.get(currency, 1.0)


def get_expense_dashboard_data(
	date: Optional[str] = None,
	company: Optional[str] = None,
	include_zero: bool = False,
	period: Optional[str] = None,
	from_date: Optional[str] = None,
	to_date: Optional[str] = None,
	compare_to_previous: bool = False,
) -> Dict:
	"""
	Get expense dashboard data with categorization and comparison.
	
	Args:
		date: Reference date (default: today)
		company: Company name
		include_zero: Include accounts with zero balance
		period: Time period (monthly, yearly, custom, etc.)
		from_date: Start date for custom period
		to_date: End date for custom period
		compare_to_previous: Enable comparison with previous period
		
	Returns:
		Dict: Dashboard data containing:
			- period: Period details
			- grand_total: Total expenses
			- categories: List of expense categories with totals
			- comparison: Comparison data (if enabled)
			
	Example:
		data = get_expense_dashboard_data(
			company="Apex Company",
			period="This Month",
			compare_to_previous=True
		)
	"""
	period_details = _resolve_period(period or "monthly", date, from_date, to_date)

	accounts = fetch_expense_accounts(company)
	account_names = [acc["name"] for acc in accounts]
	if not account_names:
		return {
			"period": period_details,
			"company": company,
			"grand_total": 0,
			"categories": [],
			"hidden_accounts": [],
			"include_zero": include_zero,
			"company_currency": _get_company_currency(company),
			"comparison": {
				"enabled": bool(compare_to_previous),
				"previous_grand_total": 0,
				"difference": 0,
				"percent_change": 0,
			},
		}

	current_totals = _fetch_gl_totals(
		account_names=account_names,
		from_date=period_details["from_date"],
		to_date=period_details["to_date"],
		company=company,
		account_map={acc["name"]: acc for acc in accounts},
	)

	previous_totals = {}
	if compare_to_previous:
		previous_totals = _fetch_gl_totals(
			account_names=account_names,
			from_date=period_details["previous_from_date"],
			to_date=period_details["previous_to_date"],
			company=company,
			account_map={acc["name"]: acc for acc in accounts},
		)

	category_map: Dict[str, Dict] = {}
	for category in EXPENSE_CATEGORY_CONFIG:
		category_map[category.value] = {
			"key": category.value,
			"label": category.label,
			"color": category.color,
			"accounts": [],
			"total_egp": 0.0,
			"previous_total_egp": 0.0,
			"by_currency": {},
		}

	hidden_accounts: List[Dict] = []
	grand_total = 0.0
	previous_grand_total = 0.0

	base_currency = _get_company_currency(company)

	for account in accounts:
		category_key = account.get("category") or DEFAULT_CATEGORY

		if category_key == HIDDEN_CATEGORY:
			hidden_accounts.append(account)
			continue

		if category_key not in category_map:
			category_key = DEFAULT_CATEGORY

		current = current_totals.get(account["name"], {"amount_base": 0.0, "amount_account": 0.0, "currency": account.get("account_currency")})
		previous = previous_totals.get(account["name"], {"amount_base": 0.0, "amount_account": 0.0, "currency": account.get("account_currency")})

		current_base = flt(current.get("amount_base") or 0.0, 2)
		current_account_amount = flt(current.get("amount_account") or current_base, 2)
		account_currency = (current.get("currency") or account.get("account_currency") or base_currency).upper()

		previous_base = flt(previous.get("amount_base") or 0.0, 2)
		previous_account_amount = flt(previous.get("amount_account") or previous_base, 2)

		if not include_zero and not compare_to_previous and abs(current_base) < 0.01:
			continue

		if not include_zero and compare_to_previous and abs(current_base) < 0.01 and abs(previous_base) < 0.01:
			continue

		account_data = {
			"account": account["name"],
			"account_name": account.get("account_name") or account["name"],
			"company": account.get("company"),
			"balance": current_account_amount,
			"currency": account_currency,
			"balance_in_egp": current_base,
			"sort_order": account.get("dashboard_sort_order") or 0,
			"category": category_key,
			"manual_category": account.get("dashboard_category"),
		}

		if compare_to_previous:
			account_data.update(
				{
					"previous_balance_in_egp": previous_base,
					"previous_balance": previous_account_amount,
					"difference_egp": flt(current_base - previous_base, 2),
					"difference": flt(current_account_amount - previous_account_amount, 2),
				}
			)

		category_bucket = category_map[category_key]
		category_bucket["accounts"].append(account_data)

		category_bucket["total_egp"] += current_base
		if compare_to_previous:
			category_bucket["previous_total_egp"] += previous_base
		category_bucket["by_currency"].setdefault(account_currency, 0.0)
		category_bucket["by_currency"][account_currency] += current_account_amount

		grand_total += current_base
		if compare_to_previous:
			previous_grand_total += previous_base

	categories: List[Dict] = []
	for category in EXPENSE_CATEGORY_CONFIG:
		bucket = category_map[category.value]
		if bucket["accounts"]:
			bucket["accounts"].sort(
				key=lambda item: (item.get("sort_order", 0), item.get("account_name") or item["account"])
			)
			if grand_total:
				bucket["percentage"] = flt((bucket["total_egp"] / grand_total) * 100, 2)
			else:
				bucket["percentage"] = 0.0
			if compare_to_previous:
				prev_total = bucket.get("previous_total_egp") or 0.0
				if abs(prev_total) > 0.01:
					bucket["percent_change"] = flt(((bucket["total_egp"] - prev_total) / prev_total) * 100, 2)
				else:
					bucket["percent_change"] = None
			else:
				bucket["percent_change"] = None
			categories.append(bucket)

	comparison_details = {
		"enabled": bool(compare_to_previous),
		"previous_from_date": str(period_details["previous_from_date"]),
		"previous_to_date": str(period_details["previous_to_date"]),
		"previous_grand_total": flt(previous_grand_total, 2),
		"difference": flt(grand_total - previous_grand_total, 2),
		"percent_change": flt(((grand_total - previous_grand_total) / previous_grand_total) * 100, 2) if compare_to_previous and previous_grand_total else (0.0 if compare_to_previous else None),
		"categories": {},
	}

	if compare_to_previous:
		for bucket in categories:
			prev_total = bucket.get("previous_total_egp", 0.0)
			diff = flt(bucket["total_egp"] - prev_total, 2)
			percent = flt((diff / prev_total) * 100, 2) if abs(prev_total) > 0.01 else None
			comparison_details["categories"][bucket["key"]] = {
				"current": flt(bucket["total_egp"], 2),
				"previous": flt(prev_total, 2),
				"difference": diff,
				"percent_change": percent,
			}
	else:
		comparison_details["categories"] = None

	period_payload = period_details.copy()
	for key in ("from_date", "to_date", "previous_from_date", "previous_to_date"):
		if key in period_payload and period_payload[key]:
			period_payload[key] = str(period_payload[key])

	response = {
		"period": period_payload,
		"company": company,
		"grand_total": flt(grand_total, 2),
		"categories": categories,
		"hidden_accounts": hidden_accounts,
		"include_zero": include_zero,
		"company_currency": base_currency,
		"comparison": comparison_details,
	}

	return response


def _get_company_currency(company: Optional[str]) -> str:
	if company:
		return frappe.db.get_value("Company", company, "default_currency") or frappe.db.get_default("currency") or "EGP"
	return frappe.db.get_default("currency") or "EGP"


def _fetch_gl_totals(
	account_names: List[str],
	from_date,
	to_date,
	company: Optional[str],
	account_map: Dict[str, Dict],
) -> Dict[str, Dict[str, float]]:
	if not account_names:
		return {}

	# Use Query Builder utility for expense accounts (debit only)
	from apex_dashboard.query_utils import get_expense_totals
	
	balances = get_expense_totals(
		accounts=account_names,
		from_date=from_date,
		to_date=to_date,
		company=company,
		group_by_currency=True
	)
	
	# Enrich with currency from account_map if missing
	result: Dict[str, Dict[str, float]] = {}
	for account_name, balance_data in balances.items():
		currency = balance_data.get("currency") or account_map.get(account_name, {}).get("account_currency") or _get_company_currency(account_map.get(account_name, {}).get("company"))
		result[account_name] = {
			"amount_account": balance_data["amount_account"],
			"amount_base": balance_data["amount_base"],
			"currency": currency,
		}

	return result


def _resolve_period(
	period: str,
	date_str: Optional[str],
	from_date: Optional[str],
	to_date: Optional[str],
) -> Dict[str, object]:
	start: Optional[object] = None
	end: Optional[object] = None

	if from_date and to_date:
		start = getdate(from_date)
		end = getdate(to_date)
	elif period == "custom":
		frappe.throw(_("Please set both From Date and To Date for custom period"))
	else:
		reference = getdate(date_str or nowdate())
		if period == "daily":
			start = end = reference
		elif period == "weekly":
			start = reference - timedelta(days=reference.weekday())
			end = start + timedelta(days=6)
		elif period == "monthly":
			start = get_first_day(reference)
			end = get_last_day(reference)
		elif period == "yearly":
			start = get_first_day(reference.replace(month=1, day=1))
			end = get_last_day(add_months(start, 11))
		else:
			start = get_first_day(reference)
			end = get_last_day(reference)

	if start > end:
		frappe.throw(_("From Date cannot be after To Date"))

	duration_days = (end - start).days + 1
	prev_end = start - timedelta(days=1)
	prev_start = prev_end - timedelta(days=duration_days - 1)

	return {
		"type": period,
		"label": _build_period_label(period, start, end),
		"from_date": start,
		"to_date": end,
		"previous_from_date": prev_start,
		"previous_to_date": prev_end,
	}


def _build_period_label(period: str, start, end) -> str:
	if period == "daily":
		return frappe.format(start, {"fieldtype": "Date"})
	if period == "weekly":
		return f"{frappe.format(start, {'fieldtype': 'Date'})} → {frappe.format(end, {'fieldtype': 'Date'})}"
	if period == "monthly":
		return start.strftime("%B %Y")
	if period == "yearly":
		return start.strftime("%Y")
	return f"{frappe.format(start, {'fieldtype': 'Date'})} → {frappe.format(end, {'fieldtype': 'Date'})}"


