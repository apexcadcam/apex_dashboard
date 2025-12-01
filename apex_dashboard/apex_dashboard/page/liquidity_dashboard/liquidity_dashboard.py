import frappe
from frappe import _
import requests
import json
from frappe.utils import flt, nowdate, add_days, getdate, get_first_day, get_last_day, add_months, today
from erpnext.accounts.utils import get_balance_on

def get_period_dates(period):
	current_date = getdate(today())
	
	if period == "Today":
		return current_date, current_date
	elif period == "This Week":
		start = add_days(current_date, -current_date.weekday())
		end = add_days(start, 6)
		return start, end
	elif period == "This Month":
		return get_first_day(current_date), get_last_day(current_date)
	elif period == "Last Month":
		last_month = add_months(current_date, -1)
		return get_first_day(last_month), get_last_day(last_month)
	elif period == "This Year":
		return getdate(f"{current_date.year}-01-01"), getdate(f"{current_date.year}-12-31")
	elif period == "Last Year":
		last_year = current_date.year - 1
		return getdate(f"{last_year}-01-01"), getdate(f"{last_year}-12-31")
	elif period == "All Time":
		return getdate("2000-01-01"), current_date
	else:
		return get_first_day(current_date), get_last_day(current_date)

@frappe.whitelist()
def get_dashboard_data(company=None, period="Today", from_date=None, to_date=None, fiscal_year=None):
	"""
	Get liquidity dashboard data with account grouping and live exchange rates.
	Data is cached for 5 minutes for better performance.
	"""
	# Check cache first
	from apex_dashboard.cache_utils import get_cached_dashboard_data, set_dashboard_cache
	
	cache_key = f"liquidity_{company}_{period}_{from_date}_{to_date}_{fiscal_year}"
	cached_data = frappe.cache().get_value(cache_key)
	if cached_data:
		return cached_data
	
	if not company:
		company = frappe.defaults.get_user_default("Company") or "APEX"

	# Determine Date Range (we mainly use to_date for balances)
	if fiscal_year:
		from_date, to_date = frappe.db.get_value("Fiscal Year", fiscal_year, ["year_start_date", "year_end_date"])
	elif period == "Custom" and from_date and to_date:
		from_date = getdate(from_date)
		to_date = getdate(to_date)
	else:
		if not period:
			period = "Today"
		from_date, to_date = get_period_dates(period)
	
	# 1. Get API Key from site config
	api_key = frappe.conf.get("openexchangerates_api_key")
	
	# 2. Get Rates
	rates = get_exchange_rates(api_key)
	
	data = {
		"groups": [],
		"total_liquidity": 0.0,
		"last_updated": frappe.utils.now(),
		"period": {
			"from_date": from_date,
			"to_date": to_date
		}
	}

	# 3. Fetch Bank and Cash Accounts directly (Standalone Mode)
	from apex_dashboard.query_utils import get_gl_balances
	
	# Fetch all Bank and Cash accounts
	accounts = frappe.db.get_all("Account", 
		filters={
			"account_type": ["in", ["Bank", "Cash"]],
			"is_group": 0,
			"company": company,
			"disabled": 0
		},
		fields=["name", "account_name", "account_currency", "parent_account", "account_type"]
	)
	
	if not accounts:
		return data

	# Get parent account names for better labeling
	parent_names = {}
	parent_ids = list(set([acc["parent_account"] for acc in accounts if acc["parent_account"]]))
	
	if parent_ids:
		parents = frappe.db.get_all("Account",
			filters={"name": ["in", parent_ids]},
			fields=["name", "account_name"]
		)
		for p in parents:
			parent_names[p["name"]] = p["account_name"]

	# Group by Parent Account
	grouped_accounts = {}
	
	for acc in accounts:
		parent_id = acc["parent_account"]
		# Use parent name if available, otherwise parent ID, otherwise "Other"
		group_name = parent_names.get(parent_id, parent_id)
		
		# Clean up group name (remove "- AP" suffix if present)
		if group_name.endswith(" - AP"):
			group_name = group_name[:-5]
			
		if group_name not in grouped_accounts:
			grouped_accounts[group_name] = {
				"name": group_name,
				"type": acc["account_type"],
				"accounts": []
			}
		
		grouped_accounts[group_name]["accounts"].append(acc)

	# Get balances as of to_date
	account_names = [acc["name"] for acc in accounts]
	# We use "2000-01-01" as start date to get full balance up to to_date
	balances = get_gl_balances(account_names, "2000-01-01", to_date, group_by_currency=True)
	
	# Color palette for cards
	colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#6366f1"]
	color_idx = 0

	for group_name, group_info in grouped_accounts.items():
		group_data = {
			"name": group_name,
			"total_egp": 0.0,
			"accounts": [],
			"color": colors[color_idx % len(colors)],
			"icon": "fa fa-university" if group_info["type"] == "Bank" else "fa fa-money"
		}
		color_idx += 1
		
		for acc in group_info["accounts"]:
			acc_name = acc["name"]
			balance_data = balances.get(acc_name, {})
			
			# Skip zero balance accounts
			balance = balance_data.get("amount_account", 0.0)
			if abs(balance) < 0.01:
				continue
				
			currency = acc["account_currency"]
			rate = rates.get(currency, 1.0)
			if currency == "EGP":
				rate = 1.0
				
			balance_egp = flt(balance) * flt(rate)
			
			group_data["accounts"].append({
				"name": acc["account_name"],
				"currency": currency,
				"balance": balance,
				"rate": rate,
				"balance_egp": balance_egp
			})
			
			group_data["total_egp"] += balance_egp
			
		if group_data["accounts"]:
			data["groups"].append(group_data)
			data["total_liquidity"] += group_data["total_egp"]

	# Sort by Total EGP descending
	data["groups"].sort(key=lambda x: x["total_egp"], reverse=True)
	
	# Calculate Metrics for Dashboard
	metrics = calculate_metrics(data["groups"], data["total_liquidity"])
	data["metrics"] = metrics
	
	# Cache the result for 5 minutes
	frappe.cache().set_value(cache_key, data, expires_in_sec=300)
	
	return data

def get_exchange_rates(api_key):
	"""
	Fetches exchange rates from OpenExchangeRates or cache.
	"""
	cache_key = "liquidity_dashboard_rates"
	cached_rates = frappe.cache().get_value(cache_key)
	
	if cached_rates:
		return cached_rates
		
	if not api_key:
		return get_erpnext_rates()

	try:
		url = f"https://openexchangerates.org/api/latest.json?app_id={api_key}&base=USD"
		response = requests.get(url, timeout=5)
		response.raise_for_status()
		data = response.json()
		
		# Convert to EGP base
		if "EGP" not in data["rates"]:
			 return get_erpnext_rates()

		usd_to_egp = data["rates"]["EGP"]
		rates = {}
		for currency, rate_in_usd in data["rates"].items():
			# 1 USD = X EGP
			# 1 Currency = (1/rate_in_usd) USD = (1/rate_in_usd) * usd_to_egp EGP
			if currency == "USD":
				rates[currency] = usd_to_egp
			else:
				if rate_in_usd > 0:
					rates[currency] = usd_to_egp / rate_in_usd
				else:
					rates[currency] = 0.0
					
		frappe.cache().set_value(cache_key, rates, expires_in_sec=3600) # Cache for 1 hour
		return rates
	except Exception as e:
		frappe.log_error(f"OpenExchangeRates Error: {str(e)}")
		return get_erpnext_rates()

def get_erpnext_rates():
	"""
	Fallback to fetch rates from Currency Exchange in ERPNext.
	"""
	from erpnext.setup.utils import get_exchange_rate
	
	rates = {}
	currencies = frappe.db.get_all("Currency", pluck="name")
	for currency in currencies:
		if currency == "EGP":
			rates[currency] = 1.0
			continue
			
		try:
			rate = get_exchange_rate(currency, "EGP")
			rates[currency] = rate if rate else 1.0
		except Exception:
			rates[currency] = 1.0
	return rates

def calculate_metrics(groups, total_liquidity):
	"""
	Calculate key metrics for dashboard.
	"""
	if not groups or total_liquidity == 0:
		return {
			"total_liquidity": 0,
			"largest_bank": {"name": "N/A", "amount": 0, "percentage": 0},
			"foreign_currency": {"percentage": 0, "amount": 0, "count": 0},
			"bank_count": {"total": 0, "active": 0},
			"chart_data": {"series": [], "labels": [], "colors": []}
		}
	
	# Find largest bank
	largest = max(groups, key=lambda x: x["total_egp"])
	largest_bank = {
		"name": largest["name"],
		"amount": largest["total_egp"],
		"percentage": round((largest["total_egp"] / total_liquidity * 100), 2) if total_liquidity > 0 else 0
	}
	
	# Calculate foreign currency stats
	foreign_amount = 0
	foreign_currencies = set()
	
	for group in groups:
		for account in group.get("accounts", []):
			currency = account.get("currency", "EGP")
			if currency != "EGP":
				foreign_amount += account.get("balance_egp", 0)
				foreign_currencies.add(currency)
	
	foreign_currency = {
		"percentage": round((foreign_amount / total_liquidity * 100), 2) if total_liquidity > 0 else 0,
		"amount": foreign_amount,
		"count": len(foreign_currencies)
	}
	
	# Bank count
	bank_count = {
		"total": len(groups),
		"active": len(groups)  # All groups in list are active
	}
	
	# Chart data
	chart_data = {
		"series": [round(group["total_egp"], 2) for group in groups],
		"labels": [group["name"] for group in groups],
		"colors": [group.get("color", "#3b82f6") for group in groups]
	}
	
	return {
		"total_liquidity": round(total_liquidity, 2),
		"largest_bank": largest_bank,
		"foreign_currency": foreign_currency,
		"bank_count": bank_count,
		"chart_data": chart_data
	}
