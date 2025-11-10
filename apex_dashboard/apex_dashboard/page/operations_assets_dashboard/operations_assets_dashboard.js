frappe.pages["operations-assets-dashboard"].on_page_load = function (wrapper) {
	frappe.require(
		[
			"assets/apex_dashboard/js/dashboard_common.js",
			"assets/apex_dashboard/css/dashboard_common.css",
		],
		() => init_operations_assets_page(wrapper)
	);
};

function init_operations_assets_page(wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Operations & Assets Dashboard"),
		single_column: true,
	});

	const state = {
		filters: {
			company: frappe.defaults.get_user_default("company"),
			posting_date: frappe.datetime.get_today(),
		},
		data: null,
	};

	const layout = build_operations_layout(page);
	setup_operations_filters(page, state, refresh);

	function refresh() {
		page.set_indicator(__("جارِ التحميل..."), "blue");
		frappe
			.call("apex_dashboard.apex_dashboard.page.operations_assets_dashboard.operations_assets_dashboard.get_dashboard_data", {
				company: state.filters.company,
				posting_date: state.filters.posting_date,
			})
			.then((response) => {
				const payload = response.message || {};
				if (!payload.success) {
					throw new Error(payload.error || __("فشل تحميل بيانات الأصول التشغيلية."));
				}
				state.data = payload.data || {};
				state.filters = Object.assign({}, state.filters, payload.filters || {});
				render_operations_dashboard(layout, state.data);
				page.set_indicator(__("جاهز"), "green");
			})
			.catch((error) => {
				console.error(error);
				page.set_indicator(__("خطأ"), "red");
				frappe.msgprint({
					title: __("خطأ"),
					message: error.message || __("تعذر تحميل لوحة الأصول التشغيلية."),
					indicator: "red",
				});
			});
	}

	refresh();
}

function build_operations_layout(page) {
	const $container = $(page.body);
	$container.empty();

	const $wrapper = $(`
		<div class="gt-dashboard-wrapper">
			<section class="gt-dashboard-section">
				<div class="gt-dashboard-cards" data-role="kpis"></div>
			</section>
			<section class="gt-dashboard-section" data-role="inventory"></section>
			<section class="gt-dashboard-section" data-role="in-transit"></section>
			<section class="gt-dashboard-section" data-role="other-assets"></section>
		</div>
	`);

	$container.append($wrapper);

	return {
		kpis: $wrapper.find('[data-role="kpis"]')[0],
		inventory: $wrapper.find('[data-role="inventory"]')[0],
		in_transit: $wrapper.find('[data-role="in-transit"]')[0],
		other_assets: $wrapper.find('[data-role="other-assets"]')[0],
	};
}

function setup_operations_filters(page, state, refresh) {
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

function render_operations_dashboard(layout, data) {
	render_operations_kpis(layout.kpis, data.kpis || []);
	render_inventory_section(layout.inventory, data.inventory);
	render_in_transit_section(layout.in_transit, data.in_transit);
	render_other_assets_section(layout.other_assets, data.other_assets);
}

function render_operations_kpis(container, kpis) {
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

function render_inventory_section(container, inventory) {
	if (!container) return;
	container.innerHTML = "";

	if (!inventory) {
		container.innerHTML = `<div class="gt-dashboard-empty">${__("لا توجد بيانات مخزون")}</div>`;
		return;
	}

	const header = document.createElement("div");
	header.className = "gt-dashboard-section__header";
	const title = document.createElement("h4");
	title.className = "gt-dashboard-section__title";
	title.innerText = inventory.label || __("تفاصيل المخزون");
	header.appendChild(title);
	header.appendChild(DashboardCommon.buildTotalsRow(inventory.totals || {}));
	container.appendChild(header);

	const tableContainer = document.createElement("div");
	container.appendChild(tableContainer);
	DashboardCommon.renderGroupTable(tableContainer, inventory.balances || []);
}

function render_in_transit_section(container, inTransit) {
	if (!container) return;
	container.innerHTML = "";

	if (!inTransit) {
		container.innerHTML = `<div class="gt-dashboard-empty">${__("لا يوجد مخزون قيد الوصول")}</div>`;
		return;
	}

	const header = document.createElement("div");
	header.className = "gt-dashboard-section__header";
	const title = document.createElement("h4");
	title.className = "gt-dashboard-section__title";
	title.innerText = inTransit.label || __("مخزون/أصول قيد الوصول");
	header.appendChild(title);
	header.appendChild(DashboardCommon.buildTotalsRow(inTransit.totals || {}));
	container.appendChild(header);

	const groupsWrapper = document.createElement("div");
	groupsWrapper.className = "gt-dashboard-groups";

	const stockCard = document.createElement("div");
	stockCard.className = "gt-dashboard-subcard";
	const stockHeader = document.createElement("div");
	stockHeader.className = "gt-dashboard-subcard__header";
	const stockTitle = document.createElement("h5");
	stockTitle.innerText = __("مخزون قيد الوصول");
	stockHeader.appendChild(stockTitle);
	stockCard.appendChild(stockHeader);
	const stockTable = document.createElement("div");
	stockCard.appendChild(stockTable);
	DashboardCommon.renderGroupTable(stockTable, inTransit.stock || []);
	groupsWrapper.appendChild(stockCard);

	const assetCard = document.createElement("div");
	assetCard.className = "gt-dashboard-subcard";
	const assetHeader = document.createElement("div");
	assetHeader.className = "gt-dashboard-subcard__header";
	const assetTitle = document.createElement("h5");
	assetTitle.innerText = __("أصول قيد الوصول");
	assetHeader.appendChild(assetTitle);
	assetCard.appendChild(assetHeader);
	const assetTable = document.createElement("div");
	assetCard.appendChild(assetTable);
	DashboardCommon.renderGroupTable(assetTable, inTransit.asset || []);
	groupsWrapper.appendChild(assetCard);

	container.appendChild(groupsWrapper);
}

function render_other_assets_section(container, otherAssets) {
	if (!container) return;
	container.innerHTML = "";

	if (!otherAssets) {
		container.innerHTML = `<div class="gt-dashboard-empty">${__("لا توجد أصول متداولة أخرى")}</div>`;
		return;
	}

	const header = document.createElement("div");
	header.className = "gt-dashboard-section__header";
	const title = document.createElement("h4");
	title.className = "gt-dashboard-section__title";
	title.innerText = otherAssets.label || __("الأصول المتداولة الأخرى");
	header.appendChild(title);
	header.appendChild(DashboardCommon.buildTotalsRow(otherAssets.totals || {}));
	container.appendChild(header);

	const tableContainer = document.createElement("div");
	container.appendChild(tableContainer);
	DashboardCommon.renderGroupTable(tableContainer, otherAssets.balances || []);
}

