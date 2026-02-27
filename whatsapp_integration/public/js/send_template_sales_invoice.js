frappe.ui.form.on('Sales Invoice', {
    refresh(frm) {
        if (!frm.is_new()) {
            frm.add_custom_button('Send Invoice', function () {
                frappe.call({
                    method: 'whatsapp_integration.erpnext_whatsapp.custom_scripts.send_whatsapp_notification_template_invoice.send_invoice_notification',
                    args: { sales_invoice: frm.doc.name },
                    freeze: true,
                    freeze_message: 'Sending WhatsApp Invoice...',
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.msgprint({
                                title: 'Success',
                                message: 'WhatsApp invoice queued successfully!',
                                indicator: 'green'
                            });
                        } else {
                            frappe.msgprint({
                                title: 'Failed',
                                message: 'Failed to send WhatsApp invoice.',
                                indicator: 'red'
                            });
                        }
                    }
                });
            }, 'WhatsApp');
        }
    }
});