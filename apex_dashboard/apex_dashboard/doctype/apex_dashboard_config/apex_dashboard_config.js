frappe.ui.form.on('Apex Dashboard Config', {
    refresh: function (frm) {
        // Format card names in the grid
        if (frm.fields_dict.cards && frm.fields_dict.cards.grid) {
            frm.fields_dict.cards.grid.wrapper.find('.grid-body .rows').on('DOMSubtreeModified', function () {
                format_card_names(frm);
            });

            // Initial format
            format_card_names(frm);
        }
    }
});

function format_card_names(frm) {
    // Get all card rows
    frm.doc.cards.forEach(function (row) {
        if (row.card) {
            // Fetch card title
            frappe.db.get_value('Apex Dashboard Card', row.card, 'card_title', function (r) {
                if (r && r.card_title) {
                    // Find the row in the grid and update the display
                    var grid_row = frm.fields_dict.cards.grid.grid_rows_by_docname[row.name];
                    if (grid_row) {
                        // Update the card field display
                        var card_cell = grid_row.wrapper.find('[data-fieldname="card"]');
                        if (card_cell.length) {
                            card_cell.find('.static-area').html(r.card_title);
                            card_cell.find('.like-disabled-input').val(r.card_title);
                        }
                    }
                }
            });
        }
    });
}
