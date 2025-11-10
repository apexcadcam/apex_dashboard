frappe.pages["cash-liquidity-dashboard"].on_page_load = function (wrapper) {
	frappe.require(
		[
			"assets/apex_dashboard/js/dashboard_common.js",
			"assets/apex_dashboard/css/dashboard_common.css",
		],
		() => init_cash_liquidity_page(wrapper)
	);
};

function init_cash_liquidity_page(wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Cash & Liquidity Dashboard"),
		single_column: true,
	});

	const state = {
		filters: {
			company: frappe.defaults.get_user_default("company"),
			posting_date: frappe.datetime.get_today(),
		},
		data: null,
	};

	const layout = build_cash_layout(page);
	setup_cash_filters(page, state, layout, refresh);

	function refresh() {
		page.set_indicator(__("جارِ التحميل..."), "blue");
		frappe
			.call("apex_dashboard.apex_dashboard.page.cash_liquidity_dashboard.cash_liquidity_dashboard.get_dashboard_data", {
				company: state.filters.company,
				posting_date: state.filters.posting_date,
			})
			.then((response) => {
				const payload = response.message || {};
				if (!payload.success) {
					throw new Error(payload.error || __("فشل تحميل بيانات السيولة."));
				}
				state.data = payload.data || {};
				state.filters = Object.assign({}, state.filters, payload.filters || {});
				render_cash_dashboard(layout, state.data);
				page.set_indicator(__("جاهز"), "green");
			})
			.catch((error) => {
				console.error(error);
				page.set_indicator(__("خطأ"), "red");
				frappe.msgprint({
					title: __("خطأ"),
					message: error.message || __("تعذر تحميل لوحة السيولة."),
					indicator: "red",
				});
			});
	}

	refresh();
}

function build_cash_layout(page) {
	const $container = $(page.body);
	$container.empty();
	const $wrapper = $(`
		<div class="gt-dashboard-wrapper">
			<section class="gt-dashboard-section">
				<div class="gt-dashboard-cards" data-role="kpis"></div>
			</section>
			<section class="gt-dashboard-section" data-role="treasury"></section>
			<section class="gt-dashboard-section" data-role="banks"></section>
			<section class="gt-dashboard-section" data-role="credit-cards"></section>
			<section class="gt-dashboard-section" data-role="facilities"></section>
		</div>
	`);
	$container.append($wrapper);

	return {
		kpis: $wrapper.find('[data-role="kpis"]')[0],
		treasury: $wrapper.find('[data-role="treasury"]')[0],
		banks: $wrapper.find('[data-role="banks"]')[0],
		credit_cards: $wrapper.find('[data-role="credit-cards"]')[0],
		facilities: $wrapper.find('[data-role="facilities"]')[0],
	};
}

function setup_cash_filters(page, state, layout, refresh) {
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

function render_cash_dashboard(layout, data) {
	render_cash_kpis(layout.kpis, data.kpis || []);
	render_collection(layout.treasury, data.treasury, __("خزينة HQ"));
	render_grouped(layout.banks, data.banks, __("أرصدة البنوك"));
	render_grouped(layout.credit_cards, data.credit_cards, __("بطاقات الائتمان"));
	render_grouped(layout.facilities, data.facilities, __("التسهيلات والقروض"));
}

function render_cash_kpis(container, kpis) {
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

function render_collection(container, collection, fallbackTitle) {
	if (!container) return;
	container.innerHTML = "";

	if (!collection) {
		container.innerHTML = `<div class="gt-dashboard-empty">${__("لا توجد بيانات متاحة")}</div>`;
		return;
	}

	const header = document.createElement("div");
	header.className = "gt-dashboard-section__header";
	const title = document.createElement("h4");
	title.className = "gt-dashboard-section__title";
	title.innerText = collection.label || fallbackTitle || "";
	header.appendChild(title);
	header.appendChild(DashboardCommon.buildTotalsRow(collection.totals));

	container.appendChild(header);

	const tableContainer = document.createElement("div");
	container.appendChild(tableContainer);
	DashboardCommon.renderGroupTable(tableContainer, collection.balances || []);
}

function render_grouped(container, groupData, fallbackTitle) {
	if (!container) return;
	container.innerHTML = "";

	if (!groupData || !Array.isArray(groupData.groups)) {
		container.innerHTML = `<div class="gt-dashboard-empty">${__("لا توجد بيانات متاحة")}</div>`;
		return;
	}

	const header = document.createElement("div");
	header.className = "gt-dashboard-section__header";
	const title = document.createElement("h4");
	title.className = "gt-dashboard-section__title";
	title.innerText = groupData.label || fallbackTitle || "";
	header.appendChild(title);
	header.appendChild(DashboardCommon.buildTotalsRow(groupData.totals || {}));
	container.appendChild(header);

	const groupsWrapper = document.createElement("div");
	groupsWrapper.className = "gt-dashboard-groups";

	groupData.groups.forEach((group) => {
		const card = document.createElement("div");
		card.className = "gt-dashboard-subcard";

		const cardHeader = document.createElement("div");
		cardHeader.className = "gt-dashboard-subcard__header";
		const cardTitle = document.createElement("h5");
		cardTitle.innerText = group.label || "";
		cardHeader.appendChild(cardTitle);
		cardHeader.appendChild(DashboardCommon.buildTotalsRow(group.totals || {}));
		card.appendChild(cardHeader);

		const tableContainer = document.createElement("div");
		card.appendChild(tableContainer);
		DashboardCommon.renderGroupTable(tableContainer, group.balances || []);

		groupsWrapper.appendChild(card);
	});

	container.appendChild(groupsWrapper);
}

