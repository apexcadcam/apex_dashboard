from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate
from erpnext.accounts.utils import get_balance_on
from erpnext.setup.utils import get_exchange_rate


@dataclass(frozen=True)
class AccountBalance:
	account: str
	balance: float
	currency: str
	base_balance: float


_ACCOUNT_MAP_CACHE_KEY = "apex_dashboard:dashboard_account_groups"


def _get_account_groups_path() -> Path:
	app_path = Path(frappe.get_app_path("apex_dashboard"))
	return app_path / "config" / "dashboard_account_groups.json"


def get_dashboard_account_groups() -> Dict[str, Dict[str, object]]:
	cache = frappe.cache()
	cached = cache.get_value(_ACCOUNT_MAP_CACHE_KEY)
	if cached:
		try:
			return frappe.parse_json(cached)
		except Exception:
			cache.delete_value(_ACCOUNT_MAP_CACHE_KEY)

	path = _get_account_groups_path()
	if not path.exists():
		raise FileNotFoundError(_("Dashboard account group mapping is missing at {0}").format(path))

	with path.open("r", encoding="utf-8") as handle:
		data = json.load(handle)

	cache.set_value(_ACCOUNT_MAP_CACHE_KEY, frappe.as_json(data), expires_in_sec=3600)
	return data


def clear_account_group_cache() -> None:
	frappe.cache().delete_value(_ACCOUNT_MAP_CACHE_KEY)


@lru_cache(maxsize=8)
def get_company_currency(company: Optional[str]) -> str:
	if not company:
		return frappe.defaults.get_global_default("currency") or "EGP"
	return frappe.get_cached_value("Company", company, "default_currency") or "EGP"


def get_accounts_for_section(section: str) -> Dict[str, object]:
	groups = get_dashboard_account_groups()
	return groups.get(section, {})


def get_balances_for_accounts(
	accounts: Sequence[str],
	company: Optional[str] = None,
	posting_date: Optional[str] = None,
) -> List[AccountBalance]:
	if not accounts:
		return []

	posting_date = posting_date or nowdate()
	posting_date = str(getdate(posting_date))
	company_currency = get_company_currency(company)

	results: List[AccountBalance] = []
	for account in accounts:
		if not account:
			continue

		try:
			amount = flt(
				get_balance_on(
					company=company,
					account=account,
					date=posting_date,
					in_account_currency=True,
				)
			)
		except Exception:
			frappe.log_error(frappe.get_traceback(), f"Apex Dashboard: Balance fetch failed for {account}")
			continue

		account_currency = frappe.get_cached_value("Account", account, "account_currency") or company_currency
		base_amount = convert_to_company_currency(amount, account_currency, company_currency, posting_date)

		results.append(
			AccountBalance(
				account=account,
				balance=amount,
				currency=account_currency,
				base_balance=base_amount,
			)
		)

	return results


def convert_to_company_currency(
	amount: float,
	from_currency: str,
	to_currency: str,
	posting_date: Optional[str] = None,
) -> float:
	if not amount:
		return 0.0
	if not from_currency or from_currency == to_currency:
		return flt(amount)

	posting_date = posting_date or nowdate()

	try:
		rate = get_exchange_rate(from_currency, to_currency, posting_date=posting_date)
	except Exception:
		frappe.log_error(
			frappe.get_traceback(),
			f"Apex Dashboard: Exchange rate fetch failed {from_currency}->{to_currency}",
		)
		rate = 1

	return flt(amount) * flt(rate)


def summarize_balances_by_currency(entries: Iterable[AccountBalance]) -> Dict[str, float]:
	totals: Dict[str, float] = {}
	for row in entries:
		totals.setdefault(row.currency, 0.0)
		totals[row.currency] += flt(row.balance)
	return totals


def summarize_base_total(entries: Iterable[AccountBalance]) -> float:
	return sum(flt(row.base_balance) for row in entries)


def get_section_summary(
	section: str,
	company: Optional[str] = None,
	posting_date: Optional[str] = None,
) -> Dict[str, object]:
	raw_mapping = get_accounts_for_section(section)
	if not raw_mapping:
		return {"groups": {}, "totals": {}}

	groups: Dict[str, object] = {}
	for group_name, descriptor in raw_mapping.items():
		group_accounts: Sequence[str] = []

		if isinstance(descriptor, dict) and "accounts" in descriptor:
			group_accounts = descriptor.get("accounts") or []
		elif isinstance(descriptor, (list, tuple)):
			group_accounts = descriptor
		elif isinstance(descriptor, str):
			group_accounts = [descriptor]
		else:
			groups[group_name] = {"balances": [], "totals": {}}
			continue

		balances = get_balances_for_accounts(group_accounts, company=company, posting_date=posting_date)
		totals = {
			"by_currency": summarize_balances_by_currency(balances),
			"base": summarize_base_total(balances),
		}

		groups[group_name] = {
			"accounts": group_accounts,
			"balances": [balance.__dict__ for balance in balances],
			"totals": totals,
		}

	return {
		"section": section,
		"company_currency": get_company_currency(company),
		"posting_date": str(getdate(posting_date or nowdate())),
		"groups": groups,
	}

