frappe.pages['dashboard_template'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Dashboard Template',
        single_column: true
    });

    // Load CSS
    frappe.require('/assets/apex_dashboard/page/dashboard_template/dashboard_template.css');

    const TEMPLATE = `
<div class="dashboard-template">
    <div class="dashboard-header">
        <div class="header-content">
            <h1>Dashboard Overview</h1>
            <p class="subtitle">Track your data</p>
        </div>
        <div class="header-actions">
            <div class="total-card">
                <span class="label">Total</span>
                <span class="value" id="total-value">Loading...</span>
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
        <p>Fetching data...</p>
    </div>

    <div id="dashboard-content" class="dashboard-grid" style="display: none;">
        <!-- Cards will be injected here -->
    </div>

    <div class="dashboard-footer">
        <p>Data based on GL Entries. Last updated: <span id="last-updated">-</span></p>
    </div>
</div>
    `;

    // Load HTML Template
    $(TEMPLATE).appendTo(page.body);

    // Initialize
    new DashboardTemplate(wrapper, page);
}

class DashboardTemplate {
    constructor(wrapper, page, config = {}) {
        this.wrapper = $(wrapper);
        this.page = page;
        this.config = config;
        this.format_currency = this.format_currency.bind(this);

        this.setup_filters();
        this.bind_events();
        this.fetch_data();
    }

    // ... (setup_filters and bind_events remain same, skipping for brevity in this tool call if possible, but replace_file_content needs context. 
    // Actually, I'll just replace the constructor and fetch_data parts or the whole class if easier.
    // Let's replace the constructor first.


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
        console.log("Dashboard: Starting to fetch data...");
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

        console.log("Dashboard: Company =", company, "Period =", period);

        const method = this.config.method || 'apex_dashboard.apex_dashboard.page.dashboard_template.dashboard_template.get_dashboard_data';

        frappe.call({
            method: method,
            args: args,
            callback: (r) => {
                console.log("Dashboard: API Response received", r);
                this.show_loader(false);
                if (r.message) {
                    this.render(r.message);
                } else {
                    console.error("Dashboard: No data returned");
                    this.wrapper.find('#dashboard-content').html(
                        '<div class="alert alert-danger">Error loading dashboard data.</div>'
                    );
                }
            },
            error: (r) => {
                this.show_loader(false);
                console.error("Dashboard: API Error", r);
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
        console.log("Dashboard: Rendering data", data);

        // Update Header
        try {
            const total = data.total || 0;
            const currency = data.currency || 'EGP';
            this.wrapper.find('#total-value').text(this.format_currency(total, currency));
            this.wrapper.find('#last-updated').text(frappe.datetime.now_datetime());
        } catch (e) {
            console.error("Dashboard: Error updating header", e);
        }

        // Render Groups
        const grid = this.wrapper.find('#dashboard-content');
        grid.empty();

        if (!data.groups || data.groups.length === 0) {
            grid.html('<div class="alert alert-info">No data found for this period.</div>');
            return;
        }

        data.groups.forEach(group => {
            // Use color from backend for gradient background and border
            let cardStyle = '';
            const color = group.color || this.get_theme_class(group.name); // Fallback if no color

            if (color) {
                // If it's a hex color
                if (color.startsWith('#')) {
                    const textColor = this.getContrastColor(color);
                    cardStyle = `
                        color: ${textColor};
                        background: linear-gradient(135deg, ${color}40 0%, ${color}10 100%);
                        border-left: 4px solid ${color} !important;
                    `;
                } else {
                    // It's a class name (fallback)
                    // We can't easily set dynamic contrast for class names without more logic
                    // So we might just leave it or rely on CSS
                }
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

            const cardHtml = `
                <div class="category-card" style="${cardStyle}">
                    <div class="card-header">
                        <div class="card-title-row">
                            <h3 class="card-title">${group.name}</h3>
                            ${group.accounts && group.accounts.length > 0 ? '<i class="fa fa-chevron-down expand-icon"></i>' : ''}
                        </div>
                        <div class="card-amount">${this.format_currency(group.total, data.currency)}</div>
                    </div>
                    ${accountsHtml ? `<div class="card-body" style="display: none;">${accountsHtml}</div>` : ''}
                </div>
            `;

            grid.append(cardHtml);
        });

        // Attach expand/collapse handlers
        grid.find('.category-card').on('click', function () {
            const body = $(this).find('.card-body');
            const icon = $(this).find('.expand-icon');

            if (body.length) {
                body.slideToggle(300);
                icon.toggleClass('fa-chevron-down fa-chevron-up');
            }
        });
    }

    get_theme_class(name) {
        const themes = ['theme-blue', 'theme-green', 'theme-orange', 'theme-purple', 'theme-pink'];
        const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return themes[hash % themes.length];
    }

    format_currency(value, currency = 'EGP') {
        const precision = 2;
        const formatted = parseFloat(value || 0).toLocaleString('en-US', {
            minimumFractionDigits: precision,
            maximumFractionDigits: precision
        });
        return `${formatted} ${currency}`;
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
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // Return black for light backgrounds, white for dark backgrounds
        return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
    }
}
