/* eslint-disable no-undef */
// Reusable helpers for the Apex financial dashboards.

window.DashboardCommon = window.DashboardCommon || (() => {
	const formatNumber = (value, precision = 2) => {
		if (typeof value === "number") {
			return value.toLocaleString(undefined, {
				minimumFractionDigits: precision,
				maximumFractionDigits: precision,
			});
		}
		const number = parseFloat(value || 0);
		return Number.isFinite(number) ? formatNumber(number, precision) : "0.00";
	};

	const formatCurrency = (amount, currency, precision = 2) => {
		if (typeof format_currency === "function") {
			return format_currency(amount, currency, precision);
		}
		return `${formatNumber(amount, precision)} ${currency || ""}`.trim();
	};

	const createCard = ({
		title,
		value,
		currency,
		subtitle = "",
		indicator = "info",
		icon = "",
		onClick = null,
	}) => {
		const card = document.createElement("div");
		card.className = `gt-dashboard-card indicator-${indicator}`;

		const header = document.createElement("div");
		header.className = "gt-dashboard-card__header";
		header.textContent = title || __("غير معنون");
		card.appendChild(header);

		const body = document.createElement("div");
		body.className = "gt-dashboard-card__body";

		const valueElement = document.createElement("div");
		valueElement.className = "gt-dashboard-card__value";
		valueElement.textContent =
			typeof value === "number" && currency
				? formatCurrency(value, currency)
				: value ?? "";

		if (icon) {
			const iconElement = document.createElement("span");
			iconElement.className = "gt-dashboard-card__icon";
			iconElement.textContent = icon;
			valueElement.prepend(iconElement);
		}

		body.appendChild(valueElement);

		if (subtitle) {
			const subtitleElement = document.createElement("div");
			subtitleElement.className = "gt-dashboard-card__subtitle";
			subtitleElement.textContent = subtitle;
			body.appendChild(subtitleElement);
		}

		card.appendChild(body);

		if (typeof onClick === "function") {
			card.classList.add("gt-dashboard-card--clickable");
			card.addEventListener("click", () => onClick(card));
		}

		return card;
	};

	const renderCards = (container, cards = []) => {
		if (!container) return;
		container.innerHTML = "";
		cards.forEach((cardConfig) => {
			container.appendChild(createCard(cardConfig));
		});
	};

	const buildTotalsRow = (totals = {}) => {
		const wrapper = document.createElement("div");
		wrapper.className = "gt-dashboard-totals";

		(Object.keys(totals.by_currency || {})).forEach((currency) => {
			const amount = totals.by_currency[currency];
			const badge = document.createElement("div");
			badge.className = "gt-dashboard-badge";
			badge.innerText = formatCurrency(amount, currency);
			wrapper.appendChild(badge);
		});

		if (totals.base !== undefined) {
			const baseBadge = document.createElement("div");
			baseBadge.className = "gt-dashboard-badge gt-dashboard-badge--primary";
			baseBadge.innerText = formatCurrency(totals.base, frappe.defaults.get_default("currency"));
			wrapper.appendChild(baseBadge);
		}

		return wrapper;
	};

	const renderGroupTable = (container, balances = []) => {
		if (!container) return;
		container.innerHTML = "";

		if (!balances.length) {
			container.innerHTML = `<div class="gt-dashboard-empty">${__("لا توجد بيانات متاحة")}</div>`;
			return;
		}

		const tableWrapper = document.createElement("div");
		tableWrapper.className = "gt-dashboard-table-container";

		const table = document.createElement("table");
		table.className = "gt-dashboard-table";
		const head = document.createElement("thead");
		head.innerHTML = `
			<tr>
				<th class="account-col">${__("الحساب")}</th>
				<th class="value-col">${__("الرصيد")}</th>
				<th class="currency-col">${__("العملة")}</th>
				<th class="value-col">${__("الرصيد بالجنيه")}</th>
			</tr>
		`;
		table.appendChild(head);

		const body = document.createElement("tbody");
		balances.forEach((row) => {
			const tr = document.createElement("tr");
			tr.innerHTML = `
				<td class="account-col">${frappe.utils.escape_html(row.account || "")}</td>
				<td class="value value-col">${formatNumber(row.balance)}</td>
				<td class="currency-col">${row.currency || ""}</td>
				<td class="value value-col">${formatNumber(row.base_balance)}</td>
			`;
			tr.addEventListener("click", () => {
				if (row.account) {
					frappe.set_route("query-report", "General Ledger", {
						account: row.account,
						posting_date: moment().format("YYYY-MM-DD"),
					});
				}
			});
			body.appendChild(tr);
		});

		table.appendChild(body);
		tableWrapper.appendChild(table);
		container.appendChild(tableWrapper);
	};

	return {
		formatNumber,
		formatCurrency,
		createCard,
		renderCards,
		renderGroupTable,
		buildTotalsRow,
	};
})();

