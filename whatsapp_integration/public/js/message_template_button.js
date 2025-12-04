frappe.ui.form.on("Whatsapp Message Template", {
    refresh(frm) {
        frm.add_custom_button("Submit to WhatsApp", () => {
            frappe.call({
                method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.message_templates.create_whatsapp_template",
                args: { docname: frm.doc.name },
                callback() {
                    frappe.msgprint("Template submitted to WhatsApp!");
                }
            });
        });
    }
});
