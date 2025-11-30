import frappe
import json
from apex_dashboard.api.finance_api import get_dashboard_data

def execute():
    data = get_dashboard_data(company="APEX", period="All Time")
    print(json.dumps(data.get('metrics', {}).get('yearly_profits', []), indent=2))
