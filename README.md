### Apex Dashboard

Dashboard analytics and reporting

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app apex_dashboard
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/apex_dashboard
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### Fixtures and Customizations

This app includes automatic fixture export to ensure all customizations are version-controlled:

**Included Fixtures:**
- Custom Fields (module: "Apex Dashboard")
- Custom HTML Blocks (Dashboard widgets)
- Workspace ("Apex Dashboards Hub")

**Automatic Export:**
- A pre-commit hook automatically exports fixtures before each commit
- Manual export: `python3 scripts/export_fixtures.py`
- Pre-push check: `./scripts/pre_push_check.sh`

**Before Pushing to GitHub:**
Always ensure fixtures are exported and committed:
```bash
# Export fixtures
bench --site all export-fixtures --app apex_dashboard

# Review changes
git diff apex_dashboard/fixtures/

# Add and commit
git add apex_dashboard/fixtures/
git commit -m "Update fixtures"
git push origin master
```

### License

mit
