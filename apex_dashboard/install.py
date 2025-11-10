"""Install/uninstall helpers for Apex Dashboard."""

from __future__ import annotations

import json
from pathlib import Path

import frappe


def after_install() -> None:
	"""Ensure dashboard custom fields exist after installing the app."""
	try:
		print("\n" + "=" * 70)
		print("📦 Installing Apex Dashboard fixtures...")
		print("=" * 70)

		import_custom_fields()
		frappe.db.commit()

		print("=" * 70)
		print("✅ Apex Dashboard installed successfully!")
		print("=" * 70 + "\n")
	except Exception:
		frappe.log_error(frappe.get_traceback(), "Apex Dashboard Installation Error")
		print("\n❌ Error during installation. Check the error log for details.\n")


def after_migrate() -> None:
	"""Reapply essential fixtures after migrations."""
	try:
		import_custom_fields()
	except Exception:
		frappe.log_error(frappe.get_traceback(), "Apex Dashboard After Migrate")


def before_uninstall() -> None:
	"""Clean up dashboard customisations before uninstall."""
	try:
		print("\n" + "=" * 70)
		print("🗑️  Uninstalling Apex Dashboard...")
		print("=" * 70)

		remove_custom_fields()
		frappe.db.commit()

		print("=" * 70)
		print("✅ Apex Dashboard uninstalled successfully!")
		print("=" * 70 + "\n")
	except Exception:
		frappe.log_error(frappe.get_traceback(), "Apex Dashboard Uninstall Error")
		print("\n❌ Error during uninstall. Check the error log for details.\n")


def import_custom_fields() -> None:
	"""Import dashboard helper custom fields from fixtures."""
	print("\n📋 Importing dashboard custom fields...")

	app_path = Path(frappe.get_app_path("apex_dashboard"))
	fixtures_path = app_path / "fixtures" / "custom_field.json"

	if not fixtures_path.exists():
		print(f"  ⚠️  custom_field.json not found at: {fixtures_path}")
		return

	with fixtures_path.open("r", encoding="utf-8") as handle:
		custom_fields = json.load(handle)

	print(f"  Found {len(custom_fields)} custom field(s) to process")

	created = 0
	updated = 0

	for field_data in custom_fields:
		field_data["module"] = "Apex Dashboard"
		field_name = field_data.get("name")
		dt = field_data.get("dt")
		fieldname = field_data.get("fieldname")

		if not field_name or not dt or not fieldname:
			print("  ❌ Invalid fixture entry, skipping...")
			continue

		if frappe.db.exists("Custom Field", field_name):
			frappe.db.set_value("Custom Field", field_name, "module", "Apex Dashboard")
			updated += 1
			print(f"  🔄 Updated module for: {dt}.{fieldname}")
			continue

		try:
			custom_field = frappe.get_doc(field_data)
			custom_field.insert(ignore_permissions=True, ignore_if_duplicate=True)
			print(f"  ✅ Created: {dt}.{fieldname}")
			created += 1
		except Exception as exc:
			print(f"  ❌ Failed to create {dt}.{fieldname}: {exc}")

	print(f"\n  Summary: {created} created, {updated} updated")
	print("  ✓ Dashboard custom fields installed!\n")


def remove_custom_fields() -> None:
	"""Remove dashboard helper fields when uninstalling."""
	print("\n📋 Removing Apex Dashboard custom fields...")

	fieldnames = ["dashboard_category", "dashboard_sort_order"]

	custom_fields = frappe.get_all(
		"Custom Field",
		filters={"dt": "Account", "fieldname": ["in", fieldnames]},
		fields=["name", "dt", "fieldname"],
	)

	if not custom_fields:
		print("  ℹ️  No dashboard custom fields found to remove")
		return

	print(f"  Found {len(custom_fields)} custom field(s) to remove:")

	removed = 0
	failed = 0

	for field in custom_fields:
		field_label = f"{field.dt}.{field.fieldname}"
		try:
			if frappe.db.exists("Custom Field", field.name):
				frappe.delete_doc("Custom Field", field.name, force=True, ignore_permissions=True)
				print(f"  ✅ Removed: {field_label}")
				removed += 1
			else:
				print(f"  ⏭️  {field_label} not found, skipping...")
		except Exception as exc:
			print(f"  ❌ Failed to remove {field_label}: {exc}")
			failed += 1

	print(f"\n  Summary: {removed} removed, {failed} failed")
	print("  ✓ Dashboard custom field cleanup complete!\n")

