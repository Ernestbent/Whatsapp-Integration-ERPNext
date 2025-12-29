frappe.ui.form.on('Payment Entry', {
    refresh(frm) {
        // Show button only if document is saved
        if (!frm.is_new()) {
            frm.add_custom_button(__('Send Message Template'), function () {
                frappe.msgprint(__('Button Clicked'));
            });
        }
    }
});
