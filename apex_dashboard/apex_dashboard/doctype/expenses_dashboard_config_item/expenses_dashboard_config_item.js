frappe.ui.form.on('Expenses Dashboard Config Item', {
    parent_account: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.specific_accounts) {
            frappe.model.set_value(cdt, cdn, 'specific_accounts', '');
            frappe.msgprint(__('Parent Account changed. Specific accounts cleared.'));
        }
    },

    select_accounts_btn: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row.parent_account) {
            frappe.msgprint(__('Please select a Parent Account first.'));
            return;
        }

        new frappe.ui.form.MultiSelectDialog({
            doctype: "Account",
            target: frm,
            setters: {
                parent_account: row.parent_account,
                is_group: 0,
                company: frappe.defaults.get_user_default("Company")
            },
            add_filters_group: 1,
            columns: ["name", "account_name"],
            action(selections) {
                let accounts = row.specific_accounts ? row.specific_accounts.split('\n') : [];
                selections.forEach(account => {
                    if (!accounts.includes(account)) {
                        accounts.push(account);
                    }
                });
                frappe.model.set_value(cdt, cdn, 'specific_accounts', accounts.join('\n'));
                cur_dialog.hide();
            }
        });
    }
});

frappe.ui.form.on('Expenses Dashboard Account', {
    before_accounts_add: function (frm, cdt, cdn) {
        // Get the parent row
        let parent_row = frm.get_field('expense_groups').grid.get_row(cdn.split('-')[0]);
        if (parent_row && !parent_row.doc.parent_account) {
            frappe.msgprint(__('Please select a Parent Account first'));
            return false;
        }
    }
});
