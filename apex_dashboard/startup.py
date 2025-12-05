#!/usr/bin/env python3
"""
Startup script to apply monkey patch for Custom HTML Blocks
"""
import frappe

def apply_patch():
    """Apply monkey patch on app startup"""
    try:
        from apex_dashboard.overrides import apply_monkey_patch
        apply_monkey_patch()
        print("✓ Applied Custom HTML Blocks monkey patch")
    except Exception as e:
        print(f"✗ Failed to apply monkey patch: {e}")






