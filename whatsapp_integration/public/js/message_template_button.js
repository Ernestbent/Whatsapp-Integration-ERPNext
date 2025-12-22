frappe.ui.form.on("Whatsapp Message Template", {
    refresh(frm) {
        // Submit Template to WhatsApp
        if (!frm.doc.id) {
            frm.add_custom_button("Submit to WhatsApp", () => {
                frappe.call({
                    method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.message_templates.create_whatsapp_template",
                    args: {
                        docname: frm.doc.name
                    },
                    freeze: true,
                    freeze_message: "Submitting template to WhatsApp...",
                    callback(r) {
                        if (r.message && r.message.success) {
                            frappe.msgprint({
                                title: "Submitted",
                                message: "Template submitted successfully. Status: PENDING",
                                indicator: "green"
                            });
                            frm.reload_doc();
                        }
                    }
                });
            });
        }
        // Check WhatsApp Template Status
        if (frm.doc.id) {
            frm.add_custom_button("Check Template Status", () => {
                frappe.call({
                    method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.check_template_status.check_whatsapp_template_status",
                    args: {
                        docname: frm.doc.name
                    },
                    freeze: true,
                    freeze_message: "Checking template status...",
                    callback(r) {
                        if (r.message && r.message.success) {
                            const status = r.message.status;

                            frappe.msgprint({
                                title: "Template Status",
                                message: `Status: <b>${status}</b>`,
                                indicator: status === "APPROVED" ? "green" : "orange"
                            });

                            frm.reload_doc();
                        }
                    }
                });
            });
        }
    }
});
