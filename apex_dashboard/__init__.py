__version__ = "0.0.1"

# Auto-apply monkey patch when apex_dashboard module is imported
import frappe
from json import loads

_patch_applied = False

def _apply_patch():
    """Apply the monkey patch for Custom HTML Blocks"""
    global _patch_applied
    
    if _patch_applied:
        return
    
    try:
        from frappe.desk.desktop import Workspace as OriginalWorkspace
        from frappe.exceptions import DoesNotExistError
        from frappe import _
        
        class PatchedWorkspace(OriginalWorkspace):
            """Patched Workspace class that loads full Custom HTML Block documents"""
            
            def get_custom_blocks(self):
                """Enhanced version that loads full Custom HTML Block documents"""
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
                            
                            try:
                                block_doc = frappe.get_cached_doc("Custom HTML Block", block_name)
                                
                                block_data = frappe._dict({
                                    'name': block_doc.name,
                                    'label': custom_block.label or block_doc.name,
                                    'custom_block_name': block_doc.name,
                                    'html': block_doc.html or '',
                                    'script': block_doc.script or '',
                                    'style': block_doc.style or '',
                                    'private': block_doc.private or 0
                                })
                                
                                block_data.label = _(block_data.label)
                                all_custom_blocks.append(block_data)
                                
                            except Exception:
                                continue
                
                return all_custom_blocks
        
        # Monkey patch the desktop module
        import frappe.desk.desktop as desktop_module
        original_get_desktop_page = desktop_module.get_desktop_page
        
        @frappe.whitelist()
        @frappe.read_only()
        def patched_get_desktop_page(page):
            try:
                workspace = PatchedWorkspace(loads(page))
                
                workspace.cards = {"items": workspace.get_links()}
                workspace.charts = {"items": workspace.get_charts()}
                workspace.shortcuts = {"items": workspace.get_shortcuts()}
                workspace.onboardings = {"items": workspace.get_onboardings()}
                workspace.quick_lists = {"items": workspace.get_quick_lists()}
                workspace.number_cards = {"items": workspace.get_number_cards()}
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
            except Exception:
                return original_get_desktop_page(page)
        
        desktop_module.get_desktop_page = patched_get_desktop_page
        _patch_applied = True
        
    except Exception:
        pass

# Apply patch immediately on import
_apply_patch()
