# Fixtures and Customizations Export Guide

## Overview

This document explains how fixtures and customizations are managed in the `apex_dashboard` app. All customizations (Custom Fields, Custom HTML Blocks, Workspaces) are automatically exported and version-controlled.

## What Are Fixtures?

Fixtures are JSON files that contain customizations made to the Frappe/ERPNext system. They include:

1. **Custom Fields** - Additional fields added to standard DocTypes
2. **Custom HTML Blocks** - Custom widgets for workspaces
3. **Workspaces** - Custom workspace configurations
4. **Property Setters** - Customizations to DocType properties (if any)
5. **Custom Scripts** - Client/Server scripts (if any)

## Current Fixtures

The app currently exports the following fixtures (defined in `hooks.py`):

### Custom Fields
- `Account.dashboard_category` - Treasury Dashboard Category field
- `Account.dashboard_sort_order` - Dashboard Sort Order field

### Custom HTML Blocks
- Dashboard Profile Banner
- Dashboard Clock Egypt
- Dashboard Clock China
- Dashboard Clock Germany
- Dashboard Holidays
- Dashboard Notes

### Workspace
- Apex Dashboards Hub - Main workspace with all custom blocks

## Automatic Export

### Pre-Commit Hook

A git pre-commit hook automatically exports fixtures before each commit:

**Location:** `.git/hooks/pre-commit`

**What it does:**
1. Checks if you're in the `apex_dashboard` app
2. Exports fixtures using `bench export-fixtures`
3. Automatically stages the exported fixture files
4. Allows the commit to proceed

**To enable:**
```bash
chmod +x .git/hooks/pre-commit
```

### Manual Export

You can manually export fixtures at any time:

```bash
# From the bench root directory
bench --site all export-fixtures --app apex_dashboard

# Or use the export script
python3 scripts/export_fixtures.py
```

## Pre-Push Check

Before pushing to GitHub, run the pre-push check script:

```bash
./scripts/pre_push_check.sh
```

This script:
1. Exports fixtures
2. Checks for uncommitted fixture changes
3. Warns you if fixtures need to be committed
4. Optionally blocks the push if fixtures are outdated

## Workflow

### Standard Workflow

1. **Make changes** to the app code
2. **Create/modify customizations** in Frappe UI (if needed)
3. **Export fixtures** (automatic via pre-commit hook, or manual)
4. **Review changes:**
   ```bash
   git diff apex_dashboard/fixtures/
   ```
5. **Commit everything:**
   ```bash
   git add .
   git commit -m "Your commit message"
   # Pre-commit hook will auto-export fixtures
   ```
6. **Push to GitHub:**
   ```bash
   git push origin master
   ```

### Adding New Customizations

When you add new customizations (Custom Fields, HTML Blocks, etc.):

1. **Create the customization** in Frappe UI
2. **Update `hooks.py`** to include it in the fixtures list:
   ```python
   fixtures = [
       {
           "dt": "Custom Field",
           "filters": [["module", "=", "Apex Dashboard"]]
       },
       {
           "dt": "Custom HTML Block",
           "filters": [
               ["name", "in", [
                   "Your New Block Name"
               ]]
           ]
       },
       # ... other fixtures
   ]
   ```
3. **Export fixtures:**
   ```bash
   bench --site all export-fixtures --app apex_dashboard
   ```
4. **Commit the changes:**
   ```bash
   git add apex_dashboard/hooks.py apex_dashboard/fixtures/
   git commit -m "Add new customization"
   ```

## Verification

### Check Fixtures Are Up-to-Date

```bash
# Export fixtures
bench --site all export-fixtures --app apex_dashboard

# Check for changes
git diff apex_dashboard/fixtures/

# If no output, fixtures are up-to-date
```

### Verify Fixtures in hooks.py

```bash
grep -A 20 "fixtures = \[" apex_dashboard/hooks.py
```

## Troubleshooting

### Pre-commit Hook Not Working

1. Check if the hook exists:
   ```bash
   ls -la .git/hooks/pre-commit
   ```

2. Check if it's executable:
   ```bash
   chmod +x .git/hooks/pre-commit
   ```

3. Test manually:
   ```bash
   .git/hooks/pre-commit
   ```

### Fixtures Not Exporting

1. Check if you're in the correct directory (bench root)
2. Verify the site name:
   ```bash
   bench --site all export-fixtures --app apex_dashboard
   ```
3. Check hooks.py has fixtures defined
4. Check app is installed:
   ```bash
   bench --site all list-apps | grep apex_dashboard
   ```

### Fixtures Out of Sync

If fixtures are out of sync:

1. Export fresh fixtures:
   ```bash
   bench --site all export-fixtures --app apex_dashboard
   ```

2. Review changes:
   ```bash
   git diff apex_dashboard/fixtures/
   ```

3. Commit if needed:
   ```bash
   git add apex_dashboard/fixtures/
   git commit -m "Update fixtures"
   ```

## Best Practices

1. **Always export fixtures** before committing major changes
2. **Review fixture changes** before committing
3. **Update hooks.py** when adding new customizations
4. **Test fixture import** on a fresh installation
5. **Document customizations** in code comments

## Files Structure

```
apex_dashboard/
├── apex_dashboard/
│   ├── fixtures/
│   │   ├── custom_field.json
│   │   ├── custom_html_block.json
│   │   └── workspace.json
│   └── hooks.py          # Fixtures definition
├── scripts/
│   ├── export_fixtures.py
│   └── pre_push_check.sh
└── .git/hooks/
    └── pre-commit        # Auto-export hook
```

## Related Documentation

- [Frappe Fixtures Documentation](https://frappeframework.com/docs/user/en/guides/basics/fixtures)
- [Custom Fields Guide](https://frappeframework.com/docs/user/en/customize/custom-fields)
- [Workspace Customization](https://frappeframework.com/docs/user/en/workspace)


