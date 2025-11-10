frappe.pages['treasury-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Treasury & Bank Accounts'),
		single_column: true,
	});

	// Add breadcrumb
	frappe.breadcrumbs.add("Apex Dashboard");

	// Create HTML directly instead of using template
	const dashboardHTML = `
		<div id="combined-dashboard" style="margin: 20px;">
			<div class="combined-total-box">
				<div class="total-label">💼 الإجمالي الكلي (الخزينة + البنوك + الحسابات الأخرى)</div>
				<div id="combined-total" class="total-amount">⏳ جاري التحميل...</div>
				<button id="refresh-all-btn" class="refresh-button">🔄 تحديث جميع الأرصدة</button>
			</div>
			<div class="dashboard-grid">
				<div class="column-box">
					<div class="treasury-box">
						<div class="box-header">💰 الخزينة</div>
						<div class="summary-box">
							<div class="summary-label">الإجمالي</div>
							<div id="treasury-total" class="summary-amount">⏳</div>
						</div>
						<div id="treasury-breakdown" class="breakdown-container">
							<div style="text-align: center; opacity: 0.7; padding: 20px;">جاري التحميل...</div>
						</div>
					</div>
				</div>
				<div class="column-box">
					<div class="banks-box">
						<div class="box-header">🏦 البنوك</div>
						<div class="summary-box">
							<div class="summary-label">إجمالي البنوك</div>
							<div id="banks-total" class="summary-amount">⏳</div>
						</div>
						<div id="banks-container" class="banks-scroll-container">
							<div style="text-align: center; opacity: 0.7; padding: 20px;">جاري التحميل...</div>
						</div>
					</div>
				</div>
				<div class="column-box">
					<div class="other-box">
						<div class="box-header">📊 حسابات أخرى</div>
						<div class="summary-box">
							<div class="summary-label">الإجمالي</div>
							<div id="other-total" class="summary-amount">⏳</div>
						</div>
						<div id="other-breakdown" class="breakdown-container">
							<div style="text-align: center; opacity: 0.7; padding: 20px;">جاري التحميل...</div>
						</div>
					</div>
				</div>
			</div>
			<div id="date-info" class="date-info-text">Loading...</div>
		</div>
	`;

	$(dashboardHTML).appendTo(page.body);

	// Initialize dashboard
	new TreasuryDashboard(page);
};

class TreasuryDashboard {
	constructor(page) {
		this.page = page;
		this.exchangeRates = {};
		this.refreshInterval = null;
		
		this.setupButtons();
		this.init();
	}

	setupButtons() {
		// Add refresh button in page header
		this.page.add_inner_button(__('Refresh Data'), () => {
			this.loadAllBalances();
		});

		// Bind click event to main refresh button
		setTimeout(() => {
			$('#refresh-all-btn').on('click', () => {
				this.loadAllBalances();
			});
		}, 100);
	}

	async init() {
		await this.loadAllBalances();
		
		// Auto-refresh every 5 minutes
		this.refreshInterval = setInterval(() => {
			this.loadAllBalances();
		}, 300000);
	}

	async loadAllBalances() {
		$('#combined-total').html('⏳ جاري التحميل...');
		$('#treasury-total').html('⏳');
		$('#banks-total').html('⏳');
		$('#other-total').html('⏳');
		
		frappe.call({
			method: 'apex_dashboard.apex_dashboard.page.treasury_dashboard.treasury_dashboard.get_all_balances',
			callback: (r) => {
				if (r.message && r.message.success) {
					this.displayAllBalances(r.message);
				} else {
					$('#combined-total').html('❌ فشل التحميل');
					console.error('Response:', r);
					frappe.show_alert({
						message: __('Failed to load balances'),
						indicator: 'red'
					});
				}
			},
			error: (err) => {
				$('#combined-total').html('❌ خطأ في الاتصال');
				console.error('Error:', err);
				frappe.show_alert({
					message: __('Connection error'),
					indicator: 'red'
				});
			}
		});
	}

	displayAllBalances(data) {
		// Display Treasury
		this.displaySection(data.treasury, '#treasury-total', '#treasury-breakdown');
		
		// Display Banks
		this.displaySection(data.banks, '#banks-total', '#banks-container');
		
		// Display Other Accounts
		this.displaySection(data.other_accounts, '#other-total', '#other-breakdown');
		
		// Combined total
		const combinedTotal = (data.treasury.total_egp || 0) + 
		                     (data.banks.total_egp || 0) + 
		                     (data.other_accounts.total_egp || 0);
		
		$('#combined-total').text(combinedTotal.toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}) + ' EGP');
		
		$('#date-info').html(`
			📅 ${data.date} | <span style="color: #4CAF50;">●</span> تحديث حي
		`);
		
		frappe.show_alert({
			message: __('Balances updated successfully'),
			indicator: 'green'
		});
		
		console.log('✅ تم تحديث البيانات بنجاح');
	}

	getCurrencyFlag(currency) {
		const flags = {
			'EGP': '🇪🇬',
			'USD': '🇺🇸',
			'EUR': '🇪🇺',
			'SAR': '🇸🇦',
			'AED': '🇦🇪',
			'GBP': '🇬🇧'
		};
		return flags[currency] || '💵';
	}

	displaySection(sectionData, totalSelector, containerSelector) {
		let total = sectionData.total_egp || 0;
		let html = '';
		
		if (sectionData.accounts && sectionData.accounts.length > 0) {
			sectionData.accounts.forEach(account => {
				const balanceColor = account.balance >= 0 ? '#fff' : '#ffcccc';
				const flag = this.getCurrencyFlag(account.currency);
				
				// Check if foreign currency
				if (account.currency !== 'EGP') {
					html += `
						<div class="account-item">
							<div class="account-name">${account.account_name || account.account}</div>
							<div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
								<div>
									<div class="account-balance" style="color: ${balanceColor};">
										${flag} ${account.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${account.currency}
									</div>
									<div style="font-size: 10px; opacity: 0.7; margin-top: 3px;">
										سعر: ${account.exchange_rate.toLocaleString()} جنيه
									</div>
								</div>
								<div style="text-align: right;">
									<div style="font-size: 13px; font-weight: bold; color: #ffd700;">
										= ${account.balance_in_egp.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} 🇪🇬
									</div>
								</div>
							</div>
						</div>
					`;
				} else {
					// EGP accounts - simpler display
					html += `
						<div class="account-item">
							<div class="account-name">${account.account_name || account.account}</div>
							<div class="account-balance" style="color: ${balanceColor}; margin-top: 5px;">
								${flag} ${account.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} EGP
							</div>
						</div>
					`;
				}
			});
		} else {
			html = '<div style="text-align: center; opacity: 0.5; padding: 40px;">لا توجد بيانات</div>';
		}
		
		$(totalSelector).text(total.toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}) + ' EGP');
		
		$(containerSelector).html(html);
	}
}
