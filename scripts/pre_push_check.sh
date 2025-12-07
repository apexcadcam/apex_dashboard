#!/bin/bash
#
# Pre-push hook to ensure fixtures are exported before pushing to GitHub
# This script can be run manually or added as a git hook
#

set -e

APP_DIR="$(git rev-parse --show-toplevel)"
BENCH_ROOT="$APP_DIR/../.."

echo "=" | tr -d '\n'
echo "🔍 Pre-push Check: Verifying fixtures are up-to-date"
echo "=" | tr -d '\n'
echo

cd "$BENCH_ROOT"

# Check if fixtures directory exists
FIXTURES_DIR="$APP_DIR/apex_dashboard/fixtures"
if [ ! -d "$FIXTURES_DIR" ]; then
    echo "❌ Fixtures directory not found: $FIXTURES_DIR"
    exit 1
fi

# Export fixtures
echo "🔄 Exporting fixtures..."
bench --site all export-fixtures --app apex_dashboard 2>&1 | grep -v "^In \[" || true

# Check if there are uncommitted changes in fixtures
cd "$APP_DIR"
if ! git diff --quiet --exit-code apex_dashboard/fixtures/; then
    echo ""
    echo "⚠️  WARNING: Fixtures have been updated!"
    echo "   The following files have changed:"
    git diff --name-only apex_dashboard/fixtures/
    echo ""
    echo "📝 Please:"
    echo "   1. Review the changes: git diff apex_dashboard/fixtures/"
    echo "   2. Add them: git add apex_dashboard/fixtures/"
    echo "   3. Commit: git commit -m 'Update fixtures'"
    echo "   4. Push again"
    echo ""
    read -p "Continue with push anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ All fixtures are up-to-date"
fi

echo ""
echo "✅ Pre-push check passed!"
echo ""


