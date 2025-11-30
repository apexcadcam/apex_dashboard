frappe.pages['liquidity_dashboard'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Liquidity Dashboard',
        single_column: true
    });

    // Load CSS
    frappe.require('/assets/apex_dashboard/page/liquidity_dashboard/liquidity_dashboard.css');

    const TEMPLATE = `
<div class="liquidity-dashboard">
    <div class="dashboard-header">
        <div class="header-content">
            <h1>Liquidity Overview</h1>
            <p class="subtitle">Real-time Cash & Bank Balances</p>
        </div>
        <div class="header-actions">
            <div class="total-liquidity-card">
                <span class="label">Total Liquidity</span>
                <span class="value" id="total-liquidity-value">Loading...</span>
            </div>
            <button class="btn btn-glass" id="refresh-btn">
                <i class="fa fa-refresh"></i>
            </button>
            <button class="btn btn-glass" id="config-btn">
                <i class="fa fa-cog"></i>
            </button>
        </div>
    </div>

    <div id="dashboard-loader" class="loader-container">
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
    $(TEMPLATE).appendTo(page.body);

    // Initialize
    new LiquidityDashboard(wrapper);
}

class LiquidityDashboard {
    constructor(wrapper) {
        this.wrapper = $(wrapper);
        this.format_currency = this.format_currency.bind(this);
        this.chart = null; // ApexCharts instance

        // Load ApexCharts
        frappe.require('https://cdn.jsdelivr.net/npm/apexcharts@3.44.0/dist/apexcharts.min.js', () => {
            console.log('ApexCharts loaded');
        });

        this.bind_events();
        this.fetch_data();
    }

    format_currency(amount, currency, precision = 2) {
        // Use Frappe's format_currency if available, otherwise fallback
        if (typeof format_currency === "function") {
            return format_currency(amount, currency, precision);
        }
        // Fallback formatting
        const formatted = parseFloat(amount || 0).toLocaleString(undefined, {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision,
        });
        return `${formatted} ${currency || ''}`.trim();
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

        // Calculate luminance (perceived brightness)
        // Formula: https://www.w3.org/TR/WCAG20/#relativeluminancedef
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // Return black for light backgrounds, white for dark backgrounds
        return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
    }

    bind_events() {
        this.wrapper.find('#refresh-btn').on('click', () => {
            this.fetch_data();
        });

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

        // Filter buttons
        this.wrapper.find('.filter-btn').on('click', (e) => {
            const filter = $(e.currentTarget).data('filter');
            this.apply_filter(filter);

            // Update active state
            this.wrapper.find('.filter-btn').removeClass('active');
            $(e.currentTarget).addClass('active');
        });
    }

    fetch_data() {
        console.log("Liquidity Dashboard: Starting to fetch data...");
        this.show_loader(true);

        frappe.call({
            method: 'apex_dashboard.apex_dashboard.page.liquidity_dashboard.liquidity_dashboard.get_dashboard_data',
            callback: (r) => {
                console.log("Liquidity Dashboard: API Response received", r);
                this.show_loader(false);
                if (r.message) {
                    if (r.message.error) {
                        console.warn("Liquidity Dashboard: Error in response", r.message.error);
                        frappe.msgprint({
                            title: __('Configuration Needed'),
                            indicator: 'orange',
                            message: __('Please configure cards in <b>Apex Dashboard Card</b> first.')
                        });
                        // Show empty state
                        this.wrapper.find('#dashboard-content').html(
                            '<div class="alert alert-warning">' +
                            __('No cards configured. Please add cards in Apex Dashboard Card.') +
                            '</div>'
                        );
                        return;
                    }
                    console.log("Liquidity Dashboard: Rendering data with", r.message.groups?.length || 0, "groups");
                    this.render(r.message);
                } else {
                    console.error("Liquidity Dashboard: No data returned in r.message");
                    this.wrapper.find('#dashboard-content').html(
                        '<div class="alert alert-danger">Error loading dashboard data. Please try again.</div>'
                    );
                }
            },
            error: (r) => {
                this.show_loader(false);
                console.error("Liquidity Dashboard: API Error", r);
                frappe.msgprint({
                    title: __('Error'),
                    indicator: 'red',
                    message: __('Failed to load dashboard data. Please check the console for details.')
                });
                this.wrapper.find('#dashboard-content').html(
                    '<div class="alert alert-danger">Error loading dashboard. Please refresh the page.</div>'
                );
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
            this.wrapper.find('#metrics-section').fadeIn();
            this.wrapper.find('#chart-section').fadeIn();
            this.wrapper.find('#dashboard-content').fadeIn();
        }
    }

    render_metrics(data) {
        if (!data.metrics) return;

        const metrics = data.metrics;

        // Total Liquidity
        this.wrapper.find('#metric-total').text(
            this.format_currency(metrics.total_liquidity, 'EGP')
        );

        // Largest Bank
        this.wrapper.find('#metric-largest-name').text(metrics.largest_bank.name);
        this.wrapper.find('#metric-largest-amount').text(
            this.format_currency(metrics.largest_bank.amount, 'EGP') +
            ` (${metrics.largest_bank.percentage}%)`
        );

        // Foreign Currency
        this.wrapper.find('#metric-foreign-pct').text(`${metrics.foreign_currency.percentage}%`);
        this.wrapper.find('#metric-foreign-amount').text(
            this.format_currency(metrics.foreign_currency.amount, 'EGP') +
            ` (${metrics.foreign_currency.count} currencies)`
        );

        // Bank Count
        this.wrapper.find('#metric-bank-count').text(metrics.bank_count.total);
        this.wrapper.find('#metric-bank-active').text(`${metrics.bank_count.active} Active`);
    }

    render_chart(data) {
        if (!data.metrics || !data.metrics.chart_data) return;

        const chartData = data.metrics.chart_data;

        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }

        const options = {
            series: chartData.series,
            labels: chartData.labels,
            colors: chartData.colors,
            chart: {
                type: 'donut',
                height: 350,
                background: 'transparent',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            },
            theme: {
                mode: 'light'
            },
            legend: {
                position: 'bottom',
                labels: {
                    colors: '#1a1a1a'
                }
            },
            dataLabels: {
                enabled: true,
                formatter: function (val) {
                    return val.toFixed(1) + '%';
                },
                style: {
                    fontSize: '12px',
                    colors: ['#1a1a1a']
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
                                color: '#1a1a1a'
                            },
                            value: {
                                show: true,
                                fontSize: '20px',
                                color: '#1a1a1a',
                                formatter: (val) => {
                                    return this.format_currency(val, 'EGP');
                                }
                            },
                            total: {
                                show: true,
                                label: 'Total',
                                fontSize: '14px',
                                color: '#666666',
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

        // Wait for ApexCharts to load
        if (typeof ApexCharts !== 'undefined') {
            this.chart = new ApexCharts(
                this.wrapper.find('#bank-chart')[0],
                options
            );
            this.chart.render();
        } else {
            // Retry after a short delay
            setTimeout(() => this.render_chart(data), 500);
        }
    }

    render(data) {
        console.log("Liquidity Dashboard: Rendering data", data);
        console.log("Liquidity Dashboard: Groups count:", data.groups?.length || 0);

        // Store data for filtering
        this.currentData = data;

        // Render Metrics Cards
        this.render_metrics(data);

        // Render Chart
        this.render_chart(data);

        // Update Total Liquidity in Header
        this.wrapper.find('#total-liquidity-value').text(
            this.format_currency(data.total_liquidity, 'EGP')
        );
        this.wrapper.find('#last-updated').text(frappe.datetime.now_datetime());

        // Render Groups
        const grid = this.wrapper.find('#dashboard-content');
        console.log("Liquidity Dashboard: Grid element found:", grid.length > 0);
        grid.empty();

        if (!data.groups || data.groups.length === 0) {
            console.warn("Liquidity Dashboard: No groups found in data", data);
            grid.html('<div class="alert alert-warning">No cards found. Please add cards in Apex Dashboard Card.</div>');
            return;
        }

        console.log("Liquidity Dashboard: Starting to render", data.groups.length, "groups");

        try {
            data.groups.forEach(group => {
                // Use color from backend for gradient background and border
                let cardStyle = '';
                if (group.color) {
                    // Calculate text color based on background brightness
                    const textColor = this.getContrastColor(group.color);

                    // Gradient background (lighter) + darker border + dynamic text color
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
                            // EGP: Simple single-line format
                            accountsHtml += `
                                <div class="account-row">
                                    <div class="account-info">
                                        <span class="account-name">${acc.name || 'Account'}</span>
                                    </div>
                                    <span class="account-balance">${this.format_currency(balance_egp, 'EGP')}</span>
                                </div>
                            `;
                        } else {
                            // Foreign currency: Multi-line format
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

            // Attach expand/collapse handlers
            grid.find('.category-card').on('click', function () {
                const body = $(this).find('.category-body');
                const icon = $(this).find('.toggle-icon');

                if (body.length) {
                    body.slideToggle(300);
                    icon.toggleClass('fa-chevron-down fa-chevron-up');
                }
            });
        } catch (e) {
            console.error("Liquidity Dashboard: Error rendering groups", e);
            frappe.msgprint("Error rendering dashboard: " + e.message);
        }
    }

    get_theme_class(name) {
        const themes = ['theme-blue', 'theme-green', 'theme-orange', 'theme-purple', 'theme-pink'];
        const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return themes[hash % themes.length];
    }

    apply_filter(filter) {
        console.log('Applying filter:', filter);

        if (!this.currentData) {
            console.warn('No data to filter');
            return;
        }

        const data = this.currentData;
        let filteredGroups = [];

        if (filter === 'all') {
            // Show all groups
            filteredGroups = data.groups;
        } else if (filter === 'egp') {
            // Show only EGP accounts
            filteredGroups = data.groups.map(group => {
                const egpAccounts = group.accounts.filter(acc => acc.currency === 'EGP');
                if (egpAccounts.length > 0) {
                    const egpTotal = egpAccounts.reduce((sum, acc) => sum + (acc.balance_egp || 0), 0);
                    return {
                        ...group,
                        accounts: egpAccounts,
                        total_egp: egpTotal
                    };
                }
                return null;
            }).filter(g => g !== null && g.total_egp > 0);
        } else if (filter === 'foreign') {
            // Show only foreign currency accounts
            filteredGroups = data.groups.map(group => {
                const foreignAccounts = group.accounts.filter(acc => acc.currency !== 'EGP');
                if (foreignAccounts.length > 0) {
                    const foreignTotal = foreignAccounts.reduce((sum, acc) => sum + (acc.balance_egp || 0), 0);
                    return {
                        ...group,
                        accounts: foreignAccounts,
                        total_egp: foreignTotal
                    };
                }
                return null;
            }).filter(g => g !== null && g.total_egp > 0);
        }

        // Calculate new totals
        const filteredTotal = filteredGroups.reduce((sum, g) => sum + g.total_egp, 0);

        // Update chart
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
                                    formatter: () => {
                                        return this.format_currency(filteredTotal, 'EGP');
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // Re-render cards with filtered data
        const grid = this.wrapper.find('#dashboard-content');
        grid.empty();

        if (filteredGroups.length === 0) {
            grid.html('<div class="alert alert-info">No accounts match this filter.</div>');
            return;
        }

        filteredGroups.forEach(group => {
            // Use color from backend for gradient background and border
            let cardStyle = '';
            if (group.color) {
                // Calculate text color based on background brightness
                const textColor = this.getContrastColor(group.color);

                // Gradient background (lighter) + darker border + dynamic text color
                cardStyle = `
                    background: linear-gradient(135deg, ${group.color}40 0%, ${group.color}10 100%);
                    border-left: 4px solid ${group.color} !important;
                    color: ${textColor};
                `;
            }

            let accountsHtml = '';
            if (group.accounts && group.accounts.length > 0) {
                group.accounts.forEach(acc => {
                    const displayLabel = acc.dashboard_label || acc.account_name || acc.name;
                    accountsHtml += `
                        <div class="account-row">
                            <div class="account-info">
                                <span class="account-name">${displayLabel}</span>
                                <span class="account-currency">${acc.currency}</span>
                            </div>
                            <div class="account-balance-group">
                                <span class="account-balance">${this.format_currency(acc.balance, acc.currency)}</span>
                                ${acc.currency !== 'EGP' ? `<span class="account-balance-egp">${this.format_currency(acc.balance_egp, 'EGP')}</span>` : ''}
                            </div>
                        </div>
                    `;
                });
            }

            const cardHtml = `
                <div class="category-card" style="${cardStyle}">
                    <div class="category-header">
                        <div class="category-info">
                            <i class="toggle-icon fa fa-chevron-down"></i>
                            <span class="category-name">${group.name}</span>
                        </div>
                        <span class="category-total">${this.format_currency(group.total_egp, 'EGP')}</span>
                    </div>
                    ${accountsHtml ? `<div class="category-body" style="display: none;">${accountsHtml}</div>` : ''}
                </div>
            `;

            grid.append(cardHtml);
        });

        // Attach expand/collapse handlers
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
}
