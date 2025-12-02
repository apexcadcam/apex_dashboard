#!/usr/bin/env python3
"""
Override frappe.desk.desktop.get_desktop_page to fix Custom HTML Blocks loading
"""
import frappe
from frappe import _
from json import loads
from frappe.desk.desktop import Workspace as OriginalWorkspace
from frappe.exceptions import DoesNotExistError


class PatchedWorkspace(OriginalWorkspace):
    """Patched Workspace class that loads full Custom HTML Block documents"""

    def get_custom_blocks(self):
        """
        Enhanced version that loads full Custom HTML Block documents
        with html, script, and style fields
        """
        all_custom_blocks = []

        if frappe.has_permission("Custom HTML Block", throw=False):
            custom_blocks = self.doc.custom_blocks

            for custom_block in custom_blocks:
                block_name = custom_block.custom_block_name

                if not block_name:
                    continue

                if frappe.has_permission("Custom HTML Block", doc=block_name):
                    if not self.is_custom_block_permitted(block_name):
                        continue

                    # Load the full Custom HTML Block document
                    try:
                        block_doc = frappe.get_cached_doc("Custom HTML Block", block_name)

                        # Create a dict with all needed fields
                        block_data = frappe._dict({
                            'name': block_doc.name,
                            'label': custom_block.label or block_doc.name,
                            'custom_block_name': block_doc.name,
                            'html': block_doc.html or '',
                            'script': block_doc.script or '',
                            'style': block_doc.style or '',
                            'private': block_doc.private or 0
                        })

                        # Translate label
                        block_data.label = _(block_data.label)

                        all_custom_blocks.append(block_data)

                    except Exception as e:
                        frappe.log_error(f"Error loading Custom HTML Block {block_name}: {str(e)}",
                                       "Custom Block Loading Error")
                        continue

        return all_custom_blocks


@frappe.whitelist()
@frappe.read_only()
def get_desktop_page_override(page):
    """
    Override of frappe.desk.desktop.get_desktop_page
    Uses PatchedWorkspace to properly load Custom HTML Blocks
    """
    try:
        workspace = PatchedWorkspace(loads(page))
        
        # Build workspace components
        workspace.cards = {"items": workspace.get_links()}
        workspace.charts = {"items": workspace.get_charts()}
        workspace.shortcuts = {"items": workspace.get_shortcuts()}
        workspace.onboardings = {"items": workspace.get_onboardings()}
        workspace.quick_lists = {"items": workspace.get_quick_lists()}
        workspace.number_cards = {"items": workspace.get_number_cards()}
        
        # Use our patched get_custom_blocks method
        workspace.custom_blocks = {"items": workspace.get_custom_blocks()}

        return {
            "charts": workspace.charts,
            "shortcuts": workspace.shortcuts,
            "cards": workspace.cards,
            "onboardings": workspace.onboardings,
            "quick_lists": workspace.quick_lists,
            "number_cards": workspace.number_cards,
            "custom_blocks": workspace.custom_blocks,
        }
    except DoesNotExistError:
        frappe.log_error("Workspace Missing")
        return {}
    except Exception as e:
        frappe.log_error(f"Error in override: {str(e)}", "Desktop Page Override Error")
        import traceback
        frappe.log_error(traceback.format_exc(), "Desktop Page Override Traceback")
        raise


def apply_monkey_patch(bootinfo=None):
    """
    Apply monkey patch to frappe.desk.desktop module
    This is called on boot_session
    """
    try:
        import frappe.desk.desktop as desktop_module
        
        # Get the original function
        original_get_desktop_page = desktop_module.get_desktop_page
        
        # Create wrapper that uses our patched version
        def patched_get_desktop_page(page):
            try:
                workspace = PatchedWorkspace(loads(page))
                
                # Build workspace components
                workspace.cards = {"items": workspace.get_links()}
                workspace.charts = {"items": workspace.get_charts()}
                workspace.shortcuts = {"items": workspace.get_shortcuts()}
                workspace.onboardings = {"items": workspace.get_onboardings()}
                workspace.quick_lists = {"items": workspace.get_quick_lists()}
                workspace.number_cards = {"items": workspace.get_number_cards()}
                
                # Use our patched get_custom_blocks method
                workspace.custom_blocks = {"items": workspace.get_custom_blocks()}

                return {
                    "charts": workspace.charts,
                    "shortcuts": workspace.shortcuts,
                    "cards": workspace.cards,
                    "onboardings": workspace.onboardings,
                    "quick_lists": workspace.quick_lists,
                    "number_cards": workspace.number_cards,
                    "custom_blocks": workspace.custom_blocks,
                }
            except DoesNotExistError:
                return {}
            except Exception as e:
                # Fallback to original function if our patch fails
                return original_get_desktop_page(page)
        
        # Copy the whitelist decorator from original
        patched_get_desktop_page = frappe.whitelist()(frappe.read_only()(patched_get_desktop_page))
        
        # Replace the function
        desktop_module.get_desktop_page = patched_get_desktop_page
        
    except Exception as e:
        frappe.log_error(f"Failed to apply monkey patch: {str(e)}", "Monkey Patch Error")
