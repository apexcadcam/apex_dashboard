// Copyright (c) 2025, Frappe Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on('Apex Dashboard', {
    refresh: function (frm) {
        // Show "Activate Template" button for inactive templates
        if (frm.doc.is_template && !frm.doc.is_active && !frm.is_new()) {
            frm.add_custom_button(__('Activate Template'), function () {
                let d = new frappe.ui.Dialog({
                    title: __('Activate Template'),
                    fields: [
                        {
                            label: __('Dashboard Title'),
                            fieldname: 'new_title',
                            fieldtype: 'Data',
                            reqd: 1,
                            description: 'Enter a descriptive name for your dashboard'
                        },
                        {
                            label: __('Category'),
                            fieldname: 'new_category',
                            fieldtype: 'Link',
                            options: 'Apex Dashboard Category',
                            reqd: 1,
                            description: 'Select the category for this dashboard'
                        },
                        {
                            label: __('Icon (optional)'),
                            fieldname: 'new_icon',
                            fieldtype: 'Data',
                            description: 'Enter an emoji or icon (e.g., 💰, 📊)'
                        }
                    ],
                    primary_action_label: __('Activate'),
                    primary_action(values) {
                        frappe.call({
                            method: 'activate_template',
                            doc: frm.doc,
                            args: values,
                            freeze: true,
                            freeze_message: __('Activating template...'),
                            callback: function (r) {
                                if (!r.exc) {
                                    d.hide();
                                    frm.reload_doc();
                                }
                            }
                        });
                    }
                });
                d.show();
            }, __('Actions'));
        }

        // Show "Deactivate Template" button for active templates
        if (frm.doc.is_template && frm.doc.is_active && !frm.is_new()) {
            frm.add_custom_button(__('Deactivate Template'), function () {
                frappe.confirm(
                    __('This will reset the template to its original state and make it available for reuse.<br><br>Continue?'),
                    function () {
                        frappe.call({
                            method: 'deactivate_template',
                            doc: frm.doc,
                            freeze: true,
                            freeze_message: __('Deactivating template...'),
                            callback: function (r) {
                                if (!r.exc) {
                                    frm.reload_doc();
                                }
                            }
                        });
                    }
                );
            }, __('Actions'));
        }

        // Show "Generate Files" button for non-template Custom Page dashboards
        if (frm.doc.dashboard_type === "Custom Page" && !frm.doc.is_template && !frm.is_new()) {
            frm.add_custom_button(__('Generate Files'), function () {
                frappe.confirm(
                    'This will generate dashboard files (.py, .js, .json, .css).<br><br>' +
                    '<b>Note:</b> You will need to run <code>bench migrate</code> and <code>bench restart</code> after generation.<br><br>' +
                    'Continue?',
                    function () {
                        frappe.call({
                            method: 'generate_dashboard_files',
                            doc: frm.doc,
                            freeze: true,
                            freeze_message: __('Generating dashboard files...'),
                            callback: function (r) {
                                if (!r.exc) {
                                    frm.reload_doc();
                                }
                            }
                        });
                    }
                );
            }, __('Actions'));
        }
    }
});
