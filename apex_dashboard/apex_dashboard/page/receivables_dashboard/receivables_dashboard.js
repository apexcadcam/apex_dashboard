frappe.pages["receivables-dashboard"].on_page_load = function (wrapper) {
	frappe.require(
		[
			"assets/apex_dashboard/js/dashboard_common.js",
			"assets/apex_dashboard/css/dashboard_common.css",
		],
		() => init_receivables_page(wrapper)
	);
};

function init_receivables_page(wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Receivables Dashboard"),
		single_column: true,
	});

	const state = {
		filters: {
			company: frappe.defaults.get_user_default("company"),
			posting_date: frappe.datetime.get_today(),
		},
		data: null,
	};

	const layout = build_receivables_layout(page);
	setup_receivables_filters(page, state, layout, refresh);

	function refresh() {
		page.set_indicator(__("جارِ التحميل..."), "blue");
		frappe
			.call("apex_dashboard.apex_dashboard.page.receivables_dashboard.receivables_dashboard.get_dashboard_data", {
				company: state.filters.company,
				posting_date: state.filters.posting_date,
			})
			.then((response) => {
				const payload = response.message || {};
				if (!payload.success) {
					throw new Error(payload.error || __("فشل تحميل بيانات الذمم."));
				}
				state.data = payload.data || {};
				state.filters = Object.assign({}, state.filters, payload.filters || {});
				render_receivables_dashboard(layout, state.data);
				page.set_indicator(__("جاهز"), "green");
			})
			.catch((error) => {
				console.error(error);
				page.set_indicator(__("خطأ"), "red");
				frappe.msgprint({
					title: __("خطأ"),
					message: error.message || __("تعذر تحميل لوحة الذمم."),
					indicator: "red",
				});
			});
	}

	refresh();
}

function build_receivables_layout(page) {
	const $container = $(page.body);
	$container.empty();

	const $wrapper = $(`
		<div class="gt-dashboard-wrapper">
			<section class="gt-dashboard-section">
				<div class="gt-dashboard-cards" data-role="kpis"></div>
			</section>
			<section class="gt-dashboard-section" data-role="customers"></section>
			<section class="gt-dashboard-section" data-role="notes"></section>
			<section class="gt-dashboard-section" data-role="cheques"></section>
			<section class="gt-dashboard-section" data-role="aging"></section>
		</div>
	`);

	$container.append($wrapper);

	return {
		kpis: $wrapper.find('[data-role="kpis"]')[0],
		customers: $wrapper.find('[data-role="customers"]')[0],
		notes: $wrapper.find('[data-role="notes"]')[0],
		cheques: $wrapper.find('[data-role="cheques"]')[0],
		aging: $wrapper.find('[data-role="aging"]')[0],
	};
}

function setup_receivables_filters(page, state, layout, refresh) {
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

function render_receivables_dashboard(layout, data) {
	render_receivable_kpis(layout.kpis, data.kpis || []);
	render_receivable_collection(layout.customers, data.customers, __("أرصدة العملاء"));
	render_receivable_collection(layout.notes, data.notes_receivable, __("Notes Receivable"));
	render_receivable_collection(layout.cheques, data.outstanding_cheques, __("الشيكات تحت التحصيل"));
	render_aging(layout.aging, data.aging);
}

function render_receivable_kpis(container, kpis) {
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

function render_receivable_collection(container, collection, fallbackTitle) {
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
	header.appendChild(DashboardCommon.buildTotalsRow(collection.totals || {}));
	container.appendChild(header);

	const tableContainer = document.createElement("div");
	container.appendChild(tableContainer);
	DashboardCommon.renderGroupTable(tableContainer, collection.balances || []);
}

function render_aging(container, aging) {
	if (!container) return;
	container.innerHTML = "";

	if (!aging) {
		container.innerHTML = `<div class="gt-dashboard-empty">${__("لا يوجد تحليل أعمار")}</div>`;
		return;
	}

	const header = document.createElement("div");
	header.className = "gt-dashboard-section__header";
	const title = document.createElement("h4");
	title.className = "gt-dashboard-section__title";
	title.innerText = __("تحليل أعمار الذمم");
	header.appendChild(title);

	const totalBadgeWrapper = document.createElement("div");
	const overdueTot = aging.overdue_by_currency || {};
	Object.keys(overdueTot).forEach((currency) => {
		const badge = document.createElement("div");
		badge.className = "gt-dashboard-badge gt-dashboard-badge--warning";
		badge.innerText = DashboardCommon.formatCurrency(overdueTot[currency], currency);
		totalBadgeWrapper.appendChild(badge);
	});
	header.appendChild(totalBadgeWrapper);
	container.appendChild(header);

	const table = document.createElement("table");
	table.className = "gt-dashboard-table";
	table.innerHTML = `
		<thead>
			<tr>
				<th>${__("العميل")}</th>
				<th>${__("العملة")}</th>
				<th>${__("إجمالي مستحق")}</th>
				<th>${__("0-30 يوم")}</th>
				<th>${__("31-60 يوم")}</th>
				<th>${__("61-90 يوم")}</th>
				<th>${__("أكثر من 90 يوم")}</th>
			</tr>
		</thead>
		<tbody></tbody>
	`;
	const tbody = table.querySelector("tbody");

	(aging.buckets || []).forEach((row) => {
		const tr = document.createElement("tr");
		tr.innerHTML = `
			<td>${frappe.utils.escape_html(row.customer || "")}</td>
			<td>${row.currency || ""}</td>
			<td class="value">${DashboardCommon.formatNumber(row.outstanding || 0)}</td>
			<td class="value">${DashboardCommon.formatNumber(row.bucket_30 || 0)}</td>
			<td class="value">${DashboardCommon.formatNumber(row.bucket_60 || 0)}</td>
			<td class="value">${DashboardCommon.formatNumber(row.bucket_90 || 0)}</td>
			<td class="value">${DashboardCommon.formatNumber(row.bucket_90_plus || 0)}</td>
		`;
		tr.addEventListener("click", () => {
			if (row.customer) {
				frappe.set_route("query-report", "Accounts Receivable", {
					company: frappe.defaults.get_user_default("company"),
					party_type: "Customer",
					party: row.customer,
				});
			}
		});
		tbody.appendChild(tr);
	});

	container.appendChild(table);

	if (aging.top_overdue && aging.top_overdue.length) {
		const listWrapper = document.createElement("div");
		listWrapper.className = "gt-dashboard-subcard";
		const heading = document.createElement("h5");
		heading.innerText = __("أعلى العملاء المتأخرين");
		listWrapper.appendChild(heading);

		aging.top_overdue.forEach((row) => {
			const item = document.createElement("div");
			item.className = "gt-dashboard-alert level-warning";
			item.innerHTML = `
				<span class="gt-dashboard-alert__badge">${__("متأخر")}</span>
				<span class="gt-dashboard-alert__message">
					${frappe.utils.escape_html(row.customer || "")}
					- ${DashboardCommon.formatCurrency(row.overdue || 0, row.currency || "")}
				</span>
			`;
			listWrapper.appendChild(item);
		});

		container.appendChild(listWrapper);
	}
}

