frappe.pages['profitability_dashboard'].on_page_load = function (wrapper) {
    new ProfitabilityDashboard(wrapper);
};

class ProfitabilityDashboard {
    constructor(wrapper) {
        this.wrapper = $(wrapper);

        this.page = frappe.ui.make_app_page({
            parent: wrapper,
            title: 'Profitability Dashboard',
            single_column: true
        });

        // Load CSS
        frappe.require('/assets/apex_dashboard/page/profitability_dashboard/profitability_dashboard.css');

        const TEMPLATE = `
        <div class="profitability-dashboard dashboard-template">
            <div class="dashboard-header" style="margin-top: 10px;">
                <div class="header-content">
                    <div class="header-text">
                        <h1>Profitability Overview</h1>
                        <p class="subtitle">Track your item and supplier profitability</p>
                    </div>
                </div>
                <div class="header-actions">
                    <div class="total-card">
                        <span class="label" style="font-size: 12px; color: #9ca3af; display: block;">Total Net Profit</span>
                        <span class="value" id="total-profit-header" style="font-size: 20px; font-weight: bold;">Loading...</span>
                    </div>
                </div>
            </div>

            <div id="dashboard-loader" class="loader-container">
                <div class="spinner"></div>
                <p>Calculating profitability metrics...</p>
            </div>

            <!-- Summary Cards -->
            <div id="metrics-section" class="metrics-grid" style="display: none;">
                <div class="metric-card theme-green">
                    <span class="metric-label">TOTAL NET PROFIT</span>
                    <span class="metric-value" id="summary-total-profit">0 ج.م</span>
                    <span class="metric-subvalue" id="summary-profit-margin">0% Net Margin</span>
                </div>
                <div class="metric-card theme-blue">
                    <span class="metric-label">TOTAL REVENUE</span>
                    <span class="metric-value" id="summary-total-revenue">0 ج.م</span>
                    <span class="metric-subvalue">Gross Sales</span>
                </div>
                <div class="metric-card theme-blue">
                    <span class="metric-label">BEST ITEM</span>
                    <span class="metric-value" id="summary-best-item">-</span>
                    <span class="metric-subvalue" id="summary-best-item-profit">0 ج.م</span>
                </div>
                <div class="metric-card theme-purple">
                    <span class="metric-label">BEST SUPPLIER</span>
                    <span class="metric-value" id="summary-best-supplier">-</span>
                    <span class="metric-subvalue" id="summary-best-supplier-profit">0 ج.م</span>
                </div>
            </div>

            <!-- Content Grid -->
            <div id="dashboard-content" class="dashboard-grid" style="display: none;">
                <!-- Top Items -->
                <div class="category-card">
                    <div class="category-header">
                        <div class="category-info">
                            <span class="category-name">🏆 Top Items by Profit</span>
                        </div>
                    </div>
                    <div class="category-body" id="top-items-list">
                        <!-- Items injected here -->
                    </div>
                </div>

                <!-- Top Suppliers -->
                <div class="category-card">
                    <div class="category-header">
                        <div class="category-info">
                            <span class="category-name">🤝 Top Suppliers by Profit</span>
                        </div>
                    </div>
                    <div class="category-body" id="top-suppliers-list">
                        <!-- Suppliers injected here -->
                    </div>
                </div>
            </div>
            
            <div class="dashboard-footer">
                <p>Data based on Sales & Purchase Invoices. Last updated: <span id="last-updated">-</span></p>
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

        this.setup_filters();
        this.add_custom_buttons_to_filters();
        this.bind_events();
        this.load_data();
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
                refreshBtn.find('button').on('click', () => this.load_data());
                
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

        // Fiscal Year Filter (Hidden by default, shown when Period is 'Fiscal Year')
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

        // Date range filters (hidden by default via logic)
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
            method: 'apex_dashboard.apex_dashboard.page.profitability_dashboard.profitability_dashboard.get_dashboard_data',
            args: { company, period, from_date, to_date, fiscal_year },
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
            this.wrapper.find('#metrics-section').hide();
            this.wrapper.find('#dashboard-content').hide();
        } else {
            this.wrapper.find('#dashboard-loader').hide();
            this.wrapper.find('#metrics-section').css('display', 'grid');
            this.wrapper.find('#dashboard-content').css('display', 'grid');
        }
    }

    render(data) {
        const summary = data.summary || {};
        const items = data.item_profitability || [];
        const suppliers = data.supplier_profitability || [];
        const currency = data.currency || 'EGP';

        // Update Header
        this.wrapper.find('#total-profit-header').text(this.format_currency(summary.total_profit, currency));
        this.wrapper.find('#last-updated').text(frappe.datetime.now_datetime());

        // Update Summary Cards
        // Changed to Net Profit
        this.wrapper.find('#summary-total-profit').text(this.format_currency(summary.total_profit, currency));
        this.wrapper.find('#summary-profit-margin').text(`${(summary.overall_margin || 0).toFixed(2)}% Net Margin`);

        // Update label to Net Profit
        this.wrapper.find('#summary-total-profit').parent().find('.metric-label').text('TOTAL NET PROFIT');

        this.wrapper.find('#summary-total-revenue').text(this.format_currency(summary.total_revenue, currency));

        // Fix: Access properties from best_item/best_supplier objects, not summary root
        const bestItemName = summary.best_item ? summary.best_item.item_name : '-';
        const bestItemProfit = summary.best_item ? summary.best_item.net_profit : 0; // Net Profit
        this.wrapper.find('#summary-best-item').text(bestItemName);
        this.wrapper.find('#summary-best-item-profit').text(this.format_currency(bestItemProfit, currency));

        const bestSupplierName = summary.best_supplier ? summary.best_supplier.supplier_name : '-';
        const bestSupplierProfit = summary.best_supplier ? summary.best_supplier.net_profit : 0; // Net Profit
        const bestSupplierCard = this.wrapper.find('#summary-best-supplier').parent();

        this.wrapper.find('#summary-best-supplier').text(bestSupplierName);
        this.wrapper.find('#summary-best-supplier-profit').text(this.format_currency(bestSupplierProfit, currency));

        // Add drill-down to Best Supplier card
        if (summary.best_supplier) {
            let onClickAction = () => frappe.set_route('Form', 'Supplier', summary.best_supplier.supplier);
            if (summary.best_supplier.invoice_list) {
                const invoiceList = summary.best_supplier.invoice_list.split(',');
                onClickAction = () => frappe.set_route('List', 'Sales Invoice', {
                    name: ['in', invoiceList]
                });
            }
            bestSupplierCard.addClass('clickable').off('click').on('click', onClickAction);
        } else {
            bestSupplierCard.removeClass('clickable').off('click');
        }

        // Render Lists
        this.render_items_list(items, currency);
        this.render_suppliers_list(suppliers, currency);
    }

    render_items_list(items, currency) {
        const container = this.wrapper.find('#top-items-list');
        container.empty();

        if (!items || items.length === 0) {
            container.html('<div class="text-muted text-center p-3">No item data available</div>');
            return;
        }

        try {
            items.forEach((item, index) => {
                const netMargin = parseFloat(item.net_margin || 0);
                const marginColor = netMargin >= 20 ? '#10b981' : netMargin >= 10 ? '#3b82f6' : netMargin >= 0 ? '#f59e0b' : '#ef4444';

                const html = `
                    <div class="account-row clickable" data-item-code="${item.item_code || ''}">
                        <div class="account-info">
                            <div class="item-rank" style="background: ${marginColor}; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: white;">
                                ${index + 1}
                            </div>
                            <div>
                                <div class="account-name">${item.item_name || item.item_code || 'Unknown'}</div>
                                <div class="text-muted" style="font-size: 11px;">${(item.total_qty || 0).toLocaleString()} Units Sold • ${item.item_code || ''}</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="account-balance">${(item.net_profit || 0).toLocaleString()} ${currency}</div>
                            <div style="color: ${marginColor}; font-size: 11px; font-weight: 600;">${netMargin.toFixed(1)}% Net Margin</div>
                        </div>
                    </div>
                `;
                container.append(html);
            });

            // Attach click handler for Items
            container.off('click', '.account-row').on('click', '.account-row', function () {
                const itemCode = $(this).data('item-code');
                if (itemCode) {
                    frappe.set_route('Form', 'Item', itemCode);
                }
            });
        } catch (e) {
            console.error('Error rendering items list:', e);
            container.html(`<div class="text-muted text-center p-3">Error loading items: ${e.message}</div>`);
        }
    }

    render_suppliers_list(suppliers, currency) {
        const container = this.wrapper.find('#top-suppliers-list');
        container.empty();

        if (!suppliers || suppliers.length === 0) {
            container.html('<div class="text-muted text-center p-3">No supplier data available</div>');
            return;
        }

        try {
            suppliers.forEach((supplier, index) => {
                const netMargin = parseFloat(supplier.net_margin || 0);
                const marginColor = netMargin >= 20 ? '#10b981' : netMargin >= 10 ? '#3b82f6' : netMargin >= 0 ? '#f59e0b' : '#ef4444';

                const html = `
                    <div class="account-row clickable" data-supplier="${supplier.supplier || ''}" data-invoice-list="${supplier.invoice_list || ''}">
                        <div class="account-info">
                            <div class="item-rank" style="background: ${marginColor}; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: white;">
                                ${index + 1}
                            </div>
                            <div>
                                <div class="account-name">${supplier.supplier_name || supplier.supplier || 'Unknown'}</div>
                                <div class="text-muted" style="font-size: 11px;">${(supplier.total_qty || 0).toLocaleString()} Units Sold • ${supplier.item_count || 0} Items</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="account-balance">${(supplier.net_profit || 0).toLocaleString()} ${currency}</div>
                            <div style="color: ${marginColor}; font-size: 11px; font-weight: 600;">${netMargin.toFixed(1)}% Net Margin</div>
                        </div>
                    </div>
                `;
                container.append(html);
            });

            // Attach click handler for Suppliers
            container.off('click', '.account-row').on('click', '.account-row', function () {
                const supplier = $(this).data('supplier');
                const invoiceListStr = $(this).data('invoice-list');

                if (invoiceListStr) {
                    const invoiceList = String(invoiceListStr).split(',');
                    frappe.set_route('List', 'Sales Invoice', {
                        name: ['in', invoiceList]
                    });
                } else if (supplier) {
                    frappe.set_route('Form', 'Supplier', supplier);
                }
            });
        } catch (e) {
            console.error('Error rendering suppliers list:', e);
            container.html(`<div class="text-muted text-center p-3">Error loading suppliers: ${e.message}</div>`);
        }
    }

    get_margin_color(margin) {
        if (margin >= 30) return '#10b981'; // Green
        if (margin >= 15) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
    }

    get_duration(firstDate) {
        if (!firstDate) return '';
        const start = moment(firstDate);
        const end = moment();
        const years = end.diff(start, 'years');
        start.add(years, 'years');
        const months = end.diff(start, 'months');

        let duration = '';
        if (years > 0) duration += `${years}y `;
        if (months > 0) duration += `${months}m`;
        if (!duration) duration = 'New';

        return duration;
    }

    format_currency(value, currency = 'EGP') {
        return format_currency(value, currency, 2);
    }
}