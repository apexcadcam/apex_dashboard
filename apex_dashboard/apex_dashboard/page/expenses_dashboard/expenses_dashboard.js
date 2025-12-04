frappe.pages['expenses_dashboard'].on_page_load = function (wrapper) {
	new ExpenseDashboard(wrapper);
};

class ExpenseDashboard {
	constructor(wrapper) {
		this.wrapper = $(wrapper);

		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: 'Expenses Dashboard',
			single_column: true
		});

		// Load CSS
		frappe.require('/assets/apex_dashboard/page/expenses_dashboard/expenses_dashboard.css');

		const TEMPLATE = `
		<div class="expense-dashboard dashboard-template">
			<!-- Top Control Bar: Hub + Refresh + Filters -->
			<div class="top-control-bar">
				<button class="btn-glass btn-compact" id="back-btn">
					<i class="fa fa-arrow-left"></i> Hub
				</button>
				<button class="btn-glass btn-compact" id="refresh-btn">
					<i class="fa fa-refresh"></i>
				</button>
				<!-- Filters will be injected here by Frappe -->
			</div>
			
			<!-- Dashboard Header: Title + Total -->
			<div class="dashboard-header">
				<div class="header-content">
					<div class="header-text">
						<h1>Expenses Overview</h1>
						<p class="subtitle">Track your company expenses</p>
					</div>
				</div>
				<div class="header-actions">
					<div class="total-card" style="padding: 10px 20px; min-width: 200px;">
						<span class="label" style="font-size: 12px; color: #9ca3af; display: block;">Total Expenses</span>
						<span class="value" id="header-total-expense" style="font-size: 20px; font-weight: bold;">Loading...</span>
					</div>
				</div>
			</div>

			<div id="dashboard-loader" class="dashboard-loader">
				<div class="spinner"></div>
				<p>Fetching expenses data...</p>
			</div>

			<div id="dashboard-content" class="dashboard-grid" style="display: none;">
				<!-- Category Cards will be injected here -->
			</div>

			<div class="dashboard-footer">
				<p>Data based on GL Entries. Last updated: <span id="last-updated">-</span></p>
			</div>
		</div>
		`;

		// Load HTML Template
		$(TEMPLATE).appendTo(this.page.body);

		// Hide standard page title
		if (this.page.page_header) {
			this.page.page_header.hide();
		} else {
			this.wrapper.find('.page-head').hide();
		}

		this.format_currency = this.format_currency.bind(this);
		this.setup_filters();
		this.move_filters_to_top_bar();
		this.bind_events();
		this.load_data();
	}

	move_filters_to_top_bar() {
		// Move Frappe's page-form filters to our custom top bar
		setTimeout(() => {
			const pageForm = this.page.$page_form;
			const refreshBtn = this.wrapper.find('#refresh-btn');
			
			if (pageForm && refreshBtn.length) {
				// Insert form fields after refresh button
				pageForm.insertAfter(refreshBtn);
				pageForm.addClass('inline-filters');
				
				// Make form fields display inline
				pageForm.find('.form-group').each(function() {
					$(this).css({
						'display': 'inline-block',
						'margin-right': '10px',
						'margin-bottom': '0'
					});
				});
			}
		}, 100);
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
			default: 'This Year',
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

		// Fiscal Year Filter
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

		// Date range filters
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

		// Initialize visibility
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
			method: 'apex_dashboard.apex_dashboard.page.expenses_dashboard.expenses_dashboard.get_dashboard_data',
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
					this.wrapper.find('#dashboard-content').html('<div class="alert alert-danger">Error loading dashboard data.</div>');
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
			this.wrapper.find('#dashboard-content').fadeIn();
		}
	}

	render(data) {
		const currency = data.currency || 'EGP';
		this.wrapper.find('#last-updated').text(frappe.datetime.now_datetime());
		this.wrapper.find('#header-total-expense').text(this.format_currency(data.total_expenses, currency));

		const grid = this.wrapper.find('#dashboard-content');
		grid.empty();

		if (!data.groups || data.groups.length === 0) {
			grid.html('<div class="alert alert-info">No expenses found for this period.</div>');
			return;
		}

		data.groups.forEach(group => {
			let cardStyle = '';
			if (group.color) {
				const textColor = this.getContrastColor(group.color);
				cardStyle = `
					background: linear-gradient(135deg, ${group.color}40 0%, ${group.color}10 100%);
					border-left: 4px solid ${group.color} !important;
					color: ${textColor};
				`;
			}

			let accountsHtml = '';
			if (group.accounts && group.accounts.length > 0) {
				group.accounts.forEach(acc => {
					accountsHtml += `
						<div class="account-row">
							<div class="account-info">
								<span class="account-name">${acc.name}</span>
							</div>
							<span class="account-balance">${this.format_currency(acc.balance, currency)}</span>
						</div>
					`;
				});
			}

			const card = $(`
				<div class="category-card" style="${cardStyle}">
					<div class="category-header">
						<span class="expand-icon">▼</span>
						<span class="category-name">${group.name}</span>
						<span class="category-total">${this.format_currency(group.total, currency)}</span>
					</div>
					<div class="accounts-list" style="display: none;">
						${accountsHtml}
					</div>
				</div>
			`);

			// Accordion Logic
			card.find('.category-header').on('click', function () {
				const body = $(this).next('.accounts-list');
				const icon = $(this).find('.expand-icon');

				body.slideToggle(200);
				icon.toggleClass('expanded');
			});

			grid.append(card);
		});
	}

	format_currency(amount, currency, precision = 2) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency,
			minimumFractionDigits: precision,
			maximumFractionDigits: precision
		}).format(amount);
	}

	getContrastColor(hexColor) {
		if (!hexColor) return '#ffffff';
		hexColor = hexColor.replace('#', '');
		const r = parseInt(hexColor.substr(0, 2), 16);
		const g = parseInt(hexColor.substr(2, 2), 16);
		const b = parseInt(hexColor.substr(4, 2), 16);
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
	}
}
