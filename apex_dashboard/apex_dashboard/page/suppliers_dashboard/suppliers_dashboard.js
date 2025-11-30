frappe.pages['suppliers_dashboard'].on_page_load = function (wrapper) {
	console.log('Suppliers Dashboard: on_page_load called');
	new SuppliersDashboard(wrapper);
};

class SuppliersDashboard {
	constructor(wrapper) {
		console.log('SuppliersDashboard constructor called');
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: '📦 Suppliers Dashboard',
			single_column: true
		});

		this.wrapper = $(wrapper);
		this.$container = this.page.main;
		this.$container.addClass('suppliers-dashboard-container');

		this.format_currency = this.format_currency.bind(this);

		console.log('Container initialized:', this.$container);
		this.fetch_data();
	}

	fetch_data() {
		console.log('Fetching suppliers dashboard data...');
		this.show_loader(true);

		frappe.call({
			method: 'apex_dashboard.apex_dashboard.page.suppliers_dashboard.suppliers_dashboard.get_dashboard_data',
			args: {
				company: frappe.defaults.get_user_default("Company")
			},
			callback: (r) => {
				console.log('Data received:', r);
				this.show_loader(false);
				if (r.message) {
					console.log('Rendering dashboard with data:', r.message);
					this.render(r.message);
				} else {
					console.error('No data in response');
					this.$container.html('<div class="no-data">No data available</div>');
				}
			},
			error: (r) => {
				console.error('Error loading dashboard:', r);
				this.show_loader(false);
				frappe.msgprint(__('Failed to load dashboard data'));
			}
		});
	}

	show_loader(show) {
		if (show) {
			this.$container.html('<div class="dashboard-loader"><div class="spinner"></div><p>Loading dashboard...</p></div>');
		}
	}

	render(data) {
		console.log('render() called with data:', data);
		const currency = data.currency || 'EGP';

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

		console.log('Generated HTML length:', html.length);
		console.log('Container element:', this.$container);
		this.$container.html(html);
		console.log('HTML inserted into container');
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
