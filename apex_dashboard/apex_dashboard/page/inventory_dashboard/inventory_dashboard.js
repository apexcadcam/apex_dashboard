frappe.pages['inventory_dashboard'].on_page_load = function (wrapper) {
    new InventoryDashboard(wrapper);
};

class InventoryDashboard {
    constructor(wrapper) {
        this.wrapper = $(wrapper);

        this.page = frappe.ui.make_app_page({
            parent: wrapper,
            title: 'Inventory Dashboard',
            single_column: true
        });

        const TEMPLATE = `
		<div class="inventory-dashboard dashboard-template">
			<div class="dashboard-header">
				<div class="header-content">
					<button class="btn-glass" id="back-btn">
						<i class="fa fa-arrow-left"></i> Hub
					</button>
					<div class="header-text">
						<h1>Inventory Overview</h1>
						<p class="subtitle">Real-time Stock Value & Alerts</p>
					</div>
				</div>
				<div class="header-actions">
					<div class="total-card" style="padding: 10px 20px; min-width: 200px;">
						<span class="label" style="font-size: 12px; color: #9ca3af; display: block;">Total Stock Value</span>
						<span class="value" id="header-total-value" style="font-size: 20px; font-weight: bold;">Loading...</span>
					</div>
					<button class="btn-glass" id="refresh-btn">
						<i class="fa fa-refresh"></i>
					</button>
					<button class="btn-glass" id="config-btn">
						<i class="fa fa-cog"></i>
					</button>
				</div>
			</div>

			<div id="dashboard-loader" class="dashboard-loader">
				<div class="spinner"></div>
				<p>Fetching inventory data...</p>
			</div>

			<div id="dashboard-content" style="display: none;">
				<!-- Content will be injected here -->
			</div>
			
			<div class="dashboard-footer">
				<p>Last updated: <span id="last-updated">-</span></p>
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

        this.wrapper.find('#config-btn').on('click', () => {
            frappe.set_route('Form', 'Apex Dashboard Config', 'Apex Dashboard Config');
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
            method: 'apex_dashboard.apex_dashboard.page.inventory_dashboard.inventory_dashboard.get_dashboard_data',
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
                }
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
        const currency = data.currency || 'EGP';
        this.wrapper.find('#last-updated').text(frappe.datetime.now_datetime());
        this.wrapper.find('#header-total-value').text(this.format_currency(data.total_stock.value, currency));

        const content = `
			<div class="inventory-container">
				<!-- Total Stock Card (Top) -->
				<div class="total-stock-card">
					<h2>💰 Total Stock Value</h2>
					<div class="total-value">${this.format_currency(data.total_stock.value, currency)}</div>
					<div class="total-items">${data.total_stock.items} items across all categories</div>
				</div>
				
				<!-- Main Category Cards (Dynamic) -->
				<div class="category-cards">
					${data.groups.map(group => this.render_category_card(group, currency)).join('')}
				</div>
				
				<!-- Alerts Section -->
				${data.alerts.total_alerts > 0 ? this.render_alerts(data.alerts) : ''}
				
				<!-- Bottom Grid -->
				<div class="content-grid">
					<!-- Top Items -->
					<div class="dashboard-card">
						<h3>⭐ Top Items by Value</h3>
						${this.render_top_items(data.top_items, currency)}
					</div>
					
					 <!-- Warehouse Breakdown -->
					<div class="dashboard-card">
						<h3>🏭 Warehouse Breakdown</h3>
						${this.render_warehouses(data.warehouses, currency)}
					</div>
				</div>
			</div>
		`;

        this.wrapper.find('#dashboard-content').html(content);
    }

    render_category_card(group, currency) {
        const textColor = this.getContrastColor(group.color);
        const cardStyle = `
			background: linear-gradient(135deg, ${group.color}40 0%, ${group.color}10 100%);
			border-left: 4px solid ${group.color};
			color: ${textColor};
		`;

        const detailsHtml = this.render_card_details(group.details);

        return `
			<div class="category-card-new" style="${cardStyle}">
				<div class="card-header-new">
					<div class="card-title-group">
						<i class="${group.icon}" style="color: ${group.color}"></i>
						<span>${group.name}</span>
					</div>
					<div class="card-value-new">${this.format_currency(group.value, currency)}</div>
				</div>
				
				<div class="card-stats-new">
					<span>${Math.round(group.qty)} units</span>
					<span>${group.items} types</span>
				</div>
				
				${detailsHtml}
			</div>
		`;
    }

    render_card_details(details) {
        if (!details || details.length === 0) return '';

        const itemsHtml = details.slice(0, 5).map(item => {
            const stockBalanceUrl = `/app/query-report/Stock Balance?item_group=${encodeURIComponent(item.item_group)}`;
            return `
				<div class="card-detail-item clickable" onclick="window.location.href='${stockBalanceUrl}'" title="Click to view Stock Balance Report">
					<span class="detail-name">${item.item_group}</span>
					<div class="detail-stats">
						<span class="detail-qty">${Math.round(item.qty || 0)}</span>
					</div>
				</div>
			`;
        }).join('');

        return `<div class="card-details">${itemsHtml}</div>`;
    }

    render_alerts(alerts) {
        let html = '<div class="alerts-section">';

        if (alerts.out_of_stock && alerts.out_of_stock.length > 0) {
            html += '<div class="alert-card critical">';
            html += '<h3>🔴 Out of Stock / Negative Stock</h3>';
            html += '<div class="alert-list">';
            alerts.out_of_stock.forEach(item => {
                html += `
					<div class="alert-item">
						<span class="item-name">${item.item_name}</span>
						<span class="stock-info">Qty: ${item.actual_qty} ${item.stock_uom}</span>
						<span class="warehouse">${item.warehouse}</span>
					</div>
				`;
            });
            html += '</div></div>';
        }

        if (alerts.low_stock && alerts.low_stock.length > 0) {
            html += '<div class="alert-card warning">';
            html += '<h3>🟡 Low Stock (< 10 units)</h3>';
            html += '<div class="alert-list">';
            alerts.low_stock.forEach(item => {
                html += `
					<div class="alert-item">
						<span class="item-name">${item.item_name}</span>
						<span class="stock-info">${item.actual_qty} ${item.stock_uom}</span>
						<span class="warehouse">${item.warehouse}</span>
					</div>
				`;
            });
            html += '</div></div>';
        }

        html += '</div>';
        return html;
    }

    render_top_items(items, currency) {
        if (!items || items.length === 0) {
            return '<p class="no-data">No items available</p>';
        }

        let html = '<div class="items-list">';
        items.forEach((item, index) => {
            const itemUrl = `/app/query-report/Stock Balance?item_code=${encodeURIComponent(item.item_name)}`;
            html += `
				<div class="item-row clickable" onclick="window.location.href='${itemUrl}'">
					<span class="item-rank">${index + 1}</span>
					<div class="item-info">
						<div class="item-name">${item.item_name}</div>
						<div class="item-group">${item.item_group}</div>
					</div>
					<div class="item-stats">
						<div class="item-qty">${item.actual_qty} ${item.stock_uom}</div>
						<div class="item-value">${this.format_currency(item.stock_value, currency)}</div>
					</div>
				</div>
			`;
        });
        html += '</div>';
        return html;
    }

    render_warehouses(warehouses, currency) {
        if (!warehouses || warehouses.length === 0) {
            return '<p class="no-data">No warehouse data available</p>';
        }

        let html = '<div class="items-list">';
        warehouses.forEach((wh, index) => {
            const warehouseUrl = `/app/query-report/Stock Balance?warehouse=${encodeURIComponent(wh.warehouse)}`;
            html += `
				<div class="item-row clickable" onclick="window.location.href='${warehouseUrl}'">
					<span class="item-rank">${index + 1}</span>
					<div class="item-info">
						<div class="item-name">${wh.warehouse}</div>
					</div>
					<div class="item-stats">
						<div class="item-qty">${wh.total_qty} units</div>
						<div class="item-value">${this.format_currency(wh.total_value, currency)}</div>
					</div>
				</div>
			`;
        });
        html += '</div>';
        return html;
    }

    format_currency(value, currency = 'EGP') {
        if (!value) return `0.00 ${currency}`;
        return `${parseFloat(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} ${currency}`;
    }
}
