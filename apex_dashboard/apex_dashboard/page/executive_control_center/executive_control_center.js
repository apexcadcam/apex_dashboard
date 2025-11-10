frappe.provide("apex_dashboard.dashboard");

frappe.pages["executive-control-center"].on_page_load = function (wrapper) {
	frappe.require(
		[
			"assets/apex_dashboard/js/dashboard_common.js",
			"assets/apex_dashboard/css/dashboard_common.css",
		],
		() => init_executive_page(wrapper)
	);
};

function init_executive_page(wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Executive Control Center"),
		single_column: true,
	});

	const state = {
		filters: {
			company: frappe.defaults.get_user_default("company"),
			posting_date: frappe.datetime.get_today(),
		},
		data: null,
	};

	const layout = build_layout(page);
	setup_filter_bar(page, state, layout, refresh);

	function refresh() {
		page.set_indicator(__("جارِ التحميل..."), "blue");
		frappe
			.call("apex_dashboard.apex_dashboard.page.executive_control_center.executive_control_center.get_dashboard_data", {
				company: state.filters.company,
				posting_date: state.filters.posting_date,
			})
			.then((response) => {
				const payload = response.message || {};
				if (!payload.success) {
					throw new Error(payload.error || __("فشل تحميل البيانات"));
				}
				state.data = payload.data || {};
				state.filters = Object.assign({}, state.filters, payload.filters || {});
				render_dashboard(layout, state);
				page.set_indicator(__("جاهز"), "green");
			})
			.catch((error) => {
				console.error(error);
				page.set_indicator(__("خطأ"), "red");
				frappe.msgprint({
					title: __("خطأ"),
					message: error.message || __("تعذر تحميل بيانات لوحة التحكم التنفيذية."),
					indicator: "red",
				});
			});
	}

	refresh();
}

function build_layout(page) {
	const $container = $(page.body);
	$container.empty();

	const $wrapper = $(`
		<div class="gt-dashboard-wrapper">
			<section class="gt-dashboard-section">
				<div class="gt-dashboard-cards" data-role="kpi-cards"></div>
			</section>
			<section class="gt-dashboard-section gt-dashboard-section--split">
				<div class="gt-dashboard-alerts" data-role="alerts"></div>
				<div class="gt-dashboard-shortcuts" data-role="shortcuts"></div>
			</section>
		</div>
	`);

	$container.append($wrapper);

	return {
		kpis: $wrapper.find('[data-role="kpi-cards"]')[0],
		alerts: $wrapper.find('[data-role="alerts"]')[0],
		shortcuts: $wrapper.find('[data-role="shortcuts"]')[0],
	};
}

function setup_filter_bar(page, state, layout, refresh) {
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

function render_dashboard(layout, state) {
	render_kpis(layout.kpis, state.data);
	render_alerts(layout.alerts, state.data);
	render_shortcuts(layout.shortcuts, state.data);
}

function render_kpis(container, data) {
	if (!container) return;
	const kpis = (data && data.kpis) || [];
	const cards = kpis.map((kpi) => {
		const totals = (kpi && kpi.totals) || {};
		const baseValue = totals.base || 0;
		const indicator = kpi.indicator || (baseValue >= 0 ? "positive" : "danger");
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
			indicator,
			onClick: () => open_related_accounts(kpi),
		};
	});

	DashboardCommon.renderCards(container, cards);
}

function render_alerts(container, data) {
	if (!container) return;
	const alerts = (data && data.alerts) || [];

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

function render_shortcuts(container, data) {
	if (!container) return;
	const shortcuts = (data && data.shortcuts) || [];
	container.innerHTML = "";

	if (!shortcuts.length) {
		container.innerHTML = `<div class="gt-dashboard-empty">${__("لا توجد روابط سريعة")}</div>`;
		return;
	}

	shortcuts.forEach((shortcut) => {
		const button = document.createElement("button");
		button.className = "btn btn-default gt-dashboard-shortcut";
		button.innerText = shortcut.label || "";
		button.addEventListener("click", () => {
			if (Array.isArray(shortcut.route)) {
				frappe.set_route(...shortcut.route);
			}
		});
		container.appendChild(button);
	});
}

function open_related_accounts(kpi) {
	if (!kpi) return;
	const dialog = new frappe.ui.Dialog({
		title: kpi.label || __("الحسابات المرتبطة"),
		fields: [
			{
				fieldname: "html",
				fieldtype: "HTML",
			},
		],
		primary_action_label: __("إغلاق"),
		primary_action: () => dialog.hide(),
	});

	const wrapper = document.createElement("div");
	wrapper.className = "gt-dashboard-dialog";
	dialog.fields_dict.html.$wrapper.empty().append(wrapper);

	const balances = kpi.balances || [];

	if (Array.isArray(balances)) {
		const tableContainer = document.createElement("div");
		wrapper.appendChild(tableContainer);
		DashboardCommon.renderGroupTable(tableContainer, balances);
	} else if (balances && typeof balances === "object") {
		Object.entries(balances).forEach(([label, rows]) => {
			const section = document.createElement("div");
			section.className = "gt-dashboard-dialog__section";
			const heading = document.createElement("h5");
			heading.className = "gt-dashboard-dialog__heading";
			let headingText = label;
			if (label === "assets") {
				headingText = __("الأصول");
			} else if (label === "liabilities") {
				headingText = __("الالتزامات");
			}
			heading.innerText = headingText;
			section.appendChild(heading);

			const tableContainer = document.createElement("div");
			section.appendChild(tableContainer);
			const tableRows = Array.isArray(rows) ? rows : [];
			DashboardCommon.renderGroupTable(tableContainer, tableRows);
			wrapper.appendChild(section);
		});
	} else {
		wrapper.innerHTML = `<div class="gt-dashboard-empty">${__("لا توجد بيانات مرتبطة")}</div>`;
	}

	dialog.show();
}

