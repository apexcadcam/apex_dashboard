frappe.pages["expense-dashboard"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Expense Dashboard"),
		single_column: true,
	});

	frappe.breadcrumbs.add("Apex Dashboard");

	const template = `
		<div class="expense-dashboard-wrapper">
			<div class="expense-summary-card">
				<div class="expense-summary-header">
					<div>
						<div class="expense-summary-label">${__("Total Expenses")}</div>
						<div id="expense-grand-total" class="expense-summary-amount">—</div>
					</div>
					<div class="expense-summary-actions">
						<button class="btn btn-primary" id="expense-refresh-btn">
							${__("Refresh")}
						</button>
					</div>
				</div>
				<div id="expense-summary-meta" class="expense-summary-meta"></div>
			</div>
			<div id="expense-hidden-info" class="expense-hidden-info" style="display: none;"></div>
			<div id="expense-category-grid" class="expense-category-grid">
				<div class="expense-placeholder">${__("Loading expense data...")}</div>
			</div>
		</div>
	`;

	$(template).appendTo(page.body);

	new ExpenseDashboard(page);
};

class ExpenseDashboard {
	constructor(page) {
		this.page = page;
		this.isLoading = false;
		this.isUpdatingDates = false;

		this.setup_filters();
		this.setup_actions();
		this.fetch_data();
	}

	setup_filters() {
		this.company_field = this.page.add_field({
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default:
				frappe.defaults.get_user_default("Company") ||
				frappe.defaults.get_default("company") ||
				"APEX",
			change: () => this.fetch_data(),
		});

		this.period_field = this.page.add_field({
			fieldname: "period",
			label: __("Period"),
			fieldtype: "Select",
			options: [
				{ label: __("Daily"), value: "daily" },
				{ label: __("Weekly"), value: "weekly" },
				{ label: __("Monthly"), value: "monthly" },
				{ label: __("Yearly"), value: "yearly" },
				{ label: __("Custom"), value: "custom" },
			],
			default: "monthly",
			change: () => this.on_period_change(),
		});

		this.from_date_field = this.page.add_field({
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			change: () => this.on_manual_date_change(),
		});

		this.to_date_field = this.page.add_field({
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			change: () => this.on_manual_date_change(),
		});

		this.include_zero_field = this.page.add_field({
			fieldname: "include_zero",
			label: __("Include Zero Balances"),
			fieldtype: "Check",
			default: 0,
			change: () => this.fetch_data(),
		});

		this.compare_field = this.page.add_field({
			fieldname: "compare_previous",
			label: __("Compare with Previous Period"),
			fieldtype: "Check",
			default: 0,
			change: () => this.fetch_data(),
		});

		this.page.set_primary_action(__("Refresh"), () => this.fetch_data());

		this.initialize_date_filters();
	}

	setup_actions() {
		setTimeout(() => {
			$("#expense-refresh-btn").on("click", () => this.fetch_data());
		}, 100);
	}

	on_period_change() {
		const period = this.period_field.get_value();
		if (period === "custom") {
			return;
		}

		const referenceDate = this.get_reference_date();
		const { from, to } = this.calculate_period_range(period, referenceDate);
		this.set_date_range(from, to, { triggerFetch: true });
	}

	on_manual_date_change() {
		if (this.isUpdatingDates) {
			return;
		}

		const from = this.from_date_field.get_value();
		const to = this.to_date_field.get_value();

		if (!from || !to) {
			return;
		}

		if (this.period_field.get_value() !== "custom") {
			this.period_field.set_value("custom");
		}

		this.fetch_data();
	}

	initialize_date_filters() {
		const today = frappe.datetime.get_today();
		const { from, to } = this.calculate_period_range(this.period_field.get_value(), today);
		this.set_date_range(from, to, { triggerFetch: false });
	}

	set_date_range(from, to, { triggerFetch = false } = {}) {
		this.isUpdatingDates = true;
		this.from_date_field.set_value(from || "");
		this.to_date_field.set_value(to || "");

		setTimeout(() => {
			this.isUpdatingDates = false;
			if (triggerFetch && from && to) {
				this.fetch_data();
			}
		}, 0);
	}

	get_reference_date() {
		return this.to_date_field.get_value() || this.from_date_field.get_value() || frappe.datetime.get_today();
	}

	calculate_period_range(period, referenceDate) {
		const ref = referenceDate || frappe.datetime.get_today();
		const refMoment = moment(ref, "YYYY-MM-DD", true).isValid() ? moment(ref, "YYYY-MM-DD") : moment();
		let start = refMoment.clone();
		let end = refMoment.clone();

		switch (period) {
			case "daily":
				start = refMoment.clone().startOf("day");
				end = refMoment.clone().endOf("day");
				break;
			case "weekly":
				start = refMoment.clone().startOf("isoWeek");
				end = refMoment.clone().endOf("isoWeek");
				break;
			case "monthly":
				start = refMoment.clone().startOf("month");
				end = refMoment.clone().endOf("month");
				break;
			case "yearly":
				start = refMoment.clone().startOf("year");
				end = refMoment.clone().endOf("year");
				break;
			default:
				break;
		}

		return {
			from: start.format("YYYY-MM-DD"),
			to: end.format("YYYY-MM-DD"),
		};
	}

	fetch_data() {
		if (this.isLoading) return;
		this.isLoading = true;

		const category_grid = $("#expense-category-grid");
		category_grid.html(`<div class="expense-placeholder">${__("Loading expense data...")}</div>`);
		$("#expense-grand-total").text("—");
		$("#expense-summary-meta").html("");

		const fromDate = this.from_date_field.get_value();
		const toDate = this.to_date_field.get_value();

		if (!fromDate || !toDate) {
			this.isLoading = false;
			category_grid.html(`<div class="expense-placeholder">${__("Select both From and To dates to view expenses.")}</div>`);
			return;
		}

		frappe.call({
			method: "apex_dashboard.apex_dashboard.page.expense_dashboard.expense_dashboard.get_dashboard_data",
			args: {
				company: this.company_field.get_value(),
				include_zero: this.include_zero_field.get_value() ? 1 : 0,
				period: this.period_field.get_value(),
				from_date: fromDate,
				to_date: toDate,
				compare_to_previous: this.compare_field.get_value() ? 1 : 0,
			},
			callback: (response) => {
				this.isLoading = false;

				if (!response.message || !response.message.success) {
					category_grid.html(`<div class="expense-placeholder error">${__("Unable to load data")}</div>`);
					frappe.show_alert({ indicator: "red", message: __("Failed to load expenses") });
					return;
				}

				this.render_dashboard(response.message.data, response.message.filters);
			},
			error: () => {
				this.isLoading = false;
				category_grid.html(`<div class="expense-placeholder error">${__("Unable to load data")}</div>`);
				frappe.show_alert({ indicator: "red", message: __("Connection error while loading expenses") });
			},
		});
	}

	render_dashboard(data, filters) {
		const grand_total = data.grand_total || 0;
		const base_currency = data.company_currency || frappe.defaults.get_default("currency") || "EGP";
		const grand_total_display = `${this.format_number(grand_total)} ${base_currency}`;
		const categories = data.categories || [];

		$("#expense-grand-total").text(grand_total_display);

		const meta_parts = [];
		const periodInfo = data.period || {};
		if (periodInfo.label) {
			meta_parts.push(`📅 ${periodInfo.label}`);
		}

		const displayFrom = (filters && filters.from_date) || periodInfo.from_date;
		const displayTo = (filters && filters.to_date) || periodInfo.to_date;
		if (displayFrom && displayTo) {
			meta_parts.push(`${frappe.datetime.str_to_user(displayFrom)} → ${frappe.datetime.str_to_user(displayTo)}`);
		}

		if (filters && filters.company) {
			meta_parts.push(`🏢 ${filters.company}`);
		} else {
			meta_parts.push(__("All Companies"));
		}
		$("#expense-summary-meta").html(meta_parts.join(" • "));

		this.render_comparison_summary(data.comparison, base_currency);
		this.render_hidden_info(data.hidden_accounts || []);
		this.render_categories(categories, grand_total, base_currency, data.comparison);

		frappe.show_alert({ indicator: "green", message: __("Expense dashboard updated") });
	}

	render_comparison_summary(comparison, base_currency) {
		$(".expense-comparison-summary").remove();

		if (!comparison || !comparison.enabled) {
			return;
		}

		const difference = this.format_number(comparison.difference || 0);
		const percent = comparison.percent_change != null ? `${this.format_number(comparison.percent_change)}%` : __("n/a");
		const direction = comparison.difference > 0 ? "▲" : comparison.difference < 0 ? "▼" : "■";

		const badge = $(`
			<div class="expense-comparison-summary ${comparison.difference >= 0 ? "positive" : "negative"}">
				<span>${__("Previous Period")}:</span>
				<strong>${this.format_number(comparison.previous_grand_total || 0)} ${base_currency}</strong>
				<span class="change">
					${direction} ${difference} ${base_currency} (${percent})
				</span>
			</div>
		`);

		$("#expense-summary-meta").after(badge);
	}

	render_hidden_info(hidden_accounts) {
		const container = $("#expense-hidden-info");
		if (!hidden_accounts.length) {
			container.hide();
			return;
		}

		const hidden_list = hidden_accounts
			.slice(0, 5)
			.map((account) => `<span class="tag-pill">${frappe.utils.escape_html(account.name)}</span>`)
			.join("");

		const more_count = hidden_accounts.length > 5 ? `<span class="tag-pill">+${hidden_accounts.length - 5}</span>` : "";

		container.html(`
			<div class="expense-hidden-label">
				${__("Hidden Accounts (manually excluded):")}
			</div>
			<div class="expense-hidden-list">
				${hidden_list}${more_count}
			</div>
		`);
		container.show();
	}

	render_categories(categories, grand_total, base_currency, comparison) {
		const category_grid = $("#expense-category-grid");

		if (!categories.length) {
			category_grid.html(`<div class="expense-placeholder">${__("No expense accounts found for the selected filters.")}</div>`);
			return;
		}

		const fragment = document.createDocumentFragment();
		categories.forEach((category) => {
			const wrapper = document.createElement("div");
			wrapper.innerHTML = this.render_category_card(category, grand_total, base_currency, comparison);
			while (wrapper.firstChild) {
				fragment.appendChild(wrapper.firstChild);
			}
		});
		category_grid.empty().append(fragment);
	}

	render_category_card(category, grand_total, base_currency, comparison) {
		const percentage = category.percentage || 0;
		const accounts_html = category.accounts
			.map((account) => this.render_account_row(account))
			.join("");

		let currency_badges = "";
		const by_currency = category.by_currency || {};
		Object.keys(by_currency).forEach((currency) => {
			const total = by_currency[currency] || 0;
			currency_badges += `<span class="currency-pill">${currency}: ${this.format_number(total)}</span>`;
		});

		let comparison_html = "";
		if (comparison && comparison.enabled && comparison.categories && comparison.categories[category.key]) {
			const info = comparison.categories[category.key];
			const diff = this.format_number(info.difference || 0);
			const percent = info.percent_change != null ? `${this.format_number(info.percent_change)}%` : __("n/a");
			const direction = info.difference > 0 ? "▲" : info.difference < 0 ? "▼" : "■";
			comparison_html = `
				<span class="category-comparison ${info.difference >= 0 ? "positive" : "negative"}">
					${direction} ${diff} ${base_currency} (${percent})
				</span>
			`;
		}

		return `
			<div class="expense-category-card" style="border-top-color: ${category.color || "#1f2937"};">
				<div class="expense-category-header">
					<div>
						<div class="expense-category-title">${frappe.utils.escape_html(category.label || category.key)}</div>
						<div class="expense-category-percentage">${percentage.toFixed(2)}%</div>
					</div>
					<div class="expense-category-total">${this.format_number(category.total_egp || 0)} ${base_currency}</div>
				</div>
				<div class="expense-category-submeta">
					${currency_badges}
					${comparison_html}
				</div>
				<div class="expense-accounts-list">
					${accounts_html || `<div class="expense-placeholder small">${__("No accounts in this category")}</div>`}
				</div>
			</div>
		`;
	}

	render_account_row(account) {
		const account_currency = account.currency || "EGP";
		const amount_text = `${this.format_number(account.balance || 0)} ${account_currency}`;

		const manual_badge = account.manual_category
			? `<span class="manual-pill" title="${__("Manually Categorised")}">⚙️</span>`
			: "";

		const previous_text =
			account.previous_balance_in_egp != null && account.previous_balance_in_egp !== undefined
				? `${__("Prev")}: ${this.format_number(account.previous_balance_in_egp || 0)} EGP`
				: "";
		const diff_text =
			account.difference_egp != null && account.difference_egp !== undefined
				? `${account.difference_egp > 0 ? "▲" : account.difference_egp < 0 ? "▼" : "■"} ${this.format_number(Math.abs(account.difference_egp || 0))} EGP`
				: "";
		const show_previous_row = previous_text || diff_text;

		return `
			<div class="expense-account-row">
				<div class="expense-account-info">
					<div class="expense-account-name">
						${frappe.utils.escape_html(account.account_name || account.account)}
						${manual_badge}
					</div>
					<div class="expense-account-currency">${amount_text}</div>
					${
						show_previous_row
							? `<div class="expense-account-previous">
						${previous_text}
						${diff_text ? `<span class="expense-account-diff ${account.difference_egp >= 0 ? "positive" : "negative"}">${diff_text}</span>` : ""}
					</div>`
							: ""
					}
				</div>
				<div class="expense-account-base">${this.format_number(account.balance_in_egp || 0)} EGP</div>
			</div>
		`;
	}

	format_currency(value, currency) {
		const target_currency = currency || frappe.defaults.get_default("currency") || "EGP";
		return `${this.format_number(value)} ${target_currency}`;
	}

	format_number(value) {
		const numericValue = Number(value) || 0;
		if (frappe.utils && frappe.utils.format_number) {
			return frappe.utils.format_number(numericValue, 2);
		}
		return numericValue.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	}
}


