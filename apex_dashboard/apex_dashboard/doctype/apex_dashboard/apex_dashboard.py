# Copyright (c) 2025, Frappe Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import cstr
import os
import subprocess

class ApexDashboard(Document):
	def validate(self):
		# Always auto-generate route from title to keep them in sync
		if self.title:
			# Convert title to lowercase and replace spaces/hyphens with underscores
			generated_route = cstr(self.title).lower().replace(" ", "_").replace("-", "_")
			
			# Only update if different (to avoid unnecessary updates)
			if self.route != generated_route:
				self.route = generated_route
	
	def get_page_path(self):
		"""Get the path to dashboard page folder"""
		return os.path.join(
			frappe.get_app_path("apex_dashboard"),
			"apex_dashboard",
			"page",
			self.route
		)
	
	@frappe.whitelist()
	def generate_dashboard_files(self):
		"""Generate dashboard files using the generator script"""
		try:
			# Path to generator script
			script_path = os.path.join(
				frappe.get_app_path("apex_dashboard", ".."),
				"generate_dashboard_simple.py"
			)
			
			# Check if files already exist
			page_path = self.get_page_path()
			if os.path.exists(page_path):
				py_files = [f for f in os.listdir(page_path) if f.endswith('.py')]
				if py_files:
					frappe.msgprint(
						f"Dashboard files already exist at: {page_path}<br>"
						f"Delete the folder first if you want to regenerate.",
						title="Files Already Exist",
						indicator="orange"
					)
					return
			
			# Run generator
			cmd = [
				"python3",
				script_path,
				self.route,
				self.title,
				self.category or "General"
			]
			
			result = subprocess.run(
				cmd,
				capture_output=True,
				text=True,
				check=True,
				cwd=frappe.get_app_path("apex_dashboard", "..")
			)
			
			# Auto-run migrate and restart (for SaaS environments)
			try:
				# Import page to make it available immediately
				frappe.clear_cache()
				
				# Reload doctypes
				frappe.reload_doctype("Page")
				
				# Success message
				frappe.msgprint(
					f"✓ Dashboard created successfully!<br><br>"
					f"<b>Access your dashboard at:</b><br>"
					f"<a href='/app/{self.route}' target='_blank'>/app/{self.route}</a><br><br>"
					f"<small>Note: If dashboard doesn't load immediately, refresh the page after a few seconds.</small>",
					title="Success",
					indicator="green"
				)
				
			except Exception as e:
				frappe.log_error(f"Error during auto-reload: {str(e)}", "Dashboard Auto-Reload Error")
				# Still show success but with manual steps
				frappe.msgprint(
					f"✓ Dashboard files generated successfully!<br><br>"
					f"<b>Please contact your system administrator to run:</b><br>"
					f"<code>bench migrate && bench restart</code><br><br>"
					f"Then access at: <a href='/app/{self.route}'>/app/{self.route}</a>",
					title="Success (Manual Steps Required)",
					indicator="orange"
				)
			
		except subprocess.CalledProcessError as e:
			error_msg = e.stderr or e.stdout or str(e)
			frappe.log_error(f"Error generating dashboard files: {error_msg}", "Dashboard Generation Error")
			frappe.throw(
				f"Failed to generate dashboard files.<br><br>"
				f"<b>Error:</b> {error_msg}<br><br>"
				f"Check Error Log for details."
			)
		except Exception as e:
			frappe.log_error(f"Error generating dashboard files: {str(e)}", "Dashboard Generation Error")
			frappe.throw(f"Failed to generate dashboard files: {str(e)}")
	
	@frappe.whitelist()
	def activate_template(self, new_title, new_category, new_icon=None):
		"""Activate a template dashboard with custom title and category"""
		if not self.is_template:
			frappe.throw("This is not a template dashboard")
		
		# Update fields
		self.title = new_title
		self.category = new_category
		if new_icon:
			self.icon = new_icon
		self.is_active = 1
		self.save()
		
		frappe.msgprint(
			f"✓ Template activated as '{new_title}'!<br><br>"
			f"<b>Access your dashboard at:</b><br>"
			f"<a href='/app/{self.route}' target='_blank'>/app/{self.route}</a><br><br>"
			f"<small>Add cards from Apex Dashboard Config to populate data.</small>",
			title="Template Activated",
			indicator="green"
		)
	
	@frappe.whitelist()
	def deactivate_template(self):
		"""Deactivate and reset template to original state"""
		if not self.is_template:
			frappe.throw("This is not a template dashboard")
		
		# Extract template number from route
		template_num = self.route.split('_')[-1]
		
		# Reset to template state
		self.title = f"Template Dashboard {template_num}"
		self.category = "Templates"
		self.icon = None
		self.is_active = 0
		self.save()
		
		frappe.msgprint(
			"Template deactivated and reset to original state.<br>"
			"It is now available for reuse.",
			title="Template Deactivated",
			indicator="orange"
		)
