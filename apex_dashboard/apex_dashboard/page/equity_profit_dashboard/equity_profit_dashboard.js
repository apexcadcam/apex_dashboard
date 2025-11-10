frappe.pages["equity-profit-dashboard"].on_page_load = function (wrapper) {
	frappe.require(
		[
			"assets/apex_dashboard/js/dashboard_common.js",
			"assets/apex_dashboard/css/dashboard_common.css",
		],
		() => init_equity_dashboard(wrapper)
	);
};

function init_equity_dashboard(wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Equity & Profit Dashboard"),
		single_column: true,
	});

	const state = {
		filters: {
			company: frappe.defaults.get_user_default("company"),
			posting_date: frappe.datetime.get_today(),
		},
		data: null,
		chart: null,
	};

	const layout = build_equity_layout(page);
	setup_equity_filters(page, state, refresh);

	function refresh() {
		page.set_indicator(__("جارِ التحميل..."), "blue");
		frappe
			.call("apex_dashboard.apex_dashboard.page.equity_profit_dashboard.equity_profit_dashboard.get_dashboard_data", {
				company: state.filters.company,
				posting_date: state.filters.posting_date,
			})
			.then((response) => {
				const payload = response.message || {};
				if (!payload.success) {
					throw new Error(payload.error || __("فشل تحميل بيانات حقوق الملكية."));
				}
				state.data = payload.data || {};
				state.filters = Object.assign({}, state.filters, payload.filters || {});
				render_equity_dashboard(layout, state);
				page.set_indicator(__("جاهز"), "green");
			})
			.catch((error) => {
				console.error(error);
				page.set_indicator(__("خطأ"), "red");
				frappe.msgprint({
					title: __("خطأ"),
					message: error.message || __("تعذر تحميل لوحة حقوق الملكية."),
					indicator: "red",
				});
			});
	}

	refresh();
}

function build_equity_layout(page) {
	const $container = $(page.body);
	$container.empty();

	const $wrapper = $(`
		<div class="gt-dashboard-wrapper">
			<section class="gt-dashboard-section">
				<div class="gt-dashboard-cards" data-role="kpis"></div>
			</section>
			<section class="gt-dashboard-section" data-role="chart">
				<div class="gt-dashboard-subcard">
					<h5>${__("اتجاه صافي الدخل (آخر 6 أشهر)")}</h5>
					<div id="equity-profit-chart" style="min-height: 260px;"></div>
				</div>
			</section>
			<section class="gt-dashboard-section" data-role="sections"></section>
		</div>
	`);

	$container.append($wrapper);

	return {
		kpis: $wrapper.find('[data-role="kpis"]')[0],
		chart: $wrapper.find("#equity-profit-chart")[0],
		sections: $wrapper.find('[data-role="sections"]')[0],
	};
}

function setup_equity_filters(page, state, refresh) {
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

function render_equity_dashboard(layout, state) {
	render_equity_kpis(layout.kpis, state.data.kpis || []);
	render_equity_sections(layout.sections, state.data);
	render_equity_chart(layout.chart, state);
}

function render_equity_kpis(container, kpis) {
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

function render_equity_sections(container, data) {
	if (!container) return;
	container.innerHTML = "";

	const sections = [
		data.capital,
		data.owner_equity,
		data.retained_earnings,
		data.net_income,
	].filter(Boolean);

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

function render_equity_chart(container, state) {
	if (!container || !state.data) return;

	const chartData = state.data.chart || {};
	const labels = chartData.labels || [];
	const values = chartData.values || [];

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
		type: "line",
		height: 260,
		colors: ["#10b981"],
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

