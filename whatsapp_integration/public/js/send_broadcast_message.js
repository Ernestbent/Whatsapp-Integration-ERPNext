frappe.ui.form.on('BroadCast Message', {
   refresh: function(frm) {
       frm.add_custom_button(__('Send Message'), function() {
           frappe.msgprint("Still Under Development");
       });
   }
});
