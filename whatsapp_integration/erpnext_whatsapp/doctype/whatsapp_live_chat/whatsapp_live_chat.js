frappe.ui.form.on("Whatsapp Live Chat", {
    refresh(frm) {
        const chat_field = frm.get_field("chat_area");
        if (!chat_field) return;

        // Build WhatsApp-style chat UI
        chat_field.$wrapper.html(`
            <div id="wp_ui" style="height:100%;display:flex;flex-direction:column;background:#efe7dd;">
                <div style="background:#075e54;color:white;padding:15px;text-align:center;font-size:18px;font-weight:bold;">
                    ${frm.doc.contact_name || frm.doc.contact || 'Unknown'}
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

        function render_media_content(message) {
            const type = message.message_type;
            const file_url = message.custom_document;
            const message_text = message.message;

            // No media attachment
            if (!file_url) {
                return `<div style="white-space:pre-wrap;">${frappe.utils.escape_html(message_text || '')}</div>`;
            }

            let media_html = '';

            switch(type) {
                case 'image':
                    media_html = `
                        <div style="margin-bottom:8px;">
                            <a href="${file_url}" target="_blank">
                                <img src="${file_url}" 
                                    style="max-width:100%;max-height:300px;border-radius:8px;cursor:pointer;display:block;" 
                                    onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
                                <div style="display:none;padding:10px;background:#f5f5f5;border-radius:8px;text-align:center;">
                                    📷 Image - Click to view
                                </div>
                            </a>
                        </div>
                        ${message_text && !message_text.startsWith('Image:') ? `<div style="margin-top:4px;white-space:pre-wrap;">${frappe.utils.escape_html(message_text)}</div>` : ''}
                    `;
                    break;

                case 'document':
                    const filename = message_text.replace('Document: ', '').split(' - ')[0];
                    const file_ext = filename.split('.').pop().toUpperCase();
                    media_html = `
                        <a href="${file_url}" target="_blank" style="text-decoration:none;color:inherit;">
                            <div style="
                                display:flex;
                                align-items:center;
                                gap:10px;
                                padding:10px;
                                background:#f5f5f5;
                                border-radius:8px;
                                border:1px solid #ddd;
                                cursor:pointer;
                                transition:background 0.2s;
                            " onmouseover="this.style.background='#e8e8e8'" onmouseout="this.style.background='#f5f5f5'">
                                <div style="
                                    min-width:40px;
                                    height:40px;
                                    background:#075e54;
                                    color:white;
                                    display:flex;
                                    align-items:center;
                                    justify-content:center;
                                    border-radius:6px;
                                    font-size:10px;
                                    font-weight:bold;
                                ">
                                    ${file_ext}
                                </div>
                                <div style="flex:1;min-width:0;">
                                    <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                                        ${frappe.utils.escape_html(filename)}
                                    </div>
                                    <div style="font-size:11px;color:#666;">
                                        Click to download
                                    </div>
                                </div>
                                <div style="color:#075e54;font-size:20px;">📥</div>
                            </div>
                        </a>
                    `;
                    break;

                case 'audio':
                    media_html = `
                        <div style="
                            padding:10px;
                            background:#f5f5f5;
                            border-radius:8px;
                            border:1px solid #ddd;
                        ">
                            <audio controls style="width:100%;max-width:300px;">
                                <source src="${file_url}" type="audio/ogg">
                                <source src="${file_url}" type="audio/mpeg">
                                <source src="${file_url}" type="audio/mp4">
                                Your browser does not support audio playback.
                            </audio>
                            <div style="margin-top:4px;font-size:11px;color:#666;">
                                <a href="${file_url}" target="_blank" style="color:#075e54;">Download Audio</a>
                            </div>
                        </div>
                    `;
                    break;

                case 'video':
                    media_html = `
                        <div style="margin-bottom:8px;">
                            <video controls style="max-width:100%;max-height:300px;border-radius:8px;">
                                <source src="${file_url}" type="video/mp4">
                                <source src="${file_url}" type="video/webm">
                                Your browser does not support video playback.
                            </video>
                        </div>
                        ${message_text && !message_text.startsWith('Video:') ? `<div style="margin-top:4px;white-space:pre-wrap;">${frappe.utils.escape_html(message_text)}</div>` : ''}
                    `;
                    break;

                case 'sticker':
                    media_html = `
                        <div style="margin-bottom:8px;">
                            <img src="${file_url}" 
                                style="max-width:150px;max-height:150px;border-radius:4px;" 
                                onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
                            <div style="display:none;">🎭 Sticker</div>
                        </div>
                    `;
                    break;

                case 'location':
                    // Extract coordinates from message text
                    const coords = message_text.replace('Location: ', '').split(', ');
                    if (coords.length === 2) {
                        const [lat, lng] = coords;
                        media_html = `
                            <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="text-decoration:none;color:inherit;">
                                <div style="
                                    padding:10px;
                                    background:#f5f5f5;
                                    border-radius:8px;
                                    border:1px solid #ddd;
                                    cursor:pointer;
                                    transition:background 0.2s;
                                " onmouseover="this.style.background='#e8e8e8'" onmouseout="this.style.background='#f5f5f5'">
                                    <div style="font-weight:500;">📍 Location Shared</div>
                                    <div style="font-size:11px;color:#666;margin-top:4px;">
                                        ${lat}, ${lng}
                                    </div>
                                    <div style="font-size:11px;color:#075e54;margin-top:4px;">
                                        Click to view on Google Maps
                                    </div>
                                </div>
                            </a>
                        `;
                    } else {
                        media_html = `<div style="white-space:pre-wrap;">${frappe.utils.escape_html(message_text)}</div>`;
                    }
                    break;

                case 'contacts':
                    media_html = `
                        <div style="
                            padding:10px;
                            background:#f5f5f5;
                            border-radius:8px;
                            border:1px solid #ddd;
                        ">
                            <div style="font-weight:500;">👤 ${frappe.utils.escape_html(message_text)}</div>
                        </div>
                    `;
                    break;

                default:
                    media_html = `<div style="white-space:pre-wrap;">${frappe.utils.escape_html(message_text || 'Unsupported message type')}</div>`;
            }

            return media_html;
        }

        function load_messages() {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Whatsapp Message",
                    filters: [["from_number","=",contact_number]],
                    fields: [
                        "name",
                        "message",
                        "custom_status",
                        "timestamp",
                        "message_status",
                        "message_type",
                        "custom_document",
                        "media_id"
                    ],
                    order_by: "creation asc",
                    limit_page_length: 500
                },
                callback: function(r){
                    if(!r.message) return;
                    const box = $("#messages").empty();

                    r.message.forEach(m => {
                        const is_outgoing = m.custom_status === "Outgoing";
                        const ticks = is_outgoing ? get_whatsapp_ticks(m.message_status) : "";
                        const media_content = render_media_content(m);

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
                                ${media_content}
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
            if(data.contact_number===contact_number){
                load_messages();
                frappe.utils.play_sound("message");
            }
        });

        // Real-time status updates
        frappe.realtime.on("whatsapp_message_status_changed",(data)=>{
            if(data.contact_number===contact_number){
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
            
            // Disable button to prevent double-sending
            $("#send_btn").prop("disabled", true).text("Sending...");
            
            frappe.call({
                method:"whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply.send_whatsapp_reply",
                args:{to_number:contact_number,message_body:txt},
                callback(r){
                    $("#send_btn").prop("disabled", false).text("Send");
                    
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

        // Auto-refresh messages every 30 seconds
        clearInterval(frm._interval);
        frm._interval=setInterval(()=>{
            if(!frm.is_dirty()){
                load_messages();
            }
        }, 30000);
        
        frm.on_unload=()=>clearInterval(frm._interval);
    }
});