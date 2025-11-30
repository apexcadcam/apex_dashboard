frappe.pages['generic_dashboard'].on_page_load = function (wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Dashboard',
        single_column: true
    });

    // Load CSS
    frappe.require('/assets/apex_dashboard/page/generic_dashboard/generic_dashboard.css');

    // Load HTML Template
    $(frappe.render_template('generic_dashboard', {})).appendTo(page.body);

    // Initialize
    wrapper.dashboard_instance = new GenericDashboard(wrapper, page);
}

frappe.pages['generic_dashboard'].refresh = function (wrapper) {
    if (wrapper.dashboard_instance) {
        wrapper.dashboard_instance.refresh();
    }
}

class GenericDashboard {
    constructor(wrapper, page) {
        this.wrapper = $(wrapper);
        this.page = page;
        this.container = this.wrapper.find('.generic-dashboard-content');
        this.title_el = this.wrapper.find('.dashboard-title');

        // Setup back button
        this.wrapper.find('.back-to-hub').on('click', () => {
            frappe.set_route('apex_dashboards');
        });

        // Initial load
        this.refresh();
    }

    refresh() {
        // Get dashboard name from route
        this.dashboard_name = this.get_dashboard_name_from_route();

        // Load dashboard
        this.load_dashboard();
    }

    get_dashboard_name_from_route() {
        // Get current route
        const route = frappe.get_route();
        // Route format: ['generic_dashboard', 'dashboard-name']
        return route[1] || '';
    }

    load_dashboard() {
        if (!this.dashboard_name) {
            this.show_error('No dashboard specified');
            return;
        }

        frappe.call({
            method: 'apex_dashboard.apex_dashboard.page.generic_dashboard.generic_dashboard.get_dashboard_config',
            args: {
                dashboard_name: this.dashboard_name
            },
            callback: (r) => {
                if (r.message) {
                    this.render_dashboard(r.message);
                }
            },
            error: (r) => {
                this.show_error('Dashboard not found');
            }
        });
    }

    render_dashboard(config) {
        // Update title
        this.title_el.text(config.title);
        this.page.set_title(config.title);

        // Parse config_json if exists
        let dashboard_config = {};
        if (config.config_json) {
            try {
                dashboard_config = JSON.parse(config.config_json);
            } catch (e) {
                console.error('Error parsing dashboard config:', e);
            }
        }

        // Clear container
        this.container.empty();

        // Check if we have content to render
        if (dashboard_config.cards || dashboard_config.charts) {
            this.render_content(dashboard_config);
        } else {
            // Default template
            this.show_coming_soon(config);
        }
    }

    render_content(config) {
        // Render Cards Section
        if (config.cards && config.cards.length > 0) {
            const cardsContainer = $('<div class="dashboard-stats-grid"></div>');
            config.cards.forEach(card => {
                const cardHtml = `
                    <div class="stat-card" style="border-left: 4px solid ${card.color || '#007aff'};">
                        <div class="stat-label">${card.label}</div>
                        <div class="stat-value">${card.value}</div>
                        ${card.description ? `<div class="stat-desc">${card.description}</div>` : ''}
                    </div>
                `;
                cardsContainer.append(cardHtml);
            });
            this.container.append(cardsContainer);
        }

        // Render Charts Section
        if (config.charts && config.charts.length > 0) {
            const chartsContainer = $('<div class="dashboard-charts-grid"></div>');
            config.charts.forEach((chart, index) => {
                const chartId = `chart-${index}`;
                const chartHtml = `
                    <div class="chart-card">
                        <div class="chart-header">${chart.title}</div>
                        <div id="${chartId}" class="chart-body"></div>
                    </div>
                `;
                chartsContainer.append(chartHtml);

                // Initialize chart after append
                setTimeout(() => {
                    this.render_chart(chartId, chart);
                }, 100);
            });
            this.container.append(chartsContainer);
        }
    }

    render_chart(elementId, chartConfig) {
        const data = chartConfig.data || {
            labels: [],
            datasets: []
        };

        new frappe.Chart(`#${elementId}`, {
            title: '',
            data: data,
            type: chartConfig.type || 'bar',
            height: 250,
            colors: chartConfig.colors || ['#007aff', '#34c759', '#ff9500']
        });
    }

    show_coming_soon(config) {
        // Clear container
        this.container.empty();

        // Render Cards Section
        if (config.cards && config.cards.length > 0) {
            const cardsContainer = $('<div class="dashboard-stats-grid"></div>');
            config.cards.forEach(card => {
                const cardHtml = `
                    <div class="stat-card" style="border-left: 4px solid ${card.color || '#007aff'};">
                        <div class="stat-label">${card.label}</div>
                        <div class="stat-value">${card.value}</div>
                        ${card.description ? `<div class="stat-desc">${card.description}</div>` : ''}
                    </div>
                `;
                cardsContainer.append(cardHtml);
            });
            this.container.append(cardsContainer);
        }

        // Render Charts Section
        if (config.charts && config.charts.length > 0) {
            const chartsContainer = $('<div class="dashboard-charts-grid"></div>');
            config.charts.forEach((chart, index) => {
                const chartId = `chart-${index}`;
                const chartHtml = `
                    <div class="chart-card">
                        <div class="chart-header">${chart.title}</div>
                        <div id="${chartId}" class="chart-body"></div>
                    </div>
                `;
                chartsContainer.append(chartHtml);

                // Initialize chart after append
                setTimeout(() => {
                    this.render_chart(chartId, chart);
                }, 100);
            });
            this.container.append(chartsContainer);
        }
    }

    show_error(message) {
        this.container.html(`
            <div class="coming-soon-container">
                <div class="coming-soon-icon">
                    <i class="fa fa-exclamation-triangle"></i>
                </div>
                <h3 class="coming-soon-title">Error</h3>
                <p class="coming-soon-message">${message}</p>
            </div>
        `);
    }
}
