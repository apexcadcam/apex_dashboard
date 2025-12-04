frappe.pages['liquidity_dashboard'].on_page_load = function (wrapper) {
    new LiquidityDashboard(wrapper);
};

class LiquidityDashboard {
    constructor(wrapper) {
        this.wrapper = $(wrapper);

        this.page = frappe.ui.make_app_page({
            parent: wrapper,
            title: 'Liquidity Dashboard',
            single_column: true
        });

        // Load CSS
        frappe.require('/assets/apex_dashboard/page/liquidity_dashboard/liquidity_dashboard.css');

        // Load ApexCharts
        frappe.require('https://cdn.jsdelivr.net/npm/apexcharts@3.44.0/dist/apexcharts.min.js', () => {
            console.log('ApexCharts loaded');
        });

        const TEMPLATE = `
		<div class="liquidity-dashboard dashboard-template">
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
						<h1>Liquidity Overview</h1>
						<p class="subtitle">Real-time Cash & Bank Balances</p>
					</div>
				</div>
				<div class="header-actions">
					<div class="total-card-full">
						<span class="total-label-full">TOTAL LIQUIDITY</span>
						<span class="total-value-full" id="header-total-liquidity">Loading...</span>
					</div>
				</div>
			</div>

			<div id="dashboard-loader" class="dashboard-loader">
				<div class="spinner"></div>
				<p>Fetching latest rates & balances...</p>
			</div>

			<!-- Metrics Cards -->
			<div id="metrics-section" class="metrics-grid" style="display: none;">
				<div class="metric-card">
					<span class="metric-label">TOTAL LIQUIDITY</span>
					<span class="metric-value" id="metric-total">0 ج.م</span>
					<span class="metric-change" id="metric-change"></span>
				</div>
				<div class="metric-card">
					<span class="metric-label">LARGEST BANK</span>
					<span class="metric-value" id="metric-largest-name">-</span>
					<span class="metric-subvalue" id="metric-largest-amount">0 ج.م</span>
				</div>
				<div class="metric-card">
					<span class="metric-label">FOREIGN CURRENCY</span>
					<span class="metric-value" id="metric-foreign-pct">0%</span>
					<span class="metric-subvalue" id="metric-foreign-amount">0 ج.م</span>
				</div>
				<div class="metric-card">
					<span class="metric-label">BANK ACCOUNTS</span>
					<span class="metric-value" id="metric-bank-count">0</span>
					<span class="metric-subvalue" id="metric-bank-active">0 Active</span>
				</div>
			</div>

			<!-- Chart Section -->
			<div id="chart-section" class="chart-section" style="display: none;">
				<div class="chart-header">
					<h3>Bank Distribution</h3>
					<div class="chart-filters">
						<button class="filter-btn active" data-filter="all">All</button>
						<button class="filter-btn" data-filter="egp">EGP Only</button>
						<button class="filter-btn" data-filter="foreign">Foreign</button>
					</div>
				</div>
				<div id="bank-chart"></div>
			</div>

			<div id="dashboard-content" class="dashboard-grid" style="display: none;">
				<!-- Bank Cards will be injected here -->
			</div>

			<div class="dashboard-footer">
				<p>Exchange rates provided by OpenExchangeRates. Last updated: <span id="last-updated">-</span></p>
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
        this.chart = null;

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

        // Filter buttons for chart
        this.wrapper.find('.filter-btn').on('click', (e) => {
            const filter = $(e.currentTarget).data('filter');
            this.apply_filter(filter);

            // Update active state
            this.wrapper.find('.filter-btn').removeClass('active');
            $(e.currentTarget).addClass('active');
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

        // Period filter (For "As Of" date mainly)
        this.page.add_field({
            fieldname: 'period',
            label: __('Period'),
            fieldtype: 'Select',
            options: ['', 'Today', 'This Week', 'This Month', 'Last Month', 'This Year', 'Last Year', 'Fiscal Year', 'Custom', 'All Time'],
            default: 'Today',
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
            method: 'apex_dashboard.apex_dashboard.page.liquidity_dashboard.liquidity_dashboard.get_dashboard_data',
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
            this.wrapper.find('#metrics-section').hide();
            this.wrapper.find('#chart-section').hide();
            this.wrapper.find('#dashboard-content').hide();
        } else {
            this.wrapper.find('#dashboard-loader').hide();
            this.wrapper.find('#metrics-section').show();
            this.wrapper.find('#chart-section').show();
            this.wrapper.find('#dashboard-content').show();
            
            // Force chart section visibility on mobile
            setTimeout(() => {
                const chartSection = this.wrapper.find('#chart-section')[0];
                const bankChart = this.wrapper.find('#bank-chart')[0];
                if (chartSection) chartSection.style.display = 'block';
                if (bankChart) bankChart.style.display = 'block';
            }, 50);
        }
    }

    format_currency(amount, currency, precision = 2) {
        if (typeof format_currency === "function") {
            return format_currency(amount, currency, precision);
        }
        const formatted = parseFloat(amount || 0).toLocaleString(undefined, {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision,
        });
        return `${formatted} ${currency || ''}`.trim();
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

    render(data) {
        this.currentData = data;
        this.render_metrics(data);
        this.render_chart(data);

        this.wrapper.find('#header-total-liquidity').text(this.format_currency(data.total_liquidity, 'EGP'));
        this.wrapper.find('#last-updated').text(frappe.datetime.now_datetime());

        const grid = this.wrapper.find('#dashboard-content');
        grid.empty();

        if (!data.groups || data.groups.length === 0) {
            grid.html('<div class="alert alert-warning">No cards found. Please add cards in Apex Dashboard Card.</div>');
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
                    const balance = parseFloat(acc.balance || 0);
                    const balance_egp = parseFloat(acc.balance_egp || 0);
                    const rate = parseFloat(acc.rate || 1);
                    const currency = acc.currency || 'EGP';

                    if (currency === 'EGP') {
                        accountsHtml += `
							<div class="account-row">
								<div class="account-info">
									<span class="account-name">${acc.name || 'Account'}</span>
								</div>
								<span class="account-balance">${this.format_currency(balance_egp, 'EGP')}</span>
							</div>
						`;
                    } else {
                        accountsHtml += `
							<div class="account-row">
								<div class="account-info" style="flex-direction: column; align-items: flex-start; gap: 4px;">
									<span class="account-name">${acc.name || 'Account'}</span>
									<span class="currency-details" style="font-size: 13px; color: var(--text-primary); opacity: 0.9;">
										${currency} ${this.format_number(balance)}
									</span>
									<span class="rate-info" style="font-size: 11px; color: var(--text-secondary); opacity: 0.7;">
										Exchange Rate: ${rate.toFixed(2)}
									</span>
								</div>
								<span class="account-balance">${this.format_currency(balance_egp, 'EGP')}</span>
							</div>
						`;
                    }
                });
            }

            const total_egp = parseFloat(group.total_egp || 0);
            const cardHtml = `
				<div class="category-card" style="${cardStyle}">
					<div class="category-header">
						<div class="category-info">
							<i class="toggle-icon fa fa-chevron-down"></i>
							<span class="category-name">${group.name || 'Unknown'}</span>
						</div>
						<span class="category-total">${this.format_currency(total_egp, 'EGP')}</span>
					</div>
					${accountsHtml ? `<div class="category-body" style="display: none;">${accountsHtml}</div>` : ''}
				</div>
			`;

            grid.append(cardHtml);
        });

        grid.find('.category-card').on('click', function () {
            const body = $(this).find('.category-body');
            const icon = $(this).find('.toggle-icon');

            if (body.length) {
                body.slideToggle(300);
                icon.toggleClass('fa-chevron-down fa-chevron-up');
            }
        });
    }

    render_metrics(data) {
        if (!data.metrics) return;
        const metrics = data.metrics;

        this.wrapper.find('#metric-total').text(this.format_currency(metrics.total_liquidity, 'EGP'));
        this.wrapper.find('#metric-largest-name').text(metrics.largest_bank.name);
        this.wrapper.find('#metric-largest-amount').text(
            this.format_currency(metrics.largest_bank.amount, 'EGP') +
            ` (${metrics.largest_bank.percentage}%)`
        );
        this.wrapper.find('#metric-foreign-pct').text(`${metrics.foreign_currency.percentage}%`);
        this.wrapper.find('#metric-foreign-amount').text(
            this.format_currency(metrics.foreign_currency.amount, 'EGP') +
            ` (${metrics.foreign_currency.count} currencies)`
        );
        this.wrapper.find('#metric-bank-count').text(metrics.bank_count.total);
        this.wrapper.find('#metric-bank-active').text(`${metrics.bank_count.active} Active`);
    }

    render_chart(data) {
        if (!data.metrics || !data.metrics.chart_data) return;
        const chartData = data.metrics.chart_data;

        if (this.chart) {
            this.chart.destroy();
        }

        const options = {
            series: chartData.series,
            labels: chartData.labels,
            colors: chartData.colors,
            chart: {
                type: 'donut',
                height: 450,
                background: 'transparent',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            },
            theme: {
                mode: 'light'
            },
            legend: {
                position: 'bottom',
                horizontalAlign: 'center',
                floating: false,
                fontSize: '13px',
                labels: {
                    colors: this.get_text_color(),  // Dynamic color for theme
                    useSeriesColors: false
                },
                markers: {
                    width: 10,
                    height: 10,
                    radius: 2
                },
                itemMargin: {
                    horizontal: 12,
                    vertical: 5
                },
                offsetY: 5
            },
            dataLabels: {
                enabled: true,
                formatter: function (val) {
                    return val.toFixed(1) + '%';
                },
                style: {
                    fontSize: '12px',
                    colors: ['#ffffff']  // Always white on colored segments
                }
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '65%',
                        labels: {
                            show: true,
                            name: {
                                show: true,
                                fontSize: '16px',
                                color: this.get_text_color()  // Dynamic color
                            },
                            value: {
                                show: true,
                                fontSize: '20px',
                                color: this.get_text_color(),  // Dynamic color
                                formatter: (val) => {
                                    return this.format_currency(val, 'EGP');
                                }
                            },
                            total: {
                                show: true,
                                label: 'Total',
                                fontSize: '14px',
                                color: this.get_secondary_text_color(),  // Dynamic secondary color
                                formatter: () => {
                                    return this.format_currency(data.metrics.total_liquidity, 'EGP');
                                }
                            }
                        }
                    }
                }
            },
            tooltip: {
                theme: 'light',
                y: {
                    formatter: (val) => {
                        return this.format_currency(val, 'EGP');
                    }
                }
            }
        };

        if (typeof ApexCharts !== 'undefined') {
            this.chart = new ApexCharts(
                this.wrapper.find('#bank-chart')[0],
                options
            );
            this.chart.render();
        } else {
            setTimeout(() => this.render_chart(data), 500);
        }
    }

    apply_filter(filter) {
        if (!this.currentData) return;
        const data = this.currentData;
        let filteredGroups = [];

        if (filter === 'all') {
            filteredGroups = data.groups;
        } else if (filter === 'egp') {
            filteredGroups = data.groups.map(group => {
                const egpAccounts = group.accounts.filter(acc => acc.currency === 'EGP');
                if (egpAccounts.length > 0) {
                    const egpTotal = egpAccounts.reduce((sum, acc) => sum + (acc.balance_egp || 0), 0);
                    return { ...group, accounts: egpAccounts, total_egp: egpTotal };
                }
                return null;
            }).filter(g => g !== null && g.total_egp > 0);
        } else if (filter === 'foreign') {
            filteredGroups = data.groups.map(group => {
                const foreignAccounts = group.accounts.filter(acc => acc.currency !== 'EGP');
                if (foreignAccounts.length > 0) {
                    const foreignTotal = foreignAccounts.reduce((sum, acc) => sum + (acc.balance_egp || 0), 0);
                    return { ...group, accounts: foreignAccounts, total_egp: foreignTotal };
                }
                return null;
            }).filter(g => g !== null && g.total_egp > 0);
        }

        const filteredTotal = filteredGroups.reduce((sum, g) => sum + g.total_egp, 0);

        if (this.chart && filteredGroups.length > 0) {
            const chartData = {
                series: filteredGroups.map(g => g.total_egp),
                labels: filteredGroups.map(g => g.name),
                colors: filteredGroups.map(g => g.color || '#3b82f6')
            };
            this.chart.updateOptions({
                series: chartData.series,
                labels: chartData.labels,
                colors: chartData.colors,
                plotOptions: {
                    pie: {
                        donut: {
                            labels: {
                                total: {
                                    formatter: () => this.format_currency(filteredTotal, 'EGP')
                                }
                            }
                        }
                    }
                }
            });
        }

        const grid = this.wrapper.find('#dashboard-content');
        grid.empty();

        if (filteredGroups.length === 0) {
            grid.html('<div class="alert alert-info">No accounts match this filter.</div>');
            return;
        }

        filteredGroups.forEach(group => {
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
                    const balance = parseFloat(acc.balance || 0);
                    const balance_egp = parseFloat(acc.balance_egp || 0);
                    const rate = parseFloat(acc.rate || 1);
                    const currency = acc.currency || 'EGP';

                    if (currency === 'EGP') {
                        accountsHtml += `
							<div class="account-row">
								<div class="account-info">
									<span class="account-name">${acc.name || 'Account'}</span>
								</div>
								<span class="account-balance">${this.format_currency(balance_egp, 'EGP')}</span>
							</div>
						`;
                    } else {
                        accountsHtml += `
							<div class="account-row">
								<div class="account-info" style="flex-direction: column; align-items: flex-start; gap: 4px;">
									<span class="account-name">${acc.name || 'Account'}</span>
									<span class="currency-details" style="font-size: 13px; color: var(--text-primary); opacity: 0.9;">
										${currency} ${this.format_number(balance)}
									</span>
									<span class="rate-info" style="font-size: 11px; color: var(--text-secondary); opacity: 0.7;">
										Exchange Rate: ${rate.toFixed(2)}
									</span>
								</div>
								<span class="account-balance">${this.format_currency(balance_egp, 'EGP')}</span>
							</div>
						`;
                    }
                });
            }

            const total_egp = parseFloat(group.total_egp || 0);
            const cardHtml = `
				<div class="category-card" style="${cardStyle}">
					<div class="category-header">
						<div class="category-info">
							<i class="toggle-icon fa fa-chevron-down"></i>
							<span class="category-name">${group.name || 'Unknown'}</span>
						</div>
						<span class="category-total">${this.format_currency(total_egp, 'EGP')}</span>
					</div>
					${accountsHtml ? `<div class="category-body" style="display: none;">${accountsHtml}</div>` : ''}
				</div>
			`;

            grid.append(cardHtml);
        });

        grid.find('.category-card').on('click', function () {
            const body = $(this).find('.category-body');
            const icon = $(this).find('.toggle-icon');

            if (body.length) {
                body.slideToggle(300);
                icon.toggleClass('fa-chevron-down fa-chevron-up');
            }
        });
    }

    format_number(value) {
        return parseFloat(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    get_text_color() {
        // Check if dark theme is enabled
        const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
        return isDarkTheme ? '#ffffff' : '#1a1a1a';
    }

    get_secondary_text_color() {
        // Check if dark theme is enabled
        const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
        return isDarkTheme ? '#9ca3af' : '#6b7280';
    }
}
