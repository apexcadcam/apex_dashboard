frappe.pages['suppliers_dashboard'].on_page_load = function (wrapper) {
	new SuppliersDashboard(wrapper);
};

class SuppliersDashboard {
	constructor(wrapper) {
		this.wrapper = $(wrapper);

		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: 'Suppliers Dashboard',
			single_column: true
		});

		// Load CSS
		frappe.require('/assets/apex_dashboard/page/suppliers_dashboard/suppliers_dashboard.css');

		const TEMPLATE = `
		<div class="suppliers-dashboard-container dashboard-template">
			<div class="dashboard-header">
				<div class="header-content">
					<button class="btn-glass" id="back-btn">
						<i class="fa fa-arrow-left"></i> Hub
					</button>
					<div class="header-text">
						<h1>Suppliers Overview</h1>
						<p class="subtitle">Track your supplier performance and payables</p>
					</div>
				</div>
				<div class="header-actions">
					<div class="total-card" style="padding: 10px 20px; min-width: 200px;">
						<span class="label" style="font-size: 12px; color: #9ca3af; display: block;">Total Payables</span>
						<span class="value" id="header-total-payables" style="font-size: 20px; font-weight: bold;">Loading...</span>
					</div>
					<button class="btn-glass" id="refresh-btn">
						<i class="fa fa-refresh"></i>
					</button>
				</div>
			</div>

			<div id="dashboard-loader" class="dashboard-loader">
				<div class="spinner"></div>
				<p>Loading dashboard...</p>
			</div>

			<div id="dashboard-content" style="display: none;">
				<!-- Content will be injected here -->
			</div>
		</div>
		`;

		// Load HTML Template
		$(TEMPLATE).appendTo(this.page.body);

		// Hide standard page title since we have a custom header
		if (this.page.page_header) {
			this.page.page_header.hide();
		} else {
			this.wrapper.find('.page-head').hide();
		}

		this.format_currency = this.format_currency.bind(this);
		this.setup_filters();
		this.bind_events();
		this.load_data();
	}

	bind_events() {
		this.wrapper.find('#back-btn').on('click', () => {
			frappe.set_route('apex_dashboards');
		});

		this.wrapper.find('#refresh-btn').on('click', () => {
			this.load_data();
		});
	}

	setup_filters() {
		// Company filter
		this.page.add_field({
			fieldname: 'company',
			label: __('Company'),
			fieldtype: 'Link',
			options: 'Company',
			default: frappe.defaults.get_user_default('Company'),
			change: () => this.load_data()
		});

		// Period filter
		this.page.add_field({
			fieldname: 'period',
			label: __('Period'),
			fieldtype: 'Select',
			options: ['', 'Today', 'This Week', 'This Month', 'Last Month', 'This Year', 'Last Year', 'Fiscal Year', 'Custom', 'All Time'],
			default: 'All Time',
			change: () => {
				const period = this.page.fields_dict.period.get_value();

				// Toggle Date Fields
				const isCustom = period === 'Custom';
				if (isCustom) {
					this.page.fields_dict.from_date.$wrapper.removeClass('hide').show();
					this.page.fields_dict.to_date.$wrapper.removeClass('hide').show();
				} else {
					this.page.fields_dict.from_date.$wrapper.addClass('hide').hide();
					this.page.fields_dict.to_date.$wrapper.addClass('hide').hide();
				}

				// Toggle Fiscal Year Field
				const isFiscalYear = period === 'Fiscal Year';
				if (isFiscalYear) {
					this.page.fields_dict.fiscal_year.$wrapper.removeClass('hide').show();
				} else {
					this.page.fields_dict.fiscal_year.$wrapper.addClass('hide').hide();
					this.page.fields_dict.fiscal_year.set_input(''); // Clear value when hidden
				}

				if (period !== 'Custom' && period !== 'Fiscal Year') {
					this.load_data();
				}
			}
		});

		// Fiscal Year Filter (Hidden by default)
		this.page.add_field({
			fieldname: 'fiscal_year',
			label: __('Select Year'),
			fieldtype: 'Link',
			options: 'Fiscal Year',
			change: () => {
				const fiscal_year = this.page.fields_dict.fiscal_year.get_value();
				if (fiscal_year) {
					this.load_data();
				}
			}
		});

		// Date range filters (hidden by default)
		this.page.add_field({
			fieldname: 'from_date',
			label: __('From Date'),
			fieldtype: 'Date',
			change: () => this.load_data()
		});

		this.page.add_field({
			fieldname: 'to_date',
			label: __('To Date'),
			fieldtype: 'Date',
			change: () => this.load_data()
		});

		// Initialize visibility based on default period
		this.page.fields_dict.period.$input.trigger('change');
	}

	load_data() {
		const company = this.page.fields_dict.company.get_value();
		const period = this.page.fields_dict.period.get_value();
		const from_date = this.page.fields_dict.from_date.get_value();
		const to_date = this.page.fields_dict.to_date.get_value();
		const fiscal_year = this.page.fields_dict.fiscal_year.get_value();

		this.show_loader(true);

		frappe.call({
			method: 'apex_dashboard.apex_dashboard.page.suppliers_dashboard.suppliers_dashboard.get_dashboard_data',
			args: {
				company: company,
				period: period,
				from_date: from_date,
				to_date: to_date,
				fiscal_year: fiscal_year
			},
			callback: (r) => {
				this.show_loader(false);
				if (r.message) {
					this.render(r.message);
				} else {
					this.wrapper.find('#dashboard-content').html('<div class="no-data">No data available</div>').show();
				}
			},
			error: (r) => {
				this.show_loader(false);
				frappe.msgprint(__('Failed to load dashboard data'));
			}
		});
	}

	show_loader(show) {
		if (show) {
			this.wrapper.find('#dashboard-loader').show();
			this.wrapper.find('#dashboard-content').hide();
		} else {
			this.wrapper.find('#dashboard-loader').hide();
			this.wrapper.find('#dashboard-content').show();
		}
	}

	render(data) {
		const currency = data.currency || 'EGP';

		// Update Header Total
		this.wrapper.find('#header-total-payables').text(this.format_currency(data.total_payables_egp, 'EGP'));

		// Render payables cards for each currency
		let payablesCards = '';
		if (data.payables_by_currency) {
			for (const [curr, payablesData] of Object.entries(data.payables_by_currency)) {
				payablesCards += this.render_card(`💰 Payables (${curr})`, payablesData, curr, '#e74c3c', 'payables');
			}
		}

		// Render overdue cards for each currency
		let overdueCards = '';
		if (data.overdue_by_currency) {
			for (const [curr, overdueData] of Object.entries(data.overdue_by_currency)) {
				overdueCards += this.render_card(`⚠️ Overdue (${curr})`, overdueData, curr, '#f39c12', 'overdue');
			}
		}

		const html = `
			<div class="suppliers-dashboard">
				<!-- Total Summary Cards -->
				<div class="total-summary-cards">
					${this.render_total_card('💰 Total Payables', data.total_payables_egp, 'EGP', '#e74c3c', data.exchange_rates, data.payables_breakdown)}
					${this.render_total_card('📊 Total Purchase Volume', data.total_purchase_egp, 'EGP', '#667eea', data.exchange_rates, data.purchase_breakdown)}
				</div>
				
				<!-- Summary Cards -->
				<div class="summary-cards">
					${payablesCards}
					${this.render_card('💵 Total Paid', data.paid, currency, '#27ae60', 'paid')}
					${this.render_card('📦 Active Suppliers', data.active_suppliers, currency, '#3498db', 'active')}
					${overdueCards}
				</div>
				
				<!-- Top Suppliers Section -->
				<div class="top-suppliers-section">
					<h3>📊 Top Suppliers by Purchase Volume</h3>
					${this.render_top_suppliers(data.top_suppliers, data.exchange_rates)}
				</div>
			</div>
		`;

		this.wrapper.find('#dashboard-content').html(html);
	}

	render_card(title, data, currency, color, type) {
		let detailsHtml = '';

		if (type === 'payables' && data.details && data.details.length > 0) {
			detailsHtml = `
				<div class="card-details">
					${data.details.map(item => `
						<div class="card-detail-item clickable" onclick="frappe.set_route('List', 'Purchase Invoice', {'supplier': '${item.supplier}', 'outstanding_amount': ['>', 0]})" title="View outstanding invoices">
							<span class="detail-name">${item.supplier_name}</span>
							<div class="detail-stats">
								<span class="detail-qty amount-red">${this.format_currency(item.outstanding, currency)}</span>
								<span class="detail-types">${item.invoice_count} invoices</span>
							</div>
						</div>
					`).join('')}
				</div>
			`;
		} else if (type === 'paid' && data.details && data.details.length > 0) {
			detailsHtml = `
				<div class="period-info">${data.period || ''}</div>
				<div class="card-details">
					${data.details.map(item => `
						<div class="card-detail-item clickable" onclick="frappe.set_route('List', 'Payment Entry', {'party': '${item.supplier}'})" title="View payments">
							<span class="detail-name">${item.supplier_name}</span>
							<div class="detail-stats">
								<span class="detail-qty amount-green">${this.format_currency(item.paid_amount, currency)}</span>
								<span class="detail-types">${item.payment_count} payments</span>
							</div>
						</div>
					`).join('')}
				</div>
			`;
		} else if (type === 'active' && data.groups && data.groups.length > 0) {
			detailsHtml = `
				<div class="card-details">
					${data.groups.map(group => `
						<div class="supplier-group">
							<span class="group-name">${group.name}</span>
							<span class="group-count">${group.count} suppliers</span>
						</div>
					`).join('')}
				</div>
			`;
		} else if (type === 'overdue' && data.details && data.details.length > 0) {
			detailsHtml = `
				<div class="card-details">
					${data.details.map(item => `
						<div class="card-detail-item clickable" onclick="frappe.set_route('List', 'Purchase Invoice', {'supplier': '${item.supplier}', 'outstanding_amount': ['>', 0], 'due_date': ['<', frappe.datetime.get_today()]})" title="View overdue invoices">
							<span class="detail-name">${item.supplier_name}</span>
							<div class="detail-stats">
								<span class="detail-qty amount-orange">${this.format_currency(item.overdue_amount, currency)}</span>
								<span class="detail-types">${item.days_overdue} days overdue</span>
							</div>
						</div>
					`).join('')}
				</div>
			`;
		}

		const value = type === 'active' ? data.total : this.format_currency(data.total, currency);
		const subtitle = type === 'active' ? 'suppliers' : `${data.count} ${type === 'payables' ? 'invoices' : type === 'paid' ? 'payments' : 'invoices'}`;

		// Add exchange rate info for non-EGP currencies
		let exchangeRateInfo = '';
		if (currency !== 'EGP' && window.dashboard_exchange_rates && window.dashboard_exchange_rates[currency]) {
			const rate = parseFloat(window.dashboard_exchange_rates[currency]).toFixed(2);
			exchangeRateInfo = `<div class="card-exchange-rate">1 ${currency} = ${rate} EGP</div>`;
		}

		return `
			<div class="category-card-new" style="border-left: 4px solid ${color}">
				<div class="card-header-new">${title}</div>
				<div class="card-value-new">${value}</div>
				<div class="card-stats-new">
					<span>${subtitle}</span>
				</div>
				${exchangeRateInfo}
				${detailsHtml}
			</div>
		`;
	}

	render_total_card(title, total, currency, color, exchange_rates, breakdown) {
		// Store exchange rates globally for use in render_card
		window.dashboard_exchange_rates = exchange_rates;

		// Show exchange rates
		let ratesHtml = '';
		if (exchange_rates) {
			const rates = [];
			for (const [curr, rate] of Object.entries(exchange_rates)) {
				if (curr !== 'EGP') {
					rates.push(`<span>${curr}: ${parseFloat(rate).toFixed(2)} EGP</span>`);
				}
			}
			if (rates.length > 0) {
				ratesHtml = `<div class="exchange-rates">${rates.join('')}</div>`;
			}
		}

		// Show breakdown by currency
		let breakdownHtml = '';
		if (breakdown && Object.keys(breakdown).length > 0) {
			const items = [];
			for (const [curr, amount] of Object.entries(breakdown)) {
				items.push(`<div class="breakdown-item"><span class="breakdown-currency">${curr}</span><span class="breakdown-amount">${this.format_currency(amount, curr)}</span></div>`);
			}
			breakdownHtml = `<div class="currency-breakdown">${items.join('')}</div>`;
		}

		return `
			<div class="total-card" style="border-left: 4px solid ${color}">
				<div class="card-header-new">${title}</div>
				<div class="card-value-new">${this.format_currency(total, currency)}</div>
				${breakdownHtml}
				${ratesHtml}
			</div>
		`;
	}

	render_top_suppliers(suppliers, exchange_rates) {
		if (!suppliers || suppliers.length === 0) {
			return '<p class="no-data">No supplier data available</p>';
		}

		// Sort by total purchase in EGP
		const suppliersWithEGP = suppliers.map(sup => {
			const rate = exchange_rates[sup.currency] || 1.0;
			return {
				...sup,
				total_purchase_egp: sup.total_purchase_egp || (sup.total_purchase * rate),
				outstanding_egp: sup.outstanding * rate
			};
		});

		suppliersWithEGP.sort((a, b) => b.total_purchase_egp - a.total_purchase_egp);

		// Helper function to calculate relationship duration
		const getDuration = (firstDate) => {
			if (!firstDate) return '';
			const first = new Date(firstDate);
			const now = new Date();
			const diffTime = Math.abs(now - first);
			const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

			const years = Math.floor(diffDays / 365);
			const months = Math.floor((diffDays % 365) / 30);

			if (years > 0 && months > 0) {
				return `${years}y ${months}m`;
			} else if (years > 0) {
				return `${years} year${years > 1 ? 's' : ''}`;
			} else if (months > 0) {
				return `${months} month${months > 1 ? 's' : ''}`;
			} else {
				return `${diffDays} days`;
			}
		};

		return `
			<div class="top-suppliers-list">
				${suppliersWithEGP.slice(0, 10).map((sup, index) => `
					<div class="top-supplier-item clickable" onclick="frappe.set_route('Form', 'Supplier', '${sup.supplier}')" title="View supplier details">
						<div class="supplier-rank">#${index + 1}</div>
						<div class="supplier-info">
							<div class="supplier-name">${sup.supplier_name}</div>
							<div class="supplier-stats">
								<span class="stat-item">Total: ${this.format_currency(sup.total_purchase, sup.currency || 'EGP')} (${this.format_currency(sup.total_purchase_egp, 'EGP')})</span>
								<span class="stat-item">${sup.invoice_count} invoices</span>
								<span class="stat-item">📅 ${getDuration(sup.first_invoice_date)}</span>
								<span class="stat-item">Outstanding: ${this.format_currency(sup.outstanding, sup.currency || 'EGP')}</span>
							</div>
						</div>
					</div>
				`).join('')}
			</div>
		`;
	}

	format_currency(value, currency = 'EGP') {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value || 0);
	}
}
