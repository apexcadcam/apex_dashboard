"""
Auto-generate dashboard files when dashboard is created/saved
This makes dashboard creation automatic from ERPNext UI
"""

import frappe
import os
import subprocess
from pathlib import Path

def auto_generate_dashboard_files(doc, method=None):
    """
    Automatically generate dashboard files when a dashboard is saved
    Only for Custom Page dashboards that don't have files yet
    """
    # Only for Custom Page type
    if doc.dashboard_type != "Custom Page":
        return
    
    # Check if files already exist
    route = doc.route
    dashboard_path = Path(f"/home/frappe/frappe-bench/apps/apex_dashboard/apex_dashboard/apex_dashboard/page/{route}")
    
    # If directory exists and has files, skip
    if dashboard_path.exists():
        files = list(dashboard_path.glob("*.py"))
        if files:
            frappe.logger().info(f"Dashboard files already exist for {route}")
            return
    
    # Generate files
    try:
        frappe.logger().info(f"Auto-generating files for dashboard: {route}")
        
        generator_script = "/home/frappe/frappe-bench/apps/apex_dashboard/generate_dashboard_simple.py"
        
        # Run generator script
        result = subprocess.run(
            ["python3", generator_script, route, doc.title, doc.category or "General"],
            capture_output=True,
            text=True,
            cwd="/home/frappe/frappe-bench/apps/apex_dashboard"
        )
        
        if result.returncode == 0:
            frappe.logger().info(f"✓ Successfully generated files for {route}")
            frappe.msgprint(
                f"Dashboard files generated successfully for '{doc.title}'!<br>"
                f"Please run: <code>bench migrate && bench clear-cache && bench restart</code><br>"
                f"Then access at: <code>/app/{route}</code>",
                title="Dashboard Files Generated",
                indicator="green"
            )
        else:
            error_msg = result.stderr or result.stdout
            frappe.logger().error(f"Failed to generate files for {route}: {error_msg}")
            frappe.msgprint(
                f"Failed to generate dashboard files.<br>Error: {error_msg}",
                title="Generation Failed",
                indicator="red"
            )
    
    except Exception as e:
        frappe.logger().error(f"Error auto-generating dashboard files: {str(e)}")
        frappe.msgprint(
            f"Error generating dashboard files: {str(e)}",
            title="Error",
            indicator="red"
        )
