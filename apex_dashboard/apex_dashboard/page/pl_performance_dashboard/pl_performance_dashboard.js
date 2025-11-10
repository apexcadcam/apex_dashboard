frappe.pages["pl-performance-dashboard"].on_page_load = function (wrapper) {
	frappe.require(
		[
			"assets/apex_dashboard/js/dashboard_common.js",
			"assets/apex_dashboard/css/dashboard_common.css",
		],
		() => init_pl_dashboard(wrapper)
	);
};

function init_pl_dashboard(wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("P&L Performance Dashboard"),
		single_column: true,
	});

	const state = {
		filters: {
			company: frappe.defaults.get_user_default("company"),
			posting_date: frappe.datetime.get_today(),
			from_date: frappe.datetime.month_start(),
			to_date: frappe.datetime.get_today(),
		},
		data: null,
		chart: null,
	};

	const layout = build_pl_layout(page);
	setup_pl_filters(page, state, refresh);

	function refresh() {
		page.set_indicator(__("جارِ التحميل..."), "blue");
		frappe
			.call("apex_dashboard.apex_dashboard.page.pl_performance_dashboard.pl_performance_dashboard.get_dashboard_data", {
				company: state.filters.company,
				posting_date: state.filters.posting_date,
				from_date: state.filters.from_date,
				to_date: state.filters.to_date,
			})
			.then((response) => {
				const payload = response.message || {};
				if (!payload.success) {
					throw new Error(payload.error || __("فشل تحميل بيانات الأداء الربحي."));
				}
				state.data = payload.data || {};
				state.filters = Object.assign({}, state.filters, payload.filters || {});
				render_pl_dashboard(layout, state);
				page.set_indicator(__("جاهز"), "green");
			})
			.catch((error) => {
				console.error(error);
				page.set_indicator(__("خطأ"), "red");
				frappe.msgprint({
					title: __("خطأ"),
					message: error.message || __("تعذر تحميل لوحة الأداء الربحي."),
					indicator: "red",
				});
			});
	}

	refresh();
}

function build_pl_layout(page) {
	const $container = $(page.body);
	$container.empty();

	const $wrapper = $(`
		<div class="gt-dashboard-wrapper">
			<section class="gt-dashboard-section">
				<div class="gt-dashboard-cards" data-role="kpis"></div>
			</section>
			<section class="gt-dashboard-section" data-role="chart">
				<div class="gt-dashboard-subcard">
					<h5>${__("مقارنة الدخل والمصروفات")}</h5>
					<div id="pl-performance-chart" style="min-height: 260px;"></div>
				</div>
			</section>
			<section class="gt-dashboard-section" data-role="sections"></section>
		</div>
	`);

	$container.append($wrapper);

	return {
		kpis: $wrapper.find('[data-role="kpis"]')[0],
		sections: $wrapper.find('[data-role="sections"]')[0],
		chart: $wrapper.find("#pl-performance-chart")[0],
	};
}

function setup_pl_filters(page, state, refresh) {
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

	const from_field = page.add_field({
		fieldtype: "Date",
		fieldname: "from_date",
		label: __("من تاريخ"),
		default: state.filters.from_date,
		change() {
			state.filters.from_date = from_field.get_value();
			refresh();
		},
	});

	const to_field = page.add_field({
		fieldtype: "Date",
		fieldname: "to_date",
		label: __("إلى تاريخ"),
		default: state.filters.to_date,
		change() {
			state.filters.to_date = to_field.get_value();
			refresh();
		},
	});

	page.add_action_icon("refresh", () => refresh());
}

function render_pl_dashboard(layout, state) {
	render_pl_kpis(layout.kpis, state.data.kpis || []);
	render_pl_sections(layout.sections, state.data.sections || []);
	render_pl_chart(layout.chart, state);
}

function render_pl_kpis(container, kpis) {
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

function render_pl_sections(container, sections) {
	if (!container) return;
	container.innerHTML = "";

	if (!sections.length) {
		container.innerHTML = `<div class="gt-dashboard-empty">${__("لا توجد بيانات مفصلة")}</div>`;
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

function render_pl_chart(container, state) {
	if (!container || !state.data) return;

	const chartData = state.data.chart || {};
	const labels = (chartData.series || []).map((entry) => entry.name || "");
	const values = (chartData.series || []).map((entry) => entry.value || 0);

	if (!labels.length) {
		container.innerHTML = `<div class="gt-dashboard-empty">${__("لا توجد بيانات للمخطط")}</div>`;
		return;
	}

	if (state.chart) {
		state.chart.destroy();
		state.chart = null;
	}

	state.chart = new frappe.Chart(container, {
		data: {
			labels,
			datasets: [
				{
					values,
				},
			],
		},
		type: "bar",
		height: 260,
		colors: ["#2563eb"],
		barOptions: {
			stacked: false,
		},
		axisOptions: {
			xAxisMode: "tick",
			yAxisMode: "tick",
			xIsSeries: true,
		},
		tooltipOptions: {
			formatTooltipY: (value) =>
				DashboardCommon.formatCurrency(value, chartData.currency || frappe.sys_defaults.currency || "EGP"),
		},
	});
}

