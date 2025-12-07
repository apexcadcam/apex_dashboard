#!/usr/bin/env python3
"""
Script to export fixtures and customizations for apex_dashboard app.
This script should be run before committing changes to ensure all fixtures are exported.
"""

import os
import sys
import subprocess
import json
from pathlib import Path

# Add the app directory to the path
app_path = Path(__file__).parent.parent
sys.path.insert(0, str(app_path))

def run_bench_command(command):
    """Run a bench command and return the output."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            cwd=app_path.parent.parent  # Go to bench root
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def export_fixtures():
    """Export all fixtures defined in hooks.py"""
    print("🔄 Exporting fixtures for apex_dashboard...")
    
    # Get the site name (default to first site or 'all')
    site = os.environ.get('FRAPPE_SITE', 'all')
    
    # Run bench export-fixtures
    success, stdout, stderr = run_bench_command(
        f"bench --site {site} export-fixtures --app apex_dashboard"
    )
    
    if success:
        print("✅ Fixtures exported successfully!")
        print(stdout)
        return True
    else:
        print("❌ Error exporting fixtures:")
        print(stderr)
        return False

def check_fixtures_directory():
    """Check if fixtures directory exists and has files"""
    fixtures_dir = app_path / "apex_dashboard" / "fixtures"
    
    if not fixtures_dir.exists():
        print(f"⚠️  Fixtures directory not found: {fixtures_dir}")
        return False
    
    fixtures_files = list(fixtures_dir.glob("*.json"))
    
    if not fixtures_files:
        print(f"⚠️  No fixture files found in {fixtures_dir}")
        return False
    
    print(f"✅ Found {len(fixtures_files)} fixture files:")
    for f in fixtures_files:
        print(f"   - {f.name}")
    
    return True

def verify_fixtures_in_hooks():
    """Verify that fixtures are defined in hooks.py"""
    hooks_file = app_path / "apex_dashboard" / "hooks.py"
    
    if not hooks_file.exists():
        print(f"❌ hooks.py not found: {hooks_file}")
        return False
    
    with open(hooks_file, 'r') as f:
        content = f.read()
    
    if 'fixtures = [' in content:
        print("✅ Fixtures are defined in hooks.py")
        return True
    else:
        print("⚠️  No fixtures definition found in hooks.py")
        return False

def main():
    """Main function"""
    print("=" * 60)
    print("Apex Dashboard - Fixtures Export Script")
    print("=" * 60)
    print()
    
    # Verify hooks.py has fixtures
    if not verify_fixtures_in_hooks():
        print("\n⚠️  Warning: No fixtures defined in hooks.py")
        print("   Please add fixtures to hooks.py before exporting")
        return 1
    
    # Export fixtures
    if not export_fixtures():
        return 1
    
    # Check fixtures directory
    if not check_fixtures_directory():
        return 1
    
    print()
    print("=" * 60)
    print("✅ All fixtures exported successfully!")
    print("=" * 60)
    print()
    print("📝 Next steps:")
    print("   1. Review the exported fixture files")
    print("   2. Add them to git: git add apex_dashboard/fixtures/")
    print("   3. Commit: git commit -m 'Update fixtures'")
    print("   4. Push: git push origin master")
    print()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())



