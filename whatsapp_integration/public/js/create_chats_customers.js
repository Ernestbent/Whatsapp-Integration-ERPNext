frappe.ui.form.on('Whatsapp Setting', {
    refresh(frm) {

        if (frm.doc.name) {
            // Remove old button if exists
            frm.remove_custom_button(__('Create Chats for All Customers'));

            // Add fresh button
            frm.add_custom_button(__('Create Chats for All Customers'), () => {
                createChats(frm);
            }, __('Actions'));  // Optional: group under "Actions"
        }
    }
});

function createChats(frm) {
    frappe.call({
        method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.create_customer_contacts.create_chats_for_all_customers",
        freeze: true,
        freeze_message: __("Creating WhatsApp Live Chats for all customers..."),
        callback: function(r) {
            if (!r.exc) {
                const created = r.message?.created || 0;
                const skipped = r.message?.skipped || 0;
                const total = created + skipped;

                frappe.show_alert({
                    message: __("Done! Created {0} chats ({1} skipped)", [created, skipped]),
                    indicator: "green"
                }, 5);

                frappe.msgprint({
                    title: __("WhatsApp Chats Created"),
                    message: __(
                        `<strong>{0}</strong> chats created<br>
                         <strong>{1}</strong> already existed and were skipped<br><br>
                         Total processed: <strong>{2}</strong> customers`,
                        [created, skipped, total]
                    ),
                    indicator: "green"
                });
            }
        },
        error: function() {
            frappe.msgprint({
                title: __("Error"),
                message: __("Failed to create chats. Check Error Log."),
                indicator: "red"
            });
        }
    });
}