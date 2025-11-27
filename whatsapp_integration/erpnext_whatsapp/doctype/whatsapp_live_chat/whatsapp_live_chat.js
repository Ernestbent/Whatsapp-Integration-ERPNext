frappe.ui.form.on("Whatsapp Live Chat", {
    refresh(frm) {
        if (frm.doc.unread_count > 0) {
            frm.set_value("unread_count", 0);
            frm.save();
            frappe.call({
                method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.mark_read.mark_whatsapp_messages_read",
                args: { contact_number: frm.doc.contact },
                freeze: false
            });
        }

        const chat_field = frm.get_field("chat_area");
        if (!chat_field) return;

        chat_field.$wrapper.html(`
            <div id="wp_ui" style="height:100%;display:flex;flex-direction:column;background:#efe7dd;">
                <div style="background:#075e54;color:white;padding:15px;text-align:center;font-size:18px;font-weight:bold;">
                    ${frm.doc.customer || ''}
                    <div style="font-size:12px;">${frm.doc.contact || ''}</div>
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

        const contact_number = frm.doc.contact;

        function get_whatsapp_ticks(status) {
            switch(status){
                case "read": return '<span style="color:#4FC3F7;font-weight:bold;">✓✓</span>';
                case "delivered": return '<span style="color:#999;font-weight:bold;">✓✓</span>';
                case "sent": return '<span style="color:#999;font-weight:bold;">✓</span>';
                case "failed": return '<span style="color:#f44336;font-weight:bold;">⚠</span>';
                default: return '<span style="color:#999;font-weight:bold;">✓</span>';
            }
        }

        function load_messages() {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Whatsapp Message",
                    filters: [["from_number","=",contact_number]],
                    fields: ["name","message","custom_status","timestamp","message_status"],
                    order_by: "creation asc",
                    limit_page_length: 500
                },
                callback: function(r){
                    if(!r.message) return;
                    const box = $("#messages").empty();

                    r.message.forEach(m => {
                        const is_outgoing = m.custom_status === "Outgoing";
                        const ticks = is_outgoing ? get_whatsapp_ticks(m.message_status) : "";

                        const html = `
                            <div id="msg_${m.name}" style="
                                max-width:70%;
                                padding:10px 14px;
                                border-radius:18px;
                                background:${is_outgoing ? "#dcf8c6" : "#fff"};
                                align-self:${is_outgoing ? "flex-end" : "flex-start"};
                                box-shadow:0 1px 2px rgba(0,0,0,0.1);
                                word-wrap:break-word;
                            ">
                                <div>${m.message}</div>
                                <div class="tick_area" style="font-size:10px;color:#888;text-align:right;margin-top:4px;display:flex;align-items:center;gap:4px;justify-content:flex-end;">
                                    ${m.timestamp} ${ticks}
                                </div>
                            </div>
                        `;
                        box.append(html);
                    });

                    // Update ticks if status changed before chat opened
                    r.message.forEach(m=>{
                        const msgDiv = $(`#msg_${m.name}`);
                        if(msgDiv.length && m.custom_status==="Outgoing"){
                            const tickHtml = get_whatsapp_ticks(m.message_status);
                            msgDiv.find(".tick_area").html(m.timestamp+" "+tickHtml);
                        }
                    });

                    box.scrollTop(box[0].scrollHeight);
                }
            });
        }

        load_messages();

        // Real-time new messages
        frappe.realtime.on("whatsapp_new_message",(data)=>{
            if(data.contact_number===frm.doc.contact){
                load_messages();
                frappe.utils.play_sound("message");
            }
        });

        // Real-time status updates
        frappe.realtime.on("whatsapp_message_status_changed",(data)=>{
            if(data.contact_number===frm.doc.contact){
                const msgDiv = $(`#msg_${data.message_name}`);
                if(msgDiv.length){
                    const tickHtml = get_whatsapp_ticks(data.new_status);
                    msgDiv.find(".tick_area").html(data.timestamp+" "+tickHtml);
                }
            }
        });

        // Send message button
        $(document).off("click","#send_btn").on("click","#send_btn",function(){
            const txt=$("#msg_input").val().trim();
            if(!txt) return;
            frappe.call({
                method:"whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply.send_whatsapp_reply",
                args:{to_number:contact_number,message_body:txt},
                callback(r){
                    if(r.message?.success){
                        $("#msg_input").val("");
                        load_messages();
                    } else {
                        frappe.msgprint("Send failed: "+(r.message?.error||"Check console"));
                    }
                }
            });
        });

        // Press Enter to send
        $(document).off("keypress","#msg_input").on("keypress","#msg_input",function(e){
            if(e.key==="Enter"){
                e.preventDefault();
                $("#send_btn").click();
            }
        });

        clearInterval(frm._interval);
        frm._interval=setInterval(()=>!frm.is_dirty() && load_messages(),30000);
        frm.on_unload=()=>clearInterval(frm._interval);
    }
});
