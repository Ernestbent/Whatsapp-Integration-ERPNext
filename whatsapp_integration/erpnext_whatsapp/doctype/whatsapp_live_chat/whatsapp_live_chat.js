frappe.ui.form.on("Whatsapp Live Chat", {
    refresh(frm) {
        // Mark read
        if (frm.doc.unread_count > 0) {
            frm.set_value("unread_count", 0);
            frm.save();
        }

        let chat_field = frm.get_field("chat_area");
        if (!chat_field) {
            console.error("chat_area field not found. Make sure fieldtype = HTML");
            return;
        }

        chat_field.$wrapper.html(`
            <div id="wp_ui" style="height:100%;display:flex;flex-direction:column;background:#efe7dd;">
                <div style="background:#075e54;color:white;padding:15px;text-align:center;font-size:18px;font-weight:bold;">
                    ${frm.doc.customer || ''}
                    <div style="font-size:12px;">${frm.doc.mobile_number || ''}</div>
                </div>
                <div id="messages" style="flex:1;overflow-y:auto;padding:15px;display:flex;flex-direction:column;gap:12px;"></div>
                <div style="display:flex;gap:10px;padding:10px;background:#f0f0f0;border-top:1px solid #ccc;">
                    <input id="msg_input" type="text" placeholder="Type message…"
                        style="flex:1;padding:12px 16px;border:1px solid #ccc;border-radius:20px;" />
                    <button id="send_btn"
                        style="background:#25d366;color:white;padding:12px 18px;border:none;border-radius:10px;cursor:pointer;">
                        Send
                    </button>
                </div>
            </div>
        `);

        const number = frm.doc.mobile_number;

        function load_messages() {
            frappe.db.get_list("Whatsapp Message", {
                filters: { from_number: number },
                fields: ["message", "custom_status", "timestamp"],
                order_by: "creation asc"
            }).then(messages => {
                const box = $("#messages").empty();
                messages.forEach(m => {
                    // GREY TICKS FOR OUTGOING — EXACTLY LIKE WHATSAPP
                    let tick_html = m.custom_status === "Outgoing" ? 
                        `<span style="color:#999;margin-left:4px;font-size:11px;">✔✔</span>` : '';

                    let html = `
                        <div style="
                            max-width:70%;
                            padding:10px 14px;
                            border-radius:18px;
                            background:${m.custom_status === "Outgoing" ? "#dcf8c6" : "#fff"};
                            align-self:${m.custom_status === "Outgoing" ? "flex-end" : "flex-start"};
                            box-shadow:0 1px 2px rgba(0,0,0,0.1);
                            word-wrap:break-word;
                        ">
                            <div style="word-wrap:break-word;">${m.message}</div>
                            <div style="font-size:10px;color:#888;text-align:right;margin-top:4px;display:flex;align-items:center;gap:4px;justify-content:flex-end;">
                                ${m.timestamp} ${tick_html}
                            </div>
                        </div>
                    `;
                    box.append(html);
                });
                box.scrollTop(box[0].scrollHeight);
            });
        }

        load_messages();

        // FIXED: Use event delegation so button works even when added dynamically
        $(document).off("click", "#send_btn").on("click", "#send_btn", function() {
            const txt = $("#msg_input").val().trim();
            if (!txt) return;

            frappe.call({
                method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply.send_whatsapp_reply",
                args: { to_number: number, message_body: txt },
                callback(r) {
                    if (r.message?.success) {
                        $("#msg_input").val("");
                        load_messages();
                    } else {
                        frappe.msgprint("Send failed: " + (r.message?.error || "Check console"));
                    }
                },
                error: () => {
                    frappe.msgprint("Send failed — check console");
                }
            });
        });

        // Enter key also works
        $(document).off("keypress", "#msg_input").on("keypress", "#msg_input", function(e) {
            if (e.key === "Enter") {
                e.preventDefault();
                $("#send_btn").click();
            }
        });
    }
});