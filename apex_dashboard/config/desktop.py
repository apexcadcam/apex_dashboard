from __future__ import annotations

from frappe import _


def get_data():
	return [
		{
			"module_name": "Apex Dashboard",
			"label": _("Apex Dashboards"),
			"color": "#2563eb",
			"icon": "octicon octicon-graph",
			"type": "module",
			"items": [
				{"type": "page", "name": "executive-control-center", "label": _("Executive Control Center")},
				{"type": "page", "name": "cash-liquidity-dashboard", "label": _("Cash & Liquidity")},
				{"type": "page", "name": "receivables-dashboard", "label": _("Receivables")},
				{"type": "page", "name": "liabilities-dashboard", "label": _("Liabilities")},
				{"type": "page", "name": "operations-assets-dashboard", "label": _("Operations & Assets")},
				{"type": "page", "name": "fixed-assets-dashboard", "label": _("Fixed Assets")},
				{"type": "page", "name": "pl-performance-dashboard", "label": _("P&L Performance")},
				{"type": "page", "name": "equity-profit-dashboard", "label": _("Equity & Profit")},
				{"type": "page", "name": "employee-custody-dashboard", "label": _("Employee Custody")},
			],
		}
	]

