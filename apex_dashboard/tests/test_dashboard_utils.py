from __future__ import annotations

from frappe.tests.utils import FrappeTestCase

from apex_dashboard.dashboard import utils


class TestDashboardUtils(FrappeTestCase):
	def test_account_groups_structure(self):
		groups = utils.get_dashboard_account_groups()
		self.assertIsInstance(groups, dict)

		expected_sections = {
			"executive_control_center",
			"cash_liquidity_dashboard",
			"receivables_dashboard",
			"liabilities_dashboard",
			"operations_assets_dashboard",
			"fixed_assets_dashboard",
			"pl_performance_dashboard",
			"equity_profit_dashboard",
			"employee_custody_dashboard",
		}

		self.assertTrue(expected_sections.issubset(set(groups.keys())))

	def test_get_accounts_for_section(self):
		data = utils.get_accounts_for_section("cash_liquidity_dashboard")
		self.assertIsInstance(data, dict)
		self.assertIn("treasury", data)

	def test_get_balances_handles_empty(self):
		balances = utils.get_balances_for_accounts([])
		self.assertEqual(balances, [])

