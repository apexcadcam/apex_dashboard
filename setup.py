from setuptools import setup, find_packages
import re
import os

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

# get version from __version__ variable in apex_dashboard/__init__.py
# Read version directly from file to avoid import errors during setup
version_file = os.path.join(os.path.dirname(__file__), "apex_dashboard", "__init__.py")
with open(version_file, "r") as f:
	version_match = re.search(r'__version__\s*=\s*["\']([^"\']+)["\']', f.read())
	if version_match:
		version = version_match.group(1)
	else:
		version = "0.0.1"

setup(
	name="apex_dashboard",
	version=version,
	description="Dashboard analytics and reporting",
	author="Gaber",
	author_email="gaber@example.com",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)



