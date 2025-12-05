app_name = "apex_dashboard"
app_title = "Apex Dashboard"
app_publisher = "Gaber"
app_description = "Dashboard analytics and reporting"
app_email = "gaber@example.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "apex_dashboard",
# 		"logo": "/assets/apex_dashboard/logo.png",
# 		"title": "Apex Dashboard",
# 		"route": "/apex_dashboard",
# 		"has_permission": "apex_dashboard.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = ["/assets/apex_dashboard/css/glass_apple.css"]
# app_include_js = ["/assets/apex_dashboard/js/workspace_customizations.js"]  # Disabled - User managing workspace manually

# include js, css files in header of web template
# web_include_css = "/assets/apex_dashboard/css/apex_dashboard.css"
# web_include_js = "/assets/apex_dashboard/js/apex_dashboard.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "apex_dashboard/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "apex_dashboard/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "apex_dashboard.utils.jinja_methods",
# 	"filters": "apex_dashboard.utils.jinja_filters"
# }

# Installation
# ------------

after_install = "apex_dashboard.install.after_install"
after_migrate = ["apex_dashboard.install.after_migrate"]

# Uninstallation
# ------------

before_uninstall = "apex_dashboard.install.before_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "apex_dashboard.utils.before_app_install"
# after_app_install = "apex_dashboard.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "apex_dashboard.utils.before_app_uninstall"
# after_app_uninstall = "apex_dashboard.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "apex_dashboard.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
    "GL Entry": {
        "on_submit": "apex_dashboard.cache_utils.clear_all_dashboard_caches",
        "on_cancel": "apex_dashboard.cache_utils.clear_all_dashboard_caches"
    },
    "Payment Entry": {
        "on_submit": "apex_dashboard.cache_utils.clear_all_dashboard_caches",
        "on_cancel": "apex_dashboard.cache_utils.clear_all_dashboard_caches"
    },
    "Journal Entry": {
        "on_submit": "apex_dashboard.cache_utils.clear_all_dashboard_caches",
        "on_cancel": "apex_dashboard.cache_utils.clear_all_dashboard_caches"
    },
    "Sales Invoice": {
        "on_submit": "apex_dashboard.cache_utils.clear_all_dashboard_caches",
        "on_cancel": "apex_dashboard.cache_utils.clear_all_dashboard_caches"
    },
    "Purchase Invoice": {
        "on_submit": "apex_dashboard.cache_utils.clear_all_dashboard_caches",
        "on_cancel": "apex_dashboard.cache_utils.clear_all_dashboard_caches"
    }
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"apex_dashboard.tasks.all"
# 	],
# 	"daily": [
# 		"apex_dashboard.tasks.daily"
# 	],
# 	"hourly": [
# 		"apex_dashboard.tasks.hourly"
# 	],
# 	"weekly": [
# 		"apex_dashboard.tasks.weekly"
# 	],
# 	"monthly": [
# 		"apex_dashboard.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "apex_dashboard.install.before_tests"

# Overriding Methods
# ------------------------------
#
override_whitelisted_methods = {
	"frappe.desk.desktop.get_desktop_page": "apex_dashboard.overrides.get_desktop_page_override"
}

# Boot session hook to apply monkey patch
# ------------------------------
boot_session = "apex_dashboard.overrides.apply_monkey_patch"

# App startup hook
# ------------------------------
after_app_install = "apex_dashboard.overrides.apply_monkey_patch"
after_migrate = ["apex_dashboard.install.after_migrate", "apex_dashboard.overrides.apply_monkey_patch"]

# Request hooks - apply patch on every request
# ------------------------------
before_request = ["apex_dashboard.overrides.apply_monkey_patch"]
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "apex_dashboard.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["apex_dashboard.utils.before_request"]
# after_request = ["apex_dashboard.utils.after_request"]

# Job Events
# ----------
# before_job = ["apex_dashboard.utils.before_job"]
# after_job = ["apex_dashboard.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"apex_dashboard.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

fixtures = [
	{
		"dt": "Custom Field",
		"filters": [
			["module", "=", "Apex Dashboard"]
		],
	},
	{
		"dt": "Custom HTML Block",
		"filters": [
			["name", "in", [
				"Dashboard Profile Banner",
				"Dashboard Clock Egypt",
				"Dashboard Clock China",
				"Dashboard Clock Germany",
				"Dashboard Holidays",
				"Dashboard Notes"
			]]
		]
	},
	{
		"dt": "Workspace",
		"filters": [
			["name", "=", "Apex Dashboards Hub"]
		]
	}
]

