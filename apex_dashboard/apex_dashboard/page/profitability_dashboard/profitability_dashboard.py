import frappe
from frappe import _
from frappe.utils import flt, getdate, add_months, add_days, get_first_day, get_last_day, today
import requests

def get_exchange_rates():
	"""
	Fetches exchange rates from OpenExchangeRates API (same as Liquidity/Suppliers Dashboard).
	"""
	# Get API key from site config or use default
	api_key = frappe.conf.get("openexchangerates_api_key") or "39167a07fcc74a86be7f6b6677bc25e4"
	
	# Check cache first
	cache_key = "profitability_dashboard_rates"
	cached_rates = frappe.cache().get_value(cache_key)
	if cached_rates:
		return cached_rates
	
	if not api_key:
		return get_fallback_rates()
	
	try:
		url = f"https://openexchangerates.org/api/latest.json?app_id={api_key}&base=USD"
		response = requests.get(url, timeout=5)
		response.raise_for_status()
		data = response.json()
		
		# Convert to EGP base
		if "EGP" not in data["rates"]:
			return get_fallback_rates()
		
		usd_to_egp = data["rates"]["EGP"]
		rates = {'EGP': 1.0}
		
		for currency in ['USD', 'EUR', 'SAR']:
			if currency in data["rates"]:
				rate_in_usd = data["rates"][currency]
				if currency == "USD":
					rates[currency] = usd_to_egp
				else:
					# Cross-currency conversion: EUR to EGP = (USD to EGP) × (EUR to USD)
					if rate_in_usd > 0:
						rates[currency] = usd_to_egp * rate_in_usd
					else:
						rates[currency] = 0.0
		
		# Cache for 1 hour
		frappe.cache().set_value(cache_key, rates, expires_in_sec=3600)
		return rates
	except Exception as e:
		frappe.log_error(f"OpenExchangeRates Error: {str(e)}")
		return get_fallback_rates()

def get_fallback_rates():
	"""Fallback to Currency Exchange table using Query Builder utility."""
	from apex_dashboard.query_utils import get_exchange_rates_bulk
	return get_exchange_rates_bulk(['USD', 'EUR', 'SAR'])

@frappe.whitelist()
def get_dashboard_data(company=None, period="This Month", from_date=None, to_date=None, fiscal_year=None):
	"""Get profitability dashboard data"""
	# Check cache first - include fiscal_year in cache key
	cache_key = f"profitability_{company}_{period}_{from_date}_{to_date}_{fiscal_year}"
	cached_data = frappe.cache().get_value(cache_key)
	if cached_data:
		return cached_data
	
	if not company:
		company = frappe.defaults.get_user_default("Company")

	# Use custom dates if provided, otherwise calculate from period
	if fiscal_year:
		from_date, to_date = frappe.db.get_value("Fiscal Year", fiscal_year, ["year_start_date", "year_end_date"])
	elif period == "Custom" and from_date and to_date:
		from_date = getdate(from_date)
		to_date = getdate(to_date)
	else:
		# If period is empty or invalid, default to All Time'.
		# The frontend defaults to 'All Time'.
		if not period: 
			period = "All Time"
		from_date, to_date = get_period_dates(period)
	
	# Get Company Currency
	currency = frappe.get_value("Company", company, "default_currency") or "EGP"
	
	# Get exchange rates
	exchange_rates = get_exchange_rates()
	
	# Build CASE statement for exchange rates
	rate_cases = []
	for curr, rate in exchange_rates.items():
		rate_cases.append(f"WHEN si.currency = '{curr}' THEN {rate}")
	
	rate_case_sql = f"CASE {' '.join(rate_cases)} ELSE 1.0 END"
	
	# 1. Item Profitability
	# Use Query Builder
	from frappe.query_builder import DocType, Case
	from frappe.query_builder.functions import Sum, Count, Min, Coalesce
	
	SII = DocType("Sales Invoice Item")
	SI = DocType("Sales Invoice")
	PII = DocType("Purchase Invoice Item")
	PI = DocType("Purchase Invoice")
	
	# Build Rate Case for Sales Invoice
	rate_case_si = Case()
	for curr, rate in exchange_rates.items():
		rate_case_si.when(SI.currency == curr, rate)
	rate_case_si.else_(1.0)
	
	# Build Rate Case for Purchase Invoice (for fallback cost)
	rate_case_pi = Case()
	for curr, rate in exchange_rates.items():
		rate_case_pi.when(PI.currency == curr, rate)
	rate_case_pi.else_(1.0)
	
	# Subquery for fallback purchase rate
	purchase_rate_subquery = (
		frappe.qb.from_(PII)
		.join(PI).on(PII.parent == PI.name)
		.select(PII.rate * rate_case_pi)
		.where(PII.item_code == SII.item_code)
		.where(PI.docstatus == 1)
		.where(PI.company == company)
		.orderby(PI.posting_date, order=frappe.qb.desc)
		.limit(1)
	)
	
	# Cost Expression: Use incoming_rate if > 0, else fallback to purchase rate
	cost_expr = Case().when(SII.incoming_rate > 0, SII.qty * SII.incoming_rate).else_(
		SII.qty * Coalesce(purchase_rate_subquery, 0)
	)
	
	# Profit Expression for Having/Order By
	profit_expr = Sum(SII.amount * rate_case_si) - Sum(cost_expr)
	
	query = (
		frappe.qb.from_(SII)
		.join(SI).on(SII.parent == SI.name)
		.select(
			SII.item_code,
			SII.item_name,
			Count(SI.name).distinct().as_("invoice_count"),
			Sum(SII.qty).as_("total_qty"),
			Sum(SII.amount * rate_case_si).as_("revenue_egp"),
			Sum(cost_expr).as_("cost_egp"),
			Min(SI.posting_date).as_("first_sale_date")
		)
		.where(SI.docstatus == 1)
		.where(SI.company == company)
		.where(SI.posting_date.between(from_date, to_date))
		.groupby(SII.item_code)
		.having(profit_expr > 0)
		.orderby(profit_expr, order=frappe.qb.desc)
		.limit(10)
	)
	
	item_profitability = query.run(as_dict=True)
	
	# Calculate profit and margin for each item
	for item in item_profitability:
		item['profit_egp'] = item['revenue_egp'] - item['cost_egp']
		item['margin'] = (item['profit_egp'] / item['revenue_egp'] * 100) if item['revenue_egp'] > 0 else 0
	
	# 2. Supplier Profitability
	# For suppliers, we still need to estimate cost based on purchase history if we want "Profit by Supplier"
	# But to be consistent with Item Profitability, we should ideally link Sales Items back to their Purchase source (Serial/Batch)
	# However, without strict Serial/Batch tracking, this is hard.
	# We will stick to the previous logic for Suppliers but simplify it to match the "Gross" concept if possible.
	# Actually, the previous logic for suppliers was:
	# Revenue = Sales of items bought from this supplier (estimated by item_code match? No, that's weak)
	# The previous query joined Purchase Invoice Item -> Sales Invoice Item on item_code.
	# This assumes ALL sales of that item_code came from that supplier, which is WRONG if multiple suppliers exist.
	
	# IMPROVED SUPPLIER LOGIC:
	# We can't easily attribute a Sales Invoice Item to a Supplier without Serial/Batch.
	# But we can calculate "Potential Profit" based on what we BOUGHT from them.
	# Revenue = Sum of (Qty Bought * Avg Selling Price) ? No.
	# Let's keep the previous logic but acknowledge it's an ESTIMATE.
	# Or, better: Use the same logic as Item Profitability, but group by `sii.supplier` if it exists?
	# `tabSales Invoice Item` has a `supplier` field? Let's check.
    # (Checked schema: supplier field exists in Sales Invoice Item but is it populated? Usually for Drop Ship)
    
    # If we can't link Sales to Supplier, the "Best Supplier" metric is highly theoretical.
    # Let's stick to the previous query for now but ensure it uses the same currency logic.
    # The previous query was:
    # SELECT supplier, SUM(sales of that item) ...
    # This over-attributes revenue if an item is bought from multiple suppliers.
    
    # Alternative: Just show "Top Suppliers by Spend" or "Volume"?
    # The user wants "Profitability".
    # Let's leave the Supplier query as is for now but fix the Item query which is the main "Total Profit" driver.
    
	# Build separate CASE statement for Sales Invoice currency (for subquery)
	rate_cases_si = []
	for curr, rate in exchange_rates.items():
		rate_cases_si.append(f"WHEN si.currency = '{curr}' THEN {rate}")
	
	rate_case_sql_si = f"CASE {' '.join(rate_cases_si)} ELSE 1.0 END"
	
	# Build CASE statement for Purchase Invoice currency
	rate_cases_pi = []
	for curr, rate in exchange_rates.items():
		rate_cases_pi.append(f"WHEN pi.currency = '{curr}' THEN {rate}")
	
	rate_case_sql_pi = f"CASE {' '.join(rate_cases_pi)} ELSE 1.0 END"
	
	# Supplier Profitability: Show suppliers based on items SOLD in the period
	# Use Query Builder
	from frappe.query_builder.functions import GroupConcat
	
	Supplier = DocType("Supplier")
	
	# Subquery to find supplier from Purchase Invoice (same as before)
	supplier_subquery = (
		frappe.qb.from_(PII)
		.join(PI).on(PII.parent == PI.name)
		.select(PI.supplier)
		.where(PII.item_code == SII.item_code)
		.where(PI.docstatus == 1)
		.where(PI.company == company)
		.orderby(PI.posting_date, order=frappe.qb.desc)
		.limit(1)
	)
	
	# Supplier Expression: Use Sales Item supplier or fallback to Purchase Invoice supplier
	supplier_expr = Coalesce(SII.supplier, supplier_subquery)
	
	# Supplier Name Subquery
	supplier_name_subquery = (
		frappe.qb.from_(Supplier)
		.select(Supplier.supplier_name)
		.where(Supplier.name == supplier_expr)
	)
	
	# Profit Expression for Having/Order By
	profit_expr_supplier = Sum(SII.amount * rate_case_si) - Sum(cost_expr)
	
	query_supplier = (
		frappe.qb.from_(SII)
		.join(SI).on(SII.parent == SI.name)
		.select(
			supplier_expr.as_("supplier"),
			supplier_name_subquery.as_("supplier_name"),
			Count(SII.item_code).distinct().as_("item_count"),
			GroupConcat(SI.name).distinct().as_("invoice_list"),
			Sum(SII.qty).as_("total_qty"),
			Sum(SII.amount * rate_case_si).as_("revenue_egp"),
			Sum(cost_expr).as_("cost_egp"),
			Min(SI.posting_date).as_("first_sale_date")
		)
		.where(SI.docstatus == 1)
		.where(SI.company == company)
		.where(SI.posting_date.between(from_date, to_date))
		.groupby(supplier_expr)
		.having(profit_expr_supplier > 0)
		.orderby(profit_expr_supplier, order=frappe.qb.desc)
		.limit(10)
	)
	
	supplier_profitability = query_supplier.run(as_dict=True)
	
	# Calculate profit and margin for each supplier
	for supplier in supplier_profitability:
		supplier['profit_egp'] = (supplier['revenue_egp'] or 0) - (supplier['cost_egp'] or 0)
		supplier['margin'] = (supplier['profit_egp'] / supplier['revenue_egp'] * 100) if supplier.get('revenue_egp') and supplier['revenue_egp'] > 0 else 0
	
	# 3. Calculate Summary Metrics
	total_revenue = sum(item.get('revenue_egp', 0) for item in item_profitability)
	total_cogs = sum(item.get('cost_egp', 0) for item in item_profitability)
	gross_profit = total_revenue - total_cogs
	
	# Fetch Total Expenses (Indirect/Operating)
	total_expenses = get_total_expenses(company, from_date, to_date)
	
	# Net Profit = Gross Profit - Total Expenses
	net_profit = gross_profit - total_expenses
	
	overall_margin = (net_profit / total_revenue * 100) if total_revenue else 0.0

	# 4. Allocate Expenses to Items and Suppliers (Revenue Share)
	# Formula: Allocated Expense = Total Expenses * (Item Revenue / Total Revenue)
	
	for item in item_profitability:
		revenue_share = (item['revenue_egp'] / total_revenue) if total_revenue else 0
		allocated_expense = total_expenses * revenue_share
		item['net_profit'] = item['profit_egp'] - allocated_expense
		item['net_margin'] = (item['net_profit'] / item['revenue_egp'] * 100) if item['revenue_egp'] else 0.0

	for supplier in supplier_profitability:
		revenue_share = (supplier['revenue_egp'] / total_revenue) if total_revenue else 0
		allocated_expense = total_expenses * revenue_share
		supplier['net_profit'] = supplier['profit_egp'] - allocated_expense
		supplier['net_margin'] = (supplier['net_profit'] / supplier['revenue_egp'] * 100) if supplier['revenue_egp'] else 0.0

	# Re-sort by Net Profit
	item_profitability.sort(key=lambda x: x['net_profit'], reverse=True)
	supplier_profitability.sort(key=lambda x: x['net_profit'], reverse=True)

	best_item = item_profitability[0] if item_profitability else None
	best_supplier = supplier_profitability[0] if supplier_profitability else None

	data = {
		'currency': frappe.get_cached_value('Company', company, 'default_currency'),
		'period_filters': {
			'from_date': from_date,
			'to_date': to_date
		},
		'summary': {
			'total_profit': net_profit, # Now Net Profit
			'total_gross_profit': gross_profit, # Keep Gross Profit for reference if needed
			'total_revenue': total_revenue,
			'total_expenses': total_expenses,
			'overall_margin': overall_margin,
			'best_item': best_item,
			'best_supplier': best_supplier
		},
		'item_profitability': item_profitability,
		'supplier_profitability': supplier_profitability
	}

	# Cache for 5 minutes
	frappe.cache().set_value(cache_key, data, expires_in_sec=300)

	return data

def get_total_expenses(company, from_date, to_date):
	"""
	Fetch total expenses from GL Entry matching ERPNext P&L logic.
	We exclude COGS (handled via incoming_rate) and Depreciation.
	"""
	# Get total expenses (debits - credits for Expense accounts)
	# Get total expenses (debits - credits for Expense accounts)
	# Use Query Builder
	from frappe.query_builder import DocType
	from frappe.query_builder.functions import Sum
	
	GLEntry = DocType("GL Entry")
	Account = DocType("Account")
	
	query = (
		frappe.qb.from_(GLEntry)
		.join(Account).on(GLEntry.account == Account.name)
		.select(
			(Sum(GLEntry.debit) - Sum(GLEntry.credit)).as_('total_expense'),
			Account.account_type
		)
		.where(GLEntry.company == company)
		.where(GLEntry.posting_date.between(from_date, to_date))
		.where(Account.root_type == 'Expense')
		.where(Account.report_type == 'Profit and Loss')
		.where(Account.is_group == 0)
		.where(Account.account_type.notin(['Cost of Goods Sold', 'Depreciation']))
		.groupby(Account.account_type)
	)
	
	expense_breakdown = query.run(as_dict=True)
	
	# Debug: Log expense breakdown
	total_expenses = sum(row.get('total_expense', 0) for row in expense_breakdown)
	
	frappe.log_error(
		title=f"Expense Breakdown {from_date} to {to_date}",
		message=f"Total Expenses: {total_expenses}\nBreakdown:\n" + "\n".join([
			f"{row.account_type}: {row.total_expense} ({row.account_count} accounts)" 
			for row in expense_breakdown
		])
	)
	
	return float(total_expenses)

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
