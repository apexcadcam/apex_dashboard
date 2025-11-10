frappe.pages["employee-custody-dashboard"].on_page_load = function (wrapper) {
	frappe.require(
		[
			"assets/apex_dashboard/js/dashboard_common.js",
			"assets/apex_dashboard/css/dashboard_common.css",
		],
		() => init_employee_custody_page(wrapper)
	);
};

function init_employee_custody_page(wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Employee Custody Dashboard"),
		single_column: true,
	});

	const state = {
		filters: {
			company: frappe.defaults.get_user_default("company"),
			posting_date: frappe.datetime.get_today(),
		},
		data: null,
	};

	const layout = build_employee_custody_layout(page);
	setup_employee_custody_filters(page, state, refresh);

	function refresh() {
		page.set_indicator(__("جارِ التحميل..."), "blue");
		frappe
			.call("apex_dashboard.apex_dashboard.page.employee_custody_dashboard.employee_custody_dashboard.get_dashboard_data", {
				company: state.filters.company,
				posting_date: state.filters.posting_date,
			})
			.then((response) => {
				const payload = response.message || {};
				if (!payload.success) {
					throw new Error(payload.error || __("فشل تحميل بيانات العهد والسلف."));
				}
				state.data = payload.data || {};
				state.filters = Object.assign({}, state.filters, payload.filters || {});
				render_employee_custody_dashboard(layout, state.data);
				page.set_indicator(__("جاهز"), "green");
			})
			.catch((error) => {
				console.error(error);
				page.set_indicator(__("خطأ"), "red");
				frappe.msgprint({
					title: __("خطأ"),
					message: error.message || __("تعذر تحميل لوحة العهد والسلف."),
					indicator: "red",
				});
			});
	}

	refresh();
}

function build_employee_custody_layout(page) {
	const $container = $(page.body);
	$container.empty();

	const $wrapper = $(`
		<div class="gt-dashboard-wrapper">
			<section class="gt-dashboard-section">
				<div class="gt-dashboard-cards" data-role="kpis"></div>
			</section>
			<section class="gt-dashboard-section gt-dashboard-section--split">
				<div class="gt-dashboard-alerts" data-role="alerts"></div>
				<div class="gt-dashboard-section" data-role="summary"></div>
			</section>
			<section class="gt-dashboard-section" data-role="sections"></section>
		</div>
	`);

	$container.append($wrapper);

	return {
		kpis: $wrapper.find('[data-role="kpis"]')[0],
		alerts: $wrapper.find('[data-role="alerts"]')[0],
		sections: $wrapper.find('[data-role="sections"]')[0],
	};
}

function setup_employee_custody_filters(page, state, refresh) {
	const company_field = page.add_field({
		fieldtype: "Link",
		fieldname: "company",
		label: __("شركة"),
		options: "Company",
		default: state.filters.company,
		change() {
			state.filters.company = company_field.get_value();
			refresh();
		},
	});

	const date_field = page.add_field({
		fieldtype: "Date",
		fieldname: "posting_date",
		label: __("تاريخ"),
		default: state.filters.posting_date,
		change() {
			state.filters.posting_date = date_field.get_value();
			refresh();
		},
	});

	page.add_action_icon("refresh", () => refresh());
}

function render_employee_custody_dashboard(layout, data) {
	render_employee_custody_kpis(layout.kpis, data.kpis || []);
	render_employee_custody_alerts(layout.alerts, data.alerts || []);
	render_employee_custody_sections(layout.sections, data.sections || []);
}

function render_employee_custody_kpis(container, kpis) {
	if (!container) return;
	const cards = kpis.map((kpi) => {
		const totals = kpi.totals || {};
		const baseValue = totals.base || 0;
		const byCurrency = totals.by_currency || {};
		const subtitle = Object.keys(byCurrency)
			.map((currency) => DashboardCommon.formatCurrency(byCurrency[currency], currency))
			.join(" • ");

		return {
			title: kpi.label || "",
			value: DashboardCommon.formatCurrency(
				baseValue,
				frappe.defaults.get_default("currency") || frappe.sys_defaults.currency || "EGP"
			),
			subtitle,
			indicator: kpi.indicator || "info",
		};
	});

	DashboardCommon.renderCards(container, cards);
}

function render_employee_custody_alerts(container, alerts) {
	if (!container) return;
	container.innerHTML = "";

	if (!alerts.length) {
		container.innerHTML = `<div class="gt-dashboard-empty">${__("لا توجد تنبيهات")}</div>`;
		return;
	}

	alerts.forEach((alert) => {
		const item = document.createElement("div");
		item.className = `gt-dashboard-alert level-${alert.level || "info"}`;
		item.innerHTML = `
			<span class="gt-dashboard-alert__badge">${(alert.level || "").toUpperCase()}</span>
			<span class="gt-dashboard-alert__message">${frappe.utils.escape_html(alert.message || "")}</span>
		`;
		container.appendChild(item);
	});
}

function render_employee_custody_sections(container, sections) {
	if (!container) return;
	container.innerHTML = "";

	if (!sections.length) {
		container.innerHTML = `<div class="gt-dashboard-empty">${__("لا توجد بيانات تفصيلية")}</div>`;
		return;
	}

	sections.forEach((section) => {
		const card = document.createElement("div");
		card.className = "gt-dashboard-subcard";

		const header = document.createElement("div");
		header.className = "gt-dashboard-section__header";
		const title = document.createElement("h4");
		title.className = "gt-dashboard-section__title";
		title.innerText = section.label || "";
		header.appendChild(title);
		header.appendChild(DashboardCommon.buildTotalsRow(section.totals || {}));
		card.appendChild(header);

		const tableContainer = document.createElement("div");
		card.appendChild(tableContainer);
		DashboardCommon.renderGroupTable(tableContainer, section.balances || []);

		container.appendChild(card);
	});
}

