frappe.pages['test3_dashboard'].on_page_load = function(wrapper) {
    new test3dashboard(wrapper);
};

class test3dashboard {
    constructor(wrapper) {
        this.page = frappe.ui.make_app_page({
            parent: wrapper,
            title: 'test3 dashboard',
            single_column: true
        });
        
        this.wrapper = $(wrapper);
        this.page.main.addClass('test3-dashboard');
        
        this.setup_filters();
        this.load_data();
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
            options: ['Today', 'This Week', 'This Month', 'Last Month', 'This Year', 'Last Year', 'Custom', 'All Time'],
            default: 'This Month',
            change: () => {
                if (this.page.fields_dict.period.get_value() === 'Custom') {
                    this.page.fields_dict.from_date.$wrapper.show();
                    this.page.fields_dict.to_date.$wrapper.show();
                } else {
                    this.page.fields_dict.from_date.$wrapper.hide();
                    this.page.fields_dict.to_date.$wrapper.hide();
                    this.load_data();
                }
            }
        });
        
        // Date range filters (hidden by default)
        this.page.add_field({
            fieldname: 'from_date',
            label: __('From Date'),
            fieldtype: 'Date',
            hidden: 1,
            change: () => this.load_data()
        });
        
        this.page.add_field({
            fieldname: 'to_date',
            label: __('To Date'),
            fieldtype: 'Date',
            hidden: 1,
            change: () => this.load_data()
        });
    }
    
    load_data() {
        const company = this.page.fields_dict.company.get_value();
        const period = this.page.fields_dict.period.get_value();
        const from_date = this.page.fields_dict.from_date.get_value();
        const to_date = this.page.fields_dict.to_date.get_value();
        
        frappe.call({
            method: 'apex_dashboard.apex_dashboard.page.test3_dashboard.test3_dashboard.get_dashboard_data',
            args: { company, period, from_date, to_date },
            callback: (r) => {
                if (r.message) {
                    this.render(r.message);
                }
            }
        });
    }
    
    render(data) {
        this.page.main.html(`
            <div class="dashboard-container">
                <div class="dashboard-header">
                    <h2>Total: ${this.format_currency(data.total, data.currency)}</h2>
                    <p>Period: ${data.period.from_date} to ${data.period.to_date}</p>
                </div>
                <div class="dashboard-grid">
                    ${data.groups.map(group => this.render_card(group, data.currency)).join('')}
                </div>
            </div>
        `);
    }
    
    render_card(group, currency) {
        const accountsHtml = group.accounts && group.accounts.length > 0 
            ? `<div class="card-body" style="display: none;">
                ${group.accounts.map(acc => `
                    <div class="account-row">
                        <span class="account-name">${acc.name}</span>
                        <span class="account-balance">${this.format_currency(acc.balance, currency)}</span>
                    </div>
                `).join('')}
               </div>`
            : '';
        
        return `
            <div class="category-card" style="border-left: 4px solid ${group.color}">
                <div class="card-header">
                    <h3>${group.name}</h3>
                    <div class="card-amount">${this.format_currency(group.total, currency)}</div>
                </div>
                ${accountsHtml}
            </div>
        `;
    }
    
    format_currency(value, currency = 'EGP') {
        return `${parseFloat(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} ${currency}`;
    }
}