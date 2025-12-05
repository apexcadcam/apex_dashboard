frappe.pages['equity_dashboard'].on_page_load = function (wrapper) {
    new EquityDashboard(wrapper);
};

class EquityDashboard {
    constructor(wrapper) {
        this.page = frappe.ui.make_app_page({
            parent: wrapper,
            title: 'Equity Dashboard',
            single_column: true
        });

        this.wrapper = $(wrapper);
        this.format_currency = this.format_currency.bind(this);

        // Load CSS
        frappe.require('/assets/apex_dashboard/page/equity_dashboard/equity_dashboard.css');

        this.make_ui();
        this.bind_events();
        this.fetch_data();
    }

    make_ui() {
        // Hide standard page title
        this.page.main.find('.page-head').hide();

        const TEMPLATE = `
        <div class="equity-dashboard">
            <div class="dashboard-header" style="margin-top: 10px;">
                <div class="header-content">
                    <div class="title-section">
                        <h1>Equity Overview</h1>
                        <p class="subtitle">Track your equity & liabilities</p>
                    </div>
                </div>
                <div class="header-actions">
                    <div class="total-card glass-card">
                        <span class="label" style="font-size: 12px; color: #9ca3af; display: block;">Total Equity</span>
                        <span class="value" id="total-value" style="font-size: 20px; font-weight: bold;">Loading...</span>
                    </div>
                </div>
            </div>

            <div id="dashboard-loader" class="loader-container">
                <div class="spinner"></div>
                <p>Fetching equity data...</p>
            </div>

            <div id="dashboard-content" class="dashboard-grid" style="display: none;">
                <!-- Content injected here -->
            </div>

            <div class="dashboard-footer">
                <p>Data based on GL Entries. Last updated: <span id="last-updated">-</span></p>
            </div>
        </div>
        `;

        $(TEMPLATE).appendTo(this.page.body);
        this.setup_filters();
        this.add_custom_buttons_to_filters();
    }

    setup_filters() {
        // Company filter
        this.page.add_field({
            fieldname: 'company',
            label: __('Company'),
            fieldtype: 'Link',
            options: 'Company',
            default: frappe.defaults.get_user_default('Company'),
            change: () => this.fetch_data()
        });

        // Period filter
        this.page.add_field({
            fieldname: 'period',
            label: __('Period'),
            fieldtype: 'Select',
            options: ['This Month', 'Last Month', 'This Year', 'Last Year', 'All Time'],
            default: 'All Time',
            change: () => this.fetch_data()
        });
    }

    add_custom_buttons_to_filters() {
        // Wait for Frappe to render the filters
        setTimeout(() => {
            // Find the filter container (where Company and Period are)
            const filterContainer = this.page.wrapper.find('.page-form .clearfix, .page-form').first();
            
            if (filterContainer.length) {
                // Create Hub button
                const hubBtn = $(`
                    <div class="form-group" style="display: inline-block; margin: 0 5px 0 0; min-width: 60px;">
                        <button class="btn btn-default btn-sm" id="hub-btn-custom" style="padding: 5px 10px; font-size: 12px;">
                            <i class="fa fa-arrow-left"></i> Hub
                        </button>
                    </div>
                `);
                
                // Create Refresh button
                const refreshBtn = $(`
                    <div class="form-group" style="display: inline-block; margin: 0 5px 0 0; min-width: 40px;">
                        <button class="btn btn-default btn-sm" id="refresh-btn-custom" style="padding: 5px 10px; font-size: 12px;">
                            <i class="fa fa-refresh"></i>
                        </button>
                    </div>
                `);
                
                // Add click handlers
                hubBtn.find('button').on('click', () => frappe.set_route('apex_dashboards'));
                refreshBtn.find('button').on('click', () => this.fetch_data());
                
                // Insert at the beginning
                filterContainer.prepend(refreshBtn);
                filterContainer.prepend(hubBtn);
                
                // Make container tighter and left-aligned
                filterContainer.css({
                    'display': 'flex',
                    'justify-content': 'flex-start',
                    'align-items': 'center',
                    'gap': '3px',
                    'flex-wrap': 'nowrap'
                });
                
                // Make sure everything is inline and smaller
                filterContainer.find('.form-group').each(function() {
                    const $this = $(this);
                    $this.css({
                        'display': 'inline-block',
                        'vertical-align': 'middle',
                        'margin': '0 3px 0 0',
                        'max-width': '120px'
                    });
                    
                    // Make Company and Period inputs smaller
                    $this.find('input, select').css({
                        'max-width': '100px',
                        'font-size': '12px',
                        'padding': '5px 8px'
                    });
                });
                
                console.log('✅ Hub and Refresh buttons added to filter bar');
            } else {
                console.error('❌ Could not find filter container');
            }
        }, 300);
    }

    bind_events() {
        // Old buttons in HTML template are removed
        // New buttons are added via add_custom_buttons_to_filters()
    }

    fetch_data() {
        const company = this.page.fields_dict.company.get_value() || frappe.defaults.get_user_default('Company');
        const period = this.page.fields_dict.period.get_value() || 'All Time';

        this.show_loader(true);

        frappe.call({
            method: 'apex_dashboard.apex_dashboard.page.equity_dashboard.equity_dashboard.get_dashboard_data',
            args: { company, period },
            callback: (r) => {
                this.show_loader(false);
                if (r.message) {
                    this.render(r.message);
                }
            }
        });
    }

    render(data) {
        const grid = this.wrapper.find('#dashboard-content');
        grid.empty();

        const currency = data.currency;
        const metrics = data.metrics;

        // Update Header Total
        this.wrapper.find('#total-value').text(this.format_currency(metrics.total_equity, currency));
        this.wrapper.find('#last-updated').text(frappe.datetime.now_datetime());

        // 1. Metrics Cards
        const metricsHtml = `
            <div class="metric-card glass-card">
                <div class="metric-icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">
                    <i class="fa fa-chart-line"></i>
                </div>
                <div class="metric-info">
                    <span class="metric-label">${data.period.label} Profit</span>
                    <span class="metric-value">${this.format_currency(metrics.ytd_profit, currency)}</span>
                </div>
            </div>
            <div class="metric-card glass-card">
                <div class="metric-icon" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
                    <i class="fa fa-piggy-bank"></i>
                </div>
                <div class="metric-info">
                    <span class="metric-label">Retained Earnings</span>
                    <span class="metric-value">${this.format_currency(metrics.retained_earnings, currency)}</span>
                </div>
            </div>
            <div class="metric-card glass-card">
                <div class="metric-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">
                    <i class="fa fa-users"></i>
                </div>
                <div class="metric-info">
                    <span class="metric-label">Partners Equity</span>
                    <span class="metric-value">${this.format_currency(metrics.total_equity - metrics.retained_earnings - metrics.ytd_profit, currency)}</span>
                </div>
            </div>
        `;
        grid.append(metricsHtml);

        // 2. Yearly Comparison (Full History)
        if (metrics.yearly_profits && metrics.yearly_profits.length > 0) {
            let yearlyHtml = `
                <div class="yearly-comparison" style="grid-column: 1 / -1; margin-bottom: 30px;">
                    <div class="glass-panel" style="padding: 20px; border-left: 4px solid #9333ea;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                            <i class="fa fa-calendar" style="font-size: 20px; color: #9333ea;"></i>
                            <h4 style="margin: 0; color: var(--text-primary); font-size: 16px; font-weight: 600;">مقارنة الأرباح السنوية (Yearly Profit Comparison)</h4>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
            `;

            metrics.yearly_profits.forEach(yp => {
                const profit = parseFloat(yp.profit);
                const isPositive = profit >= 0;
                yearlyHtml += `
                    <div style="padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; text-align: center;">
                        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 5px;">${yp.year}</div>
                        <div style="font-size: 18px; font-weight: 700; color: ${isPositive ? '#10b981' : '#ef4444'};">
                            ${this.format_currency(profit, currency, 0)}
                        </div>
                    </div>
                `;
            });

            yearlyHtml += `</div></div></div>`;
            grid.append(yearlyHtml);
        }

        // 3. Partner Cards
        if (data.partners && data.partners.length > 0) {
            const partnerContainer = $('<div class="partner-section-container"></div>');

            data.partners.forEach(partner => {
                const isPositive = partner.net_equity >= 0;
                const cardStyle = `border-left: 4px solid ${isPositive ? '#10b981' : '#ef4444'};`;

                let accountsHtml = '';
                partner.accounts.forEach(acc => {
                    accountsHtml += `
                        <div class="account-row" style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <span style="color: var(--text-secondary);">${acc.name}</span>
                            <span style="font-weight: 600; color: var(--text-primary);">${this.format_currency(acc.balance, currency)}</span>
                        </div>
                    `;
                });

                let withdrawalsHtml = '';
                if (partner.recent_withdrawals && partner.recent_withdrawals.length > 0) {
                    withdrawalsHtml = `
                        <div class="withdrawals-section" style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                            <div class="withdrawals-header" style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">
                                <i class="fa fa-history"></i> Recent Withdrawals
                            </div>
                            <div class="withdrawals-list">
                    `;

                    partner.recent_withdrawals.forEach(w => {
                        withdrawalsHtml += `
                            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; color: var(--text-secondary);">
                                <span>${frappe.datetime.str_to_user(w.posting_date)}</span>
                                <span style="color: var(--danger-color);">${this.format_currency(w.amount, currency)}</span>
                            </div>
                        `;
                    });

                    withdrawalsHtml += `</div></div>`;
                }

                const card = $(`
                    <div class="partner-card glass-panel" style="${cardStyle}">
                        <div class="partner-header">
                            <div class="partner-info">
                                <i class="fa fa-user"></i>
                                <h3>${partner.name}</h3>
                            </div>
                            <div class="partner-total">
                                <span class="label">Net Equity</span>
                                <span class="amount ${isPositive ? 'text-success' : 'text-danger'}">
                                    ${this.format_currency(partner.net_equity, currency)}
                                </span>
                            </div>
                        </div>
                        <div class="partner-details" style="margin-top: 15px;">
                            ${accountsHtml}
                        </div>
                        ${withdrawalsHtml}
                    </div>
                `);

                partnerContainer.append(card);
            });

            grid.append(partnerContainer);
        }
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

    format_currency(value, currency, decimals = 2) {
        return format_currency(value, currency, decimals);
    }
}
