frappe.ui.form.on('Sales Order', {
    refresh: function(frm) {
        setTimeout(() => bind_button(frm), 300);
    }
});

let selected_items_map = {};

// ---------------- BUTTON ----------------
function bind_button(frm) {
    if (!frm.fields_dict.custom_get_items_from) return;
    frm.fields_dict.custom_get_items_from.$input.off('click').on('click', function() {
        open_dialog(frm);
    });
}

// ---------------- DIALOG ----------------
function open_dialog(frm) {
    selected_items_map = {};

    let dialog = new frappe.ui.Dialog({
        title: 'Get Items from JESC Items',
        size: 'extra-large',
        fields: [
            {
                fieldtype: 'Data',
                fieldname: 'search',
                label: 'Search',
                onchange: () => load_items(dialog, 1)
            },
            { fieldtype: 'HTML', fieldname: 'summary_html' },
            { fieldtype: 'HTML', fieldname: 'items_html' },
            { fieldtype: 'HTML', fieldname: 'pagination_html' }
        ],
        primary_action_label: 'Insert',
        primary_action: function() {
            insert_items(frm);
            dialog.hide();
        }
    });

    dialog.set_secondary_action_label('Clear');
    dialog.set_secondary_action(function() {
        selected_items_map = {};
        dialog.fields_dict.items_html.$wrapper.find('.jesc-item-check').prop('checked', false);
        dialog.fields_dict.items_html.$wrapper.find('#jesc-select-all').prop('checked', false);
        dialog.fields_dict.items_html.$wrapper.find('.jesc-discount-input').val('0').trigger('input');
        update_summary(dialog);
    });

    dialog.show();

    dialog.fields_dict.items_html.$wrapper.html(
        `<div style="padding:20px; text-align:center; color:#888; font-size:13px;">
            🔍 Type something in the search box to find items.
        </div>`
    );
    update_summary(dialog);
}

// ---------------- LOAD ----------------
function load_items(dialog, page = 1) {
    let search = (dialog.get_value('search') || "").trim();

    if (!search) {
        dialog.fields_dict.items_html.$wrapper.html(
            `<div style="padding:20px; text-align:center; color:#888; font-size:13px;">
                🔍 Type something in the search box to find items.
            </div>`
        );
        dialog.fields_dict.pagination_html.$wrapper.html('');
        update_summary(dialog);
        return;
    }

    dialog.fields_dict.items_html.$wrapper.html('<p style="padding:10px;">Loading...</p>');

    frappe.call({
        method: 'jesc.customization.api.get_jesc_items',
        args: { search, page },
        callback: function(r) {
            let data = r.message || {};
            render_items(dialog, data.items || []);
            render_pagination(dialog, data.total_pages || 1, page);
        }
    });
}

// ---------------- RENDER ----------------
function render_items(dialog, items) {
    let $wrapper = dialog.fields_dict.items_html.$wrapper;

    if (items.length === 0) {
        $wrapper.html(
            `<div style="padding:20px; text-align:center; color:#888; font-size:13px;">
                No items found.
            </div>`
        );
        update_summary(dialog);
        return;
    }

    let COL = '40px 90px 1fr 120px 100px 110px 100px';

    let html = `
    <div style="border:1px solid #d1d8dd; border-radius:4px; overflow:hidden; margin-top:8px;">

        <!-- HEADER ROW -->
        <div style="display:grid; grid-template-columns:${COL};
                    background:#f4f5f6; border-bottom:2px solid #d1d8dd;
                    font-weight:bold; font-size:12px;">
            <div style="padding:8px; text-align:center; border-right:1px solid #d1d8dd;">
                <input type="checkbox" id="jesc-select-all" style="cursor:pointer; margin:0;">
            </div>
            <div style="padding:8px; border-right:1px solid #d1d8dd;">Item Code</div>
            <div style="padding:8px; border-right:1px solid #d1d8dd;">Item Name</div>
            <div style="padding:8px; border-right:1px solid #d1d8dd;">Item Group</div>
            <div style="padding:8px; border-right:1px solid #d1d8dd; text-align:right;">Selling Rate</div>
            <div style="padding:8px; border-right:1px solid #d1d8dd; text-align:center;">Discount (₹)</div>
            <div style="padding:8px; text-align:right;">Final Rate</div>
        </div>

        <!-- DATA ROWS -->
        <div id="jesc-rows-container">`;

    items.forEach((item, idx) => {
        let checked = selected_items_map[item.item_code] ? "checked" : "";
        let bg = idx % 2 === 0 ? '#ffffff' : '#fafbfc';
        let selling_rate = item.selling_rate || 0;
        let discount = selected_items_map[item.item_code]
            ? (selected_items_map[item.item_code]._discount || 0)
            : 0;
        let final_rate = selling_rate - discount;

        html += `
        <div class="jesc-item-row" data-code="${item.item_code}"
             style="display:grid; grid-template-columns:${COL};
                    background:${bg}; border-bottom:1px solid #e8eaec;
                    cursor:pointer; align-items:center;">
            <div style="padding:8px; text-align:center; border-right:1px solid #e8eaec;">
                <input type="checkbox" class="jesc-item-check" ${checked}
                       style="cursor:pointer; margin:0;"
                       data-code="${item.item_code}">
            </div>
            <div style="padding:8px; border-right:1px solid #e8eaec; font-size:12px;">${item.item_code}</div>
            <div style="padding:8px; border-right:1px solid #e8eaec; font-size:12px;">${item.item_name || ''}</div>
            <div style="padding:8px; border-right:1px solid #e8eaec; font-size:12px;">${item.item_group || ''}</div>
            <div style="padding:8px; border-right:1px solid #e8eaec; font-size:12px; text-align:right;">
                ${frappe.format(selling_rate, {fieldtype: 'Currency'})}
            </div>
            <div style="padding:6px 8px; border-right:1px solid #e8eaec; text-align:center;">
                <input type="number" class="jesc-discount-input form-control input-xs"
                       data-code="${item.item_code}"
                       data-selling="${selling_rate}"
                       value="${discount}"
                       min="0" max="${selling_rate}"
                       style="width:90px; text-align:right; font-size:12px; padding:2px 6px;"
                       placeholder="0">
            </div>
            <div class="jesc-final-rate" data-code="${item.item_code}"
                 style="padding:8px; font-size:12px; text-align:right; font-weight:600; color:#2c5f2e;">
                ${frappe.format(final_rate, {fieldtype: 'Currency'})}
            </div>
        </div>`;
    });

    html += `</div></div>`;

    $wrapper.html(html);

    $wrapper._jesc_items = {};
    items.forEach(i => $wrapper._jesc_items[i.item_code] = i);

    update_summary(dialog);
    bind_events(dialog, $wrapper);
}

// ---------------- SUMMARY ----------------
function update_summary(dialog) {
    let total = dialog.fields_dict.items_html.$wrapper.find('.jesc-item-row').length;
    let selected = Object.keys(selected_items_map).length;
    dialog.fields_dict.summary_html.$wrapper.html(
        `<div style="margin:6px 0; font-size:13px;"><b>Total: ${total} | Selected: ${selected}</b></div>`
    );
}

// ---------------- SYNC SELECT-ALL ----------------
function sync_select_all($wrapper) {
    let total = $wrapper.find('.jesc-item-check').length;
    let checked = $wrapper.find('.jesc-item-check:checked').length;
    $wrapper.find('#jesc-select-all').prop('checked', total > 0 && total === checked);
}

// ---------------- EVENTS ----------------
function bind_events(dialog, $wrapper) {

    $wrapper.find('.jesc-item-check').off('click').on('click', function(e) {
        e.stopPropagation();
        let code = $(this).attr('data-code');
        let item = $wrapper._jesc_items[code];
        let discount = parseFloat($wrapper.find(`.jesc-discount-input[data-code="${code}"]`).val()) || 0;

        if ($(this).is(':checked')) {
            selected_items_map[code] = Object.assign({}, item, { _discount: discount });
        } else {
            delete selected_items_map[code];
        }

        sync_select_all($wrapper);
        update_summary(dialog);
    });

    $wrapper.find('.jesc-item-row').off('click').on('click', function(e) {
        if ($(e.target).is('input')) return;

        let code = $(this).data('code');
        let $cb = $(this).find('.jesc-item-check');
        let item = $wrapper._jesc_items[code];
        let newState = !$cb.prop('checked');
        let discount = parseFloat($wrapper.find(`.jesc-discount-input[data-code="${code}"]`).val()) || 0;

        $cb.prop('checked', newState);

        if (newState) {
            selected_items_map[code] = Object.assign({}, item, { _discount: discount });
        } else {
            delete selected_items_map[code];
        }

        sync_select_all($wrapper);
        update_summary(dialog);
    });

    $wrapper.find('#jesc-select-all').off('change').on('change', function() {
        let checked = $(this).is(':checked');

        $wrapper.find('.jesc-item-check').each(function() {
            $(this).prop('checked', checked);
            let code = $(this).attr('data-code');
            let item = $wrapper._jesc_items[code];
            let discount = parseFloat($wrapper.find(`.jesc-discount-input[data-code="${code}"]`).val()) || 0;

            if (checked) {
                selected_items_map[code] = Object.assign({}, item, { _discount: discount });
            } else {
                delete selected_items_map[code];
            }
        });

        update_summary(dialog);
    });

    $wrapper.find('.jesc-discount-input').off('input').on('input', function(e) {
        e.stopPropagation();
        let code = $(this).attr('data-code');
        let selling = parseFloat($(this).attr('data-selling')) || 0;
        let discount = parseFloat($(this).val()) || 0;

        if (discount > selling) {
            discount = selling;
            $(this).val(discount);
        }
        if (discount < 0) {
            discount = 0;
            $(this).val(0);
        }

        let final_rate = selling - discount;
        $wrapper.find(`.jesc-final-rate[data-code="${code}"]`).html(
            frappe.format(final_rate, {fieldtype: 'Currency'})
        );

        if (selected_items_map[code]) {
            selected_items_map[code]._discount = discount;
            selected_items_map[code]._final_rate = final_rate;
        }
    });

    $wrapper.find('.jesc-discount-input').off('click').on('click', function(e) {
        e.stopPropagation();
    });
}

// ---------------- PAGINATION ----------------
function render_pagination(dialog, total_pages, current_page) {
    let $pg = dialog.fields_dict.pagination_html.$wrapper;

    if (total_pages <= 1) {
        $pg.html('');
        return;
    }

    let html = `<div style="margin-top:10px; display:flex; gap:4px; flex-wrap:wrap; align-items:center;">`;

    let start = Math.max(1, current_page - 2);
    let end = Math.min(total_pages, current_page + 2);

    if (start > 1) html += `<button class="btn btn-xs page-btn" data-page="1">1</button><span>...</span>`;

    for (let i = start; i <= end; i++) {
        html += `<button class="btn btn-xs ${i === current_page ? 'btn-primary' : ''} page-btn"
                    data-page="${i}">${i}</button>`;
    }

    if (end < total_pages) html += `<span>...</span><button class="btn btn-xs page-btn" data-page="${total_pages}">${total_pages}</button>`;

    html += `</div>`;

    $pg.html(html);

    $pg.find('.page-btn').off('click').on('click', function() {
        load_items(dialog, $(this).data('page'));
    });
}

// ---------------- INSERT ----------------
function insert_items(frm) {
    if (frm.doc.items.length === 1 && !frm.doc.items[0].item_code) {
        frm.clear_table("items");
    }

    let dummy = "Dummy Item - JESC";

    frappe.db.get_value('Item', dummy, ['item_name', 'stock_uom']).then(r => {
        let dummy_name = r.message.item_name;
        let dummy_uom  = r.message.stock_uom;

        Object.values(selected_items_map).forEach(item => {
            let row = frm.add_child('items');
            let local_row = locals[row.doctype][row.name];

            let selling_rate  = item.selling_rate || 0;
            let discount      = item._discount || 0;
            let final_rate    = selling_rate - discount;

            local_row.item_code        = dummy;
            local_row.item_name        = dummy_name;
            local_row.uom              = dummy_uom;
            local_row.description      = item.item_name;
            local_row.price_list_rate  = selling_rate;   
            local_row.discount_amount  = discount;   
            local_row.rate             = final_rate;     
            local_row.qty              = 1;
            local_row.amount           = final_rate;
        });

        frm.refresh_field('items');
    });
}