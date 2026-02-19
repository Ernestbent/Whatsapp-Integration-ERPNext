frappe.ui.form.on('Sales Invoice', {
    refresh(frm) {
        // Show button only after document is saved (not new)
        if (!frm.is_new()) {
            frm.add_custom_button('Send Invoice', function () {

                // First API call - Send WhatsApp text notification
                frappe.call({
                    method: 'whatsapp_integration.erpnext_whatsapp.custom_scripts.whatsapp_api.send_invoice_notification',
                    args: {
                        sales_invoice: frm.doc.name
                    },
                    freeze: true,
                    freeze_message: 'Sending invoice notification...',
                    callback: function (r) {
                        if (!r.exc) {
                            // Second API call - Send Proforma/Media after first succeeds
                            frappe.call({
                                method: 'whatsapp_integration.erpnext_whatsapp.custom_scripts.upload_media_whatsapp_cloud.send_proforma_background',
                                args: {
                                    sales_invoice: frm.doc.name
                                },
                                freeze: true,
                                freeze_message: 'Sending invoice document...',
                                callback: function (r2) {
                                    if (!r2.exc) {
                                        frappe.msgprint({
                                            title: 'Success',
                                            message: 'WhatsApp message and invoice document sent successfully!',
                                            indicator: 'green'
                                        });
                                    } else {
                                        frappe.msgprint({
                                            title: 'Partial Success',
                                            message: 'Text notification sent but failed to send invoice document.',
                                            indicator: 'orange'
                                        });
                                    }
                                }
                            });
                        } else {
                            frappe.msgprint({
                                title: 'Failed',
                                message: 'Failed to send WhatsApp notification.',
                                indicator: 'red'
                            });
                        }
                    }
                });

            }, 'WhatsApp'); // Optional: groups button under a 'WhatsApp' dropdown
        }
    }
});