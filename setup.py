from setuptools import setup, find_packages

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

# get version from __version__ variable in apex_dashboard/__init__.py
from apex_dashboard import __version__ as version

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


