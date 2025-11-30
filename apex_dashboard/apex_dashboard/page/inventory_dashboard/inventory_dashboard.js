frappe.pages['inventory_dashboard'].on_page_load = function (wrapper) {
    new InventoryDashboard(wrapper);
};

class InventoryDashboard {
    constructor(wrapper) {
        this.page = frappe.ui.make_app_page({
            parent: wrapper,
            title: 'Inventory Dashboard',
            single_column: true
        });

        this.wrapper = $(wrapper);

        // Load CSS
        // We assume the CSS is shared or we rely on inline styles for now to match Liquidity
        // Ideally we should load a specific CSS file if it exists, but for now we'll use the classes

        const TEMPLATE = `
        <div class="inventory-dashboard">
            <div class="dashboard-header">
                <div class="header-content">
                    <button class="btn-glass" id="back-btn" style="margin-right: 15px;">
                        <i class="fa fa-arrow-left"></i> Hub
                    </button>
                    <div class="title-section">
                        <h1>Inventory Overview</h1>
                        <p class="subtitle">Real-time Stock Value & Alerts</p>
                    </div>
                </div>
                <div class="header-actions">
                    <div class="company-filter-wrapper">
                        <!-- Company filter will be injected here or we use standard page field -->
                    </div>
                    <button class="btn btn-glass" id="refresh-btn" title="Refresh">
                        <i class="fa fa-refresh"></i>
                    </button>
                    <button class="btn btn-glass" id="config-btn" title="Configuration">
                        <i class="fa fa-cog"></i>
                    </button>
                </div>
            </div>

            <div id="dashboard-loader" class="loader-container" style="display: none; text-align: center; padding: 50px;">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
                <p style="margin-top: 10px; color: #666;">Fetching inventory data...</p>
            </div>

            <div id="dashboard-content" class="dashboard-grid" style="display: none;">
                <!-- Content will be injected here -->
            </div>

            <div class="dashboard-footer">
                <p>Last updated: <span id="last-updated">-</span></p>
            </div>
        </div>
        `;

        $(TEMPLATE).appendTo(this.page.body);

        // Hide standard page title area to avoid duplication if we use custom header
        this.page.main.find('.page-head').hide();

        this.setup_actions();
        this.load_data();
    }

    setup_actions() {
        // Back to Hub
        this.wrapper.find('#back-btn').on('click', () => {
            frappe.set_route('apex_dashboards');
        });

        // Config Button
        this.wrapper.find('#config-btn').on('click', () => {
            frappe.set_route('Form', 'Apex Dashboard Config', 'Apex Dashboard Config');
        });

        // Refresh Button
        this.wrapper.find('#refresh-btn').on('click', () => {
            this.load_data();
        });

        // We can use the standard page field for Company as it handles the dropdown UI well
        // But we need to make sure it's visible or move it. 
        // Let's use the standard page field but maybe position it differently or just keep it simple.
        // Since we hid .page-head, the standard field is hidden. We need to create our own dropdown or unhide just the field.
        // For simplicity and "Glass" look, let's create a custom select or just use a standard Frappe field in the custom header.

        // Actually, let's just use a simple HTML select for company in the header actions
        const companySelect = $(`<select class="form-control input-sm" style="width: 150px; display: inline-block; margin-right: 10px;">`).appendTo(this.wrapper.find('.company-filter-wrapper'));

        // Populate companies
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Company',
                fields: ['name']
            },
            callback: (r) => {
                if (r.message) {
                    r.message.forEach(c => {
                        companySelect.append($('<option>', {
                            value: c.name,
                            text: c.name,
                            selected: c.name === frappe.defaults.get_user_default('Company')
                        }));
                    });
                }
            }
        });

        companySelect.on('change', () => {
            this.load_data();
        });

        this.companySelect = companySelect;
    }

    load_data() {
        const company = this.companySelect ? this.companySelect.val() : frappe.defaults.get_user_default('Company');

        this.show_loader(true);

        frappe.call({
            method: 'apex_dashboard.apex_dashboard.page.inventory_dashboard.inventory_dashboard.get_dashboard_data',
            args: { company },
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
