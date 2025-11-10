frappe.pages["fixed-assets-dashboard"].on_page_load = function (wrapper) {
	frappe.require(
		[
			"assets/apex_dashboard/js/dashboard_common.js",
			"assets/apex_dashboard/css/dashboard_common.css",
		],
		() => init_fixed_assets_page(wrapper)
	);
};

function init_fixed_assets_page(wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Fixed Assets Dashboard"),
		single_column: true,
	});

	const state = {
		filters: {
			company: frappe.defaults.get_user_default("company"),
			posting_date: frappe.datetime.get_today(),
		},
		data: null,
	};

	const layout = build_fixed_assets_layout(page);
	setup_fixed_assets_filters(page, state, refresh);

	function refresh() {
		page.set_indicator(__("جارِ التحميل..."), "blue");
		frappe
			.call("apex_dashboard.apex_dashboard.page.fixed_assets_dashboard.fixed_assets_dashboard.get_dashboard_data", {
				company: state.filters.company,
				posting_date: state.filters.posting_date,
			})
			.then((response) => {
				const payload = response.message || {};
				if (!payload.success) {
					throw new Error(payload.error || __("فشل تحميل بيانات الأصول الثابتة."));
				}
				state.data = payload.data || {};
				state.filters = Object.assign({}, state.filters, payload.filters || {});
				render_fixed_assets_dashboard(layout, state.data);
				page.set_indicator(__("جاهز"), "green");
			})
			.catch((error) => {
				console.error(error);
				page.set_indicator(__("خطأ"), "red");
				frappe.msgprint({
					title: __("خطأ"),
					message: error.message || __("تعذر تحميل لوحة الأصول الثابتة."),
					indicator: "red",
				});
			});
	}

	refresh();
}

function build_fixed_assets_layout(page) {
	const $container = $(page.body);
	$container.empty();

	const $wrapper = $(`
		<div class="gt-dashboard-wrapper">
			<section class="gt-dashboard-section">
				<div class="gt-dashboard-cards" data-role="kpis"></div>
			</section>
			<section class="gt-dashboard-section" data-role="categories"></section>
			<section class="gt-dashboard-section" data-role="cwip"></section>
			<section class="gt-dashboard-section" data-role="depreciation"></section>
		</div>
	`);

	$container.append($wrapper);

	return {
		kpis: $wrapper.find('[data-role="kpis"]')[0],
		categories: $wrapper.find('[data-role="categories"]')[0],
		cwip: $wrapper.find('[data-role="cwip"]')[0],
		depreciation: $wrapper.find('[data-role="depreciation"]')[0],
	};
}

function setup_fixed_assets_filters(page, state, refresh) {
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

function render_fixed_assets_dashboard(layout, data) {
	render_fixed_assets_kpis(layout.kpis, data.kpis || []);
	render_asset_categories(layout.categories, data.categories || []);
	render_asset_collection(layout.cwip, data.cwip, __("أصول تحت التنفيذ"));
	render_asset_collection(layout.depreciation, data.depreciation, __("تفاصيل مصاريف الإهلاك"));
}

function render_fixed_assets_kpis(container, kpis) {
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

function render_asset_categories(container, categories) {
	if (!container) return;
	container.innerHTML = "";

	if (!categories.length) {
		container.innerHTML = `<div class="gt-dashboard-empty">${__("لا توجد فئات أصول ثابتة")}</div>`;
		return;
	}

	const grid = document.createElement("div");
	grid.className = "gt-dashboard-groups";

	categories.forEach((category) => {
		const card = document.createElement("div");
		card.className = "gt-dashboard-subcard";

		const header = document.createElement("div");
		header.className = "gt-dashboard-subcard__header";
		const title = document.createElement("h5");
		title.innerText = category.label || "";
		header.appendChild(title);
		header.appendChild(DashboardCommon.buildTotalsRow(category.totals || {}));
		card.appendChild(header);

		const tableContainer = document.createElement("div");
		card.appendChild(tableContainer);
		DashboardCommon.renderGroupTable(tableContainer, category.balances || []);

		grid.appendChild(card);
	});

	container.appendChild(grid);
}

function render_asset_collection(container, collection, fallbackTitle) {
	if (!container) return;
	container.innerHTML = "";

	if (!collection) {
		container.innerHTML = `<div class="gt-dashboard-empty">${__("لا توجد بيانات")}</div>`;
		return;
	}

	const header = document.createElement("div");
	header.className = "gt-dashboard-section__header";
	const title = document.createElement("h4");
	title.className = "gt-dashboard-section__title";
	title.innerText = collection.label || fallbackTitle || "";
	header.appendChild(title);
	header.appendChild(DashboardCommon.buildTotalsRow(collection.totals || {}));
	container.appendChild(header);

	const tableContainer = document.createElement("div");
	container.appendChild(tableContainer);
	DashboardCommon.renderGroupTable(tableContainer, collection.balances || []);
}

