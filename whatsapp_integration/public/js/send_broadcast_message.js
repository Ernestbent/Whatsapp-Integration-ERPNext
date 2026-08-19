frappe.ui.form.on('BroadCast Message', {
    refresh(frm) {
        frm.add_custom_button(__('Load All Eligible Customers'), () => {
            frappe.call({
                method: 'whatsapp_integration.erpnext_whatsapp.doctype.broadcast_message.broadcast_message.get_eligible_customers',
                freeze: true,
                freeze_message: __('Loading eligible customers...'),
                callback(response) {
                    const customers = response.message && response.message.customers;
                    if (!customers || !customers.length) {
                        frappe.msgprint(__(
                            'No active, opted-in customers with WhatsApp numbers were found.'
                        ));
                        return;
                    }

                    const replace_customers = () => {
                        frm.clear_table('customers');
                        customers.forEach((customer) => {
                            const row = frm.add_child('customers');
                            row.customer = customer.name;
                            row.phone_number = customer.whatsapp_number;
                        });
                        frm.refresh_field('customers');
                        frm.dirty();
                        frappe.show_alert({
                            message: __('Loaded {0} eligible customer(s).', [customers.length]),
                            indicator: 'green'
                        }, 8);
                    };

                    if ((frm.doc.customers || []).length) {
                        frappe.confirm(
                            __('Replace the current customer list with {0} eligible customer(s)?', [
                                customers.length
                            ]),
                            replace_customers
                        );
                    } else {
                        replace_customers();
                    }
                }
            });
        });

        if (frm.is_new() || !frm.doc.enabled) {
            return;
        }

        frm.add_custom_button(__('Send Broadcast'), () => {
            const recipients = (frm.doc.customers || []).filter(
                (row) => row.customer || row.phone_number
            );

            if (!frm.doc.name1 || !recipients.length) {
                frappe.msgprint(__('Select a template and add at least one customer.'));
                return;
            }

            const queue_broadcast = () => {
                frappe.call({
                    method: 'whatsapp_integration.erpnext_whatsapp.doctype.broadcast_message.broadcast_message.enqueue_broadcast',
                    args: { docname: frm.doc.name },
                    freeze: true,
                    freeze_message: __('Queueing WhatsApp broadcast...'),
                    callback(response) {
                        if (response.message && response.message.message) {
                            frappe.show_alert({
                                message: response.message.message,
                                indicator: 'green'
                            }, 8);
                        }
                    }
                });
            };

            frappe.confirm(
                __('Send template {0} to {1} customer(s)? WhatsApp messages cannot be recalled.', [
                    frm.doc.name1,
                    recipients.length
                ]),
                () => {
                    if (frm.is_dirty()) {
                        frm.save().then(queue_broadcast);
                    } else {
                        queue_broadcast();
                    }
                }
            );
        }).addClass('btn-primary');
    }
});
