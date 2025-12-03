frappe.ui.form.on("Whatsapp Message", {
    refresh(frm) {
        frm.remove_custom_button("Send Reply");

        if (frm.doc.from_number) {
            frm.add_custom_button("Send Reply", function () {
                new frappe.ui.Dialog({
                    title: "Send WhatsApp Message",
                    fields: [
                        {
                            label: "Message",
                            fieldname: "msg",
                            fieldtype: "Small Text",   
                            reqd: 1
                        }
                    ],
                    primary_action_label: "Send",
                    primary_action: function (values) {
                        this.hide();

                        frappe.call({
                            method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply.send_whatsapp_reply",
                            args: {
                                to_number: frm.doc.from_number,
                                message_body: values.msg.trim()
                            },
                            freeze: true,
                            freeze_message: "Sending to WhatsApp...",
                            callback: function (r) {
                                if (r.message && r.message.success) {
                                    frappe.show_alert("Message sent & saved as Outgoing!", "green");
                                    frm.reload_doc();
                                } else {
                                    frappe.msgprint({
                                        title: "Send Failed",
                                        message: r.message?.error || "Unknown error — check Error Log",
                                        indicator: "red"
                                    });
                                }
                            }
                        });
                    }
                }).show();
            }, null, "primary");
        }
    }
});