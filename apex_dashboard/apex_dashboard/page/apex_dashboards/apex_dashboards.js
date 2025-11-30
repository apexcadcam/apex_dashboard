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

    // Add "Add Dashboard" button
    page.add_inner_button(__('Add Dashboard'), function () {
        frappe.new_doc('Apex Dashboard');
    });

    // Add "Manage Categories" button
    page.add_inner_button(__('Manage Categories'), function () {
        frappe.set_route('List', 'Apex Dashboard Category');
    });

    // Initialize
    new ApexDashboardHub(wrapper);
}

class ApexDashboardHub {
    constructor(wrapper) {
        this.wrapper = $(wrapper);
        this.grid = this.wrapper.find('#apex-dashboard-grid');
        this.fetch_dashboards();
    }

    fetch_dashboards() {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Apex Dashboard',
                filters: {
                    is_active: 1
                },
                fields: ['name', 'title', 'category', 'route', 'icon', 'dashboard_type']
            },
            callback: (r) => {
                if (r.message) {
                    this.render_dashboards(r.message);
                }
            }
        });
    }

    render_dashboards(dashboards) {
        this.grid.empty();

        if (dashboards.length === 0) {
            this.grid.append('<div class="text-muted text-center p-5">No active dashboards found.</div>');
            return;
        }

        // Group by category
        const grouped = {};
        dashboards.forEach(dashboard => {
            const category = dashboard.category || 'Other';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(dashboard);
        });

        // Render each category
        Object.keys(grouped).forEach(category => {
            const categorySection = $(`
                <div class="dashboard-category">
                    <h3 class="category-title">${category}</h3>
                    <div class="dashboard-grid"></div>
                </div>
            `);

            const categoryGrid = categorySection.find('.dashboard-grid');
            grouped[category].forEach(dashboard => {
                const cardHtml = this.render_dashboard_card(dashboard);
                categoryGrid.append(cardHtml);
            });

            this.grid.append(categorySection);
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
            const type = $(this).data('type');

            if (route) {
                if (type === 'Custom Page') {
                    // Custom pages have their own .js/.py files - route directly
                    frappe.set_route(route);
                } else {
                    // Dynamic dashboards use generic_dashboard template
                    frappe.set_route('generic_dashboard', route);
                }
            }
        });
    }
}
