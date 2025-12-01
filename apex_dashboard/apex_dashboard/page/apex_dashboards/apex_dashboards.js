frappe.pages['apex_dashboards'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Apex Dashboards',
        single_column: true
    });

    // Load CSS
    frappe.require('/assets/apex_dashboard/page/apex_dashboards/apex_dashboards.css');

    // Load HTML Template
    $(frappe.render_template('apex_dashboards', {})).appendTo(page.body);

    // Initialize
    new ApexDashboardHub(wrapper);
}

class ApexDashboardHub {
    constructor(wrapper) {
        this.wrapper = $(wrapper);
        this.grid = this.wrapper.find('#apex-dashboard-grid');
        this.render_dashboards();
    }

    get_dashboards() {
        return [
            {
                name: 'Expenses Dashboard',
                title: 'Expenses Dashboard',
                category: 'Finance',
                route: 'expenses_dashboard',
                icon: 'fa fa-credit-card',
                dashboard_type: 'Custom Page'
            },
            {
                name: 'Liquidity Dashboard',
                title: 'Liquidity Dashboard',
                category: 'Finance',
                route: 'liquidity_dashboard',
                icon: 'fa fa-university',
                dashboard_type: 'Custom Page'
            },
            {
                name: 'Profitability Dashboard',
                title: 'Profitability Dashboard',
                category: 'Finance',
                route: 'profitability_dashboard',
                icon: 'fa fa-line-chart',
                dashboard_type: 'Custom Page'
            },
            {
                name: 'Inventory Dashboard',
                title: 'Inventory Dashboard',
                category: 'Operations',
                route: 'inventory_dashboard',
                icon: 'fa fa-cubes',
                dashboard_type: 'Custom Page'
            },
            {
                name: 'Suppliers Dashboard',
                title: 'Suppliers Dashboard',
                category: 'Operations',
                route: 'suppliers_dashboard',
                icon: 'fa fa-truck',
                dashboard_type: 'Custom Page'
            },
            {
                name: 'Equity Dashboard',
                title: 'Equity Dashboard',
                category: 'Finance',
                route: 'equity_dashboard',
                icon: 'fa fa-balance-scale',
                dashboard_type: 'Custom Page'
            }
        ];
    }

    render_dashboards() {
        const dashboards = this.get_dashboards();
        this.grid.empty();

        // Render all cards in a single grid (no category grouping)
        dashboards.forEach(dashboard => {
            const cardHtml = this.render_dashboard_card(dashboard);
            this.grid.append(cardHtml);
        });

        this.attach_card_listeners();
    }

    render_dashboard_card(dashboard) {
        const colors = {
            'Finance': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'CRM': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'Inventory': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'Maintenance': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'Operations': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'Expenses': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
        };

        const gradient = colors[dashboard.category] || 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)';
        const icon = dashboard.icon || 'fa fa-dashboard';

        return `
            <div class="dashboard-card" data-route="${dashboard.route}" data-type="${dashboard.dashboard_type}">
                <div class="dashboard-icon" style="background: ${gradient};">
                    <i class="${icon}"></i>
                </div>
                <h3 class="dashboard-title">${dashboard.title}</h3>
                <p class="dashboard-description">Click to view</p>
            </div>
        `;
    }

    attach_card_listeners() {
        this.grid.find('.dashboard-card').on('click', function () {
            const route = $(this).data('route');

            if (route) {
                frappe.set_route(route);
            }
        });
    }
}
