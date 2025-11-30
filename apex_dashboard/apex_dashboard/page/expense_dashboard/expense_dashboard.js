frappe.pages['expense_dashboard'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Expense Dashboard',
		single_column: true
	});

	// Load CSS
	frappe.require('/assets/apex_dashboard/page/expense_dashboard/expense_dashboard.css');

	const TEMPLATE = `
<div class="expense-dashboard">
    <div class="dashboard-header">
        <div class="header-content">
            <h1>Expense Overview</h1>
            <p class="subtitle">Track your company expenses</p>
        </div>
        <div class="header-actions">
            <div class="total-expense-card">
                <span class="label">Total Expenses</span>
                <span class="value" id="total-expense-value">Loading...</span>
            </div>
            <button class="btn btn-glass" id="config-btn" title="Configure Dashboard">
                <i class="fa fa-cog"></i>
            </button>
            <button class="btn btn-glass" id="refresh-btn">
                <i class="fa fa-refresh"></i>
            </button>
        </div>
    </div>

    <div id="dashboard-loader" class="loader-container">
        <div class="spinner"></div>
        <p>Fetching expense data...</p>
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
	$(TEMPLATE).appendTo(page.body);

	// Initialize
	new ExpenseDashboard(wrapper, page);
}

class ExpenseDashboard {
	constructor(wrapper, page) {
		this.wrapper = $(wrapper);
		this.page = page;
		this.format_currency = this.format_currency.bind(this);

		this.setup_filters();
		this.bind_events();
		this.fetch_data();
	}

	setup_filters() {
		this.company_field = this.page.add_field({
			fieldname: 'company',
			label: __('Company'),
			fieldtype: 'Link',
			options: 'Company',
			default: frappe.defaults.get_user_default("Company"),
			change: () => this.fetch_data()
		});

		this.period_field = this.page.add_field({
			fieldname: 'period',
			label: __('Period'),
			fieldtype: 'Select',
			options: [
				{ label: __('Today'), value: 'Today' },
				{ label: __('This Week'), value: 'This Week' },
				{ label: __('This Month'), value: 'This Month' },
				{ label: __('Last Month'), value: 'Last Month' },
				{ label: __('This Year'), value: 'This Year' },
				{ label: __('Last Year'), value: 'Last Year' },
				{ label: __('All Time'), value: 'All Time' },
				{ label: __('Custom'), value: 'Custom' }
			],
			default: 'All Time',
			change: () => {
				this.toggle_custom_dates();
				this.fetch_data();
			}
		});

		// Custom date fields (hidden by default)
		this.from_date_field = this.page.add_field({
			fieldname: 'from_date',
			label: __('From Date'),
			fieldtype: 'Date',
			default: frappe.datetime.month_start(),
			change: () => this.fetch_data()
		});

		this.to_date_field = this.page.add_field({
			fieldname: 'to_date',
			label: __('To Date'),
			fieldtype: 'Date',
			default: frappe.datetime.month_end(),
			change: () => this.fetch_data()
		});

		// Hide custom dates initially
		this.toggle_custom_dates();
	}

	toggle_custom_dates() {
		const period = this.period_field.get_value();
		const isCustom = period === 'Custom';

		this.from_date_field.df.hidden = !isCustom;
		this.to_date_field.df.hidden = !isCustom;
		this.from_date_field.refresh();
		this.to_date_field.refresh();
	}

	bind_events() {
		this.wrapper.find('#refresh-btn').on('click', () => {
			this.fetch_data();
		});

		// Config Button
		this.wrapper.find('#config-btn').on('click', () => {
			frappe.set_route('Form', 'Apex Dashboard Config', 'Apex Dashboard Config');
		});

		// Back to Hub
		this.wrapper.find('.header-content').prepend(`
            <button class="btn-glass" id="back-btn">
                <i class="fa fa-arrow-left"></i> Hub
            </button>
        `);

		this.wrapper.find('#back-btn').on('click', () => {
			frappe.set_route('apex_dashboards');
		});
	}

	fetch_data() {
		console.log("Expense Dashboard: Starting to fetch data...");
		this.show_loader(true);

		const company = this.company_field.get_value();
		const period = this.period_field.get_value();

		const args = {
			company: company,
			period: period
		};

		// Add custom dates if period is Custom
		if (period === 'Custom') {
			args.from_date = this.from_date_field.get_value();
			args.to_date = this.to_date_field.get_value();
		}

		console.log("Expense Dashboard: Company =", company, "Period =", period);

		frappe.call({
			method: 'apex_dashboard.apex_dashboard.page.expense_dashboard.expense_dashboard.get_dashboard_data',
			args: args,
			callback: (r) => {
				console.log("Expense Dashboard: API Response received", r);
				this.show_loader(false);
				if (r.message) {
					this.render(r.message);
				} else {
					console.error("Expense Dashboard: No data returned");
					this.wrapper.find('#dashboard-content').html(
						'<div class="alert alert-danger">Error loading dashboard data.</div>'
					);
				}
			},
			error: (r) => {
				this.show_loader(false);
				console.error("Expense Dashboard: API Error", r);
				frappe.msgprint({
					title: __('Error'),
					indicator: 'red',
					message: __('Failed to load dashboard data.')
				});
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
		console.log("Expense Dashboard: Rendering data", data);

		// Update Header
		try {
			const totalExpense = data.total_expenses || 0;
			const currency = data.currency || 'EGP';
			this.wrapper.find('#total-expense-value').text(this.format_currency(totalExpense, currency));
			this.wrapper.find('#last-updated').text(frappe.datetime.now_datetime());
		} catch (e) {
			console.error("Expense Dashboard: Error updating header", e);
		}

		// Render Categories
		const grid = this.wrapper.find('#dashboard-content');
		grid.empty();

		if (!data.groups || data.groups.length === 0) {
			grid.html('<div class="alert alert-info">No expenses found for this period.</div>');
			return;
		}

		data.groups.forEach(group => {
			// Use color from backend for gradient background and border
			let cardStyle = '';
			if (group.color) {
				// Gradient background (lighter) + darker border
				cardStyle = `
                    
				background: linear-gradient(135deg, ${group.color}40 0%, ${group.color}10 100%);
				
                    border-left: 4px solid ${group.color} !important;
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
                            <span class="account-balance">${this.format_currency(acc.balance, data.currency)}</span>
                        </div>
                    `;
				});
			}

			const card = $(`
                <div class="category-card" style="${cardStyle}">
                    <div class="category-header">
                        <span class="expand-icon">▼</span>
                        <span class="category-name">${group.name}</span>
                        <span class="category-total">${this.format_currency(group.total, data.currency)}</span>
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
		// Convert hex to RGB
		if (!hexColor) return '#ffffff';

		// Remove # if present
		hexColor = hexColor.replace('#', '');

		// Convert to RGB
		const r = parseInt(hexColor.substr(0, 2), 16);
		const g = parseInt(hexColor.substr(2, 2), 16);
		const b = parseInt(hexColor.substr(4, 2), 16);

		// Calculate luminance
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

		// Return black for light colors, white for dark colors
		return luminance > 0.5 ? '#000000' : '#ffffff';
	}

	get_theme_class(name) {
		const themes = ['theme-blue', 'theme-green', 'theme-orange', 'theme-purple', 'theme-pink'];
		const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		return themes[hash % themes.length];
	}

	get_theme_class_from_name(themeName) {
		// Map Config color names to CSS classes
		const themeMap = {
			'Blue': 'theme-blue',
			'Green': 'theme-green',
			'Red': 'theme-red',
			'Purple': 'theme-purple',
			'Orange': 'theme-gold',  // Using gold as closest to orange
			'Teal': 'theme-lime'     // Using lime as closest to teal
		};
		return themeMap[themeName] || 'theme-blue';
	}
}
