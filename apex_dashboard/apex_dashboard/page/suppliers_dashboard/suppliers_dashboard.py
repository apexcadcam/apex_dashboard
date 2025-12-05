import frappe
from frappe import _
from frappe.utils import flt, getdate, add_months, add_days, get_first_day, get_last_day, today
import requests

def get_exchange_rates():
	"""
	Fetches exchange rates from OpenExchangeRates API (same as Liquidity Dashboard).
	"""
	# Get API key from site config
	api_key = frappe.conf.get("openexchangerates_api_key")
	
	# Check cache first
	cache_key = "suppliers_dashboard_rates"
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
						rates[currency] = usd_to_egp / rate_in_usd
					else:
						rates[currency] = 0.0
		
		# Cache for 1 hour
		frappe.cache().set_value(cache_key, rates, expires_in_sec=3600)
		return rates
	except Exception as e:
		# Log error but don't fail if log fails (e.g., error message too long)
		try:
			error_msg = str(e)[:100]  # Truncate to 100 chars to avoid "Title too long" error
			frappe.log_error(f"OpenExchangeRates API Error: {error_msg}", "Exchange Rates Error")
		except:
			pass  # Silently ignore log errors
		return get_fallback_rates()

def get_fallback_rates():
	"""Fallback to Currency Exchange table."""
	rates = {'EGP': 1.0}
	for curr in ['USD', 'EUR', 'SAR']:
		# Get latest exchange rate
		rate_data = frappe.db.sql("""
			SELECT exchange_rate 
			FROM `tabCurrency Exchange`
			WHERE from_currency = %s 
				AND to_currency = 'EGP'
				AND for_selling = 1
			ORDER BY date DESC
			LIMIT 1
		""", curr, as_dict=1)
		
		if rate_data and len(rate_data) > 0:
			rates[curr] = flt(rate_data[0].get('exchange_rate'))
		else:
			# Hard defaults
			if curr == 'USD':
				rates[curr] = 50.0
			elif curr == 'EUR':
				rates[curr] = 55.0
			elif curr == 'SAR':
				rates[curr] = 13.0
	return rates

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
def get_dashboard_data(company=None, period="All Time", from_date=None, to_date=None, fiscal_year=None):
	"""Get comprehensive supplier dashboard data"""
	if not company:
		company = frappe.defaults.get_user_default("Company")
	
	# Determine Date Range
	if fiscal_year:
		from_date, to_date = frappe.db.get_value("Fiscal Year", fiscal_year, ["year_start_date", "year_end_date"])
	elif period == "Custom" and from_date and to_date:
		from_date = getdate(from_date)
		to_date = getdate(to_date)
	else:
		if not period:
			period = "All Time"
		from_date, to_date = get_period_dates(period)
	
	currency = frappe.get_value("Company", company, "default_currency") or "EGP"
	
	# Get exchange rates
	exchange_rates = get_exchange_rates()
	
	# 1. Total Payables (Outstanding Purchase Invoices) - Grouped by Currency
	# Filter by posting_date to show outstanding invoices FROM that period
	payables_data = frappe.db.sql("""
		SELECT 
			pi.supplier,
			s.supplier_name,
			s.supplier_group,
			pi.currency,
			COUNT(DISTINCT pi.name) as invoice_count,
			SUM(pi.outstanding_amount) as outstanding,
			SUM(pi.grand_total) as total_amount
		FROM `tabPurchase Invoice` pi
		JOIN `tabSupplier` s ON pi.supplier = s.name
		WHERE pi.docstatus = 1
			AND pi.company = %s
			AND pi.outstanding_amount > 0
			AND s.disabled = 0
			AND pi.posting_date BETWEEN %s AND %s
		GROUP BY pi.supplier, pi.currency
		ORDER BY pi.currency, outstanding DESC
	""", (company, from_date, to_date), as_dict=1)
	
	# Group by currency
	payables_by_currency = {}
	total_payables_egp = 0  # Total in EGP
	payables_breakdown = {}  # Breakdown by currency
	
	for d in payables_data:
		curr = d.get('currency') or 'EGP'
		if curr not in payables_by_currency:
			payables_by_currency[curr] = {
				'total': 0,
				'count': 0,
				'details': []
			}
		payables_by_currency[curr]['total'] += d.get('outstanding', 0)
		payables_by_currency[curr]['count'] += d.get('invoice_count', 0)
		payables_by_currency[curr]['details'].append(d)
		
		# Add to breakdown
		if curr not in payables_breakdown:
			payables_breakdown[curr] = 0
		payables_breakdown[curr] += d.get('outstanding', 0)
		
		# Add to total in EGP
		total_payables_egp += d.get('outstanding', 0) * exchange_rates.get(curr, 1.0)
	
	# Calculate Total Purchase Volume (all invoices, not just outstanding)
	total_purchase_data = frappe.db.sql("""
		SELECT 
			pi.currency,
			SUM(pi.grand_total) as total
		FROM `tabPurchase Invoice` pi
		WHERE pi.docstatus = 1
			AND pi.company = %s
			AND pi.posting_date BETWEEN %s AND %s
		GROUP BY pi.currency
	""", (company, from_date, to_date), as_dict=1)
	
	total_purchase_egp = 0
	purchase_breakdown = {}  # Breakdown by currency
	
	for d in total_purchase_data:
		curr = d.get('currency') or 'EGP'
		purchase_breakdown[curr] = d.get('total', 0)
		total_purchase_egp += d.get('total', 0) * exchange_rates.get(curr, 1.0)
	
	# 2. Total Paid (Payment Entries)
	paid_data = frappe.db.sql("""
		SELECT 
			pe.party as supplier,
			s.supplier_name,
			COUNT(DISTINCT pe.name) as payment_count,
			SUM(pe.paid_amount) as paid_amount
		FROM `tabPayment Entry` pe
		JOIN `tabSupplier` s ON pe.party = s.name
		WHERE pe.docstatus = 1
			AND pe.company = %s
			AND pe.party_type = 'Supplier'
			AND pe.payment_type = 'Pay'
			AND pe.posting_date BETWEEN %s AND %s
			AND s.disabled = 0
		GROUP BY pe.party
		ORDER BY paid_amount DESC
	""", (company, from_date, to_date), as_dict=1)
	
	total_paid = sum(d.get('paid_amount', 0) for d in paid_data)
	paid_count = sum(d.get('payment_count', 0) for d in paid_data)
	
	# 3. Active Suppliers (with transactions in period)
	active_suppliers = frappe.db.sql("""
		SELECT DISTINCT pi.supplier, s.supplier_name, s.supplier_group
		FROM `tabPurchase Invoice` pi
		JOIN `tabSupplier` s ON pi.supplier = s.name
		WHERE pi.docstatus = 1
			AND pi.company = %s
			AND pi.posting_date BETWEEN %s AND %s
			AND s.disabled = 0
		ORDER BY s.supplier_name
	""", (company, from_date, to_date), as_dict=1)
	
	# Group by supplier group
	supplier_groups = {}
	for sup in active_suppliers:
		group = sup.get('supplier_group') or 'Other'
		if group not in supplier_groups:
			supplier_groups[group] = []
		supplier_groups[group].append({
			'name': sup.get('supplier_name'),
			'code': sup.get('supplier')
		})
	
	# 4. Overdue Payments - Grouped by Currency
	overdue_data = frappe.db.sql("""
		SELECT 
			pi.supplier,
			s.supplier_name,
			pi.currency,
			COUNT(DISTINCT pi.name) as overdue_count,
			SUM(pi.outstanding_amount) as overdue_amount,
			MAX(DATEDIFF(CURDATE(), pi.due_date)) as days_overdue
		FROM `tabPurchase Invoice` pi
		JOIN `tabSupplier` s ON pi.supplier = s.name
		WHERE pi.docstatus = 1
			AND pi.company = %s
			AND pi.outstanding_amount > 0
			AND pi.due_date < CURDATE()
			AND pi.posting_date BETWEEN %s AND %s
			AND s.disabled = 0
		GROUP BY pi.supplier, pi.currency
		ORDER BY pi.currency, overdue_amount DESC
	""", (company, from_date, to_date), as_dict=1)
	
	# Group by currency
	overdue_by_currency = {}
	for d in overdue_data:
		curr = d.get('currency') or 'EGP'
		if curr not in overdue_by_currency:
			overdue_by_currency[curr] = {
				'total': 0,
				'count': 0,
				'details': []
			}
		overdue_by_currency[curr]['total'] += d.get('overdue_amount', 0)
		overdue_by_currency[curr]['count'] += d.get('overdue_count', 0)
		overdue_by_currency[curr]['details'].append(d)
	
	# 5. Top Suppliers by Total Purchase Volume - With Currency and EGP Conversion
	# Build CASE statement for exchange rates
	rate_cases = []
	for curr, rate in exchange_rates.items():
		rate_cases.append(f"WHEN pi.currency = '{curr}' THEN {rate}")
	
	rate_case_sql = f"CASE {' '.join(rate_cases)} ELSE 1.0 END"
	
	top_suppliers = frappe.db.sql(f"""
		SELECT 
			pi.supplier,
			s.supplier_name,
			pi.currency,
			COUNT(DISTINCT pi.name) as invoice_count,
			SUM(pi.grand_total) as total_purchase,
			SUM(pi.outstanding_amount) as outstanding,
			SUM(pi.grand_total * {rate_case_sql}) as total_purchase_egp,
			MIN(pi.posting_date) as first_invoice_date,
			MAX(pi.posting_date) as last_invoice_date
		FROM `tabPurchase Invoice` pi
		JOIN `tabSupplier` s ON pi.supplier = s.name
		WHERE pi.docstatus = 1
			AND pi.company = %s
			AND s.disabled = 0
			AND pi.posting_date BETWEEN %s AND %s
		GROUP BY pi.supplier, pi.currency
		ORDER BY total_purchase_egp DESC
		LIMIT 20
	""", (company, from_date, to_date), as_dict=1)
	
	return {
		'currency': currency,
		'exchange_rates': exchange_rates,
		'total_payables_egp': total_payables_egp,
		'payables_breakdown': payables_breakdown,
		'total_purchase_egp': total_purchase_egp,
		'purchase_breakdown': purchase_breakdown,
		'payables_by_currency': payables_by_currency,
		'paid': {
			'total': total_paid,
			'count': paid_count,
			'details': paid_data[:10],  # Top 10
			'period': f"{from_date.strftime('%d %b')} - {to_date.strftime('%d %b %Y')}"
		},
		'active_suppliers': {
			'total': len(active_suppliers),
			'groups': supplier_groups
		},
		'overdue_by_currency': overdue_by_currency,
		'top_suppliers': top_suppliers
	}
