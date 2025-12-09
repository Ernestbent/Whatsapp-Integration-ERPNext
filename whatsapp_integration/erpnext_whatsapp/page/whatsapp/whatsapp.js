frappe.pages['whatsapp'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'WhatsApp Chat',
        single_column: true
    });

    page.main.html(`
        <style>
            .wa-app-container {height: calc(100vh - 100px); display: flex; background:#f0f2f5; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
            .wa-sidebar {width:380px; background:#fff; border-right:1px solid #ddd; display:flex; flex-direction:column;}
            .wa-sidebar-header {padding:15px; background:#075e54; color:white; font-weight:600; font-size:16px; display:flex; align-items:center; gap:10px;}
            .wa-sidebar-header i {font-size:24px;}
            .wa-chat-list {flex:1; overflow-y:auto;}
            .wa-chat-item {padding:12px 15px; border-bottom:1px solid #f0f0f0; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition: background 0.2s;}
            .wa-chat-item:hover {background:#f5f5f5;}
            .wa-chat-item.active {background:#e8f5e9;}
            .wa-chat-preview {font-size:13px; color:#667781; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;}
            .wa-unread-badge {background:#25d366; color:white; font-size:11px; padding:3px 7px; border-radius:12px; min-width:20px; font-weight:600;}
            .wa-main-chat {flex:1; display:flex; flex-direction:column; background:#e5ddd5 url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6RTlCRjAzNkM3NTY3MTFFQTg2OTZFODQ3RjFGRjhCQUIiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6RTlCRjAzNkQ3NTY3MTFFQTg2OTZFODQ3RjFGRjhCQUIiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpFOUJGMDM2QTc1NjcxMUVBODY5NkU4NDdGMUZGOEJBQiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpFOUJGMDM2Qjc1NjcxMUVBODY5NkU4NDdGMUZGOEJBQiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pg==') repeat;}
            .wa-chat-header {padding:15px 20px; background:#075e54; color:white; font-weight:600; font-size:16px; display:flex; align-items:center; gap:10px; box-shadow:0 1px 2px rgba(0,0,0,0.1);}
            .wa-chat-header i {font-size:18px; color:#25d366;}
            .wa-messages-area {flex:1; overflow-y:auto; padding:20px 60px; display:flex; flex-direction:column; gap:8px;}
            .wa-message {max-width:70%; padding:8px 10px 6px 10px; border-radius:8px; box-shadow:0 1px 2px rgba(0,0,0,0.15); word-wrap:break-word; position:relative;}
            .wa-message.incoming {background:#fff; align-self:flex-start; border-top-left-radius:0;}
            .wa-message.outgoing {background:#d9fdd3; align-self:flex-end; border-top-right-radius:0;}
            .wa-message-text {margin-bottom:2px; line-height:1.4; white-space:pre-wrap;}
            .wa-message-time {font-size:11px; color:#667781; text-align:right; display:flex; align-items:center; justify-content:flex-end; gap:4px; margin-top:4px;}
            .wa-message.outgoing .wa-message-time {color:#53bdeb;}
            .wa-tick {font-size:16px; line-height:1;}
            .wa-tick-sent {color:#8696a0;}
            .wa-tick-delivered {color:#53bdeb;}
            .wa-tick-read {color:#53bdeb;}
            .wa-input-area {padding:12px 20px; background:#f0f0f0; display:flex; align-items:center; gap:10px;}
            .wa-input-wrapper {flex:1; display:flex; align-items:center; background:white; border-radius:24px; padding:8px 16px; gap:8px;}
            #wa-message-input {flex:1; border:none; outline:none; font-size:15px; background:transparent;}
            .wa-emoji-btn {cursor:pointer; font-size:24px; color:#8696a0; transition:color 0.2s;}
            .wa-emoji-btn:hover {color:#075e54;}
            #wa-send-btn {background:#25d366; color:white; border:none; border-radius:50%; width:48px; height:48px; cursor:pointer; transition:background 0.2s; display:flex; align-items:center; justify-content:center;}
            #wa-send-btn:hover {background:#128c7e;}
            #wa-send-btn:disabled {opacity:0.5; cursor:not-allowed;}
            .wa-no-chat {display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#888;}
            .sending-msg {opacity:0.7;}
            .wa-lightbox {display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.95); z-index:9999; justify-content:center; align-items:center; cursor:pointer;}
            .wa-lightbox img, .wa-lightbox video {max-width:90%; max-height:90%; border-radius:12px;}
            .wa-emoji-picker {display:none; position:absolute; bottom:70px; right:20px; background:white; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.2); padding:15px; max-width:350px; z-index:100;}
            .wa-emoji-picker.show {display:block;}
            .wa-emoji-grid {display:grid; grid-template-columns:repeat(8,1fr); gap:8px; max-height:250px; overflow-y:auto;}
            .wa-emoji {font-size:24px; cursor:pointer; padding:4px; border-radius:4px; transition:background 0.2s;}
            .wa-emoji:hover {background:#f5f5f5;}
        </style>

        <div class="wa-app-container">
            <div class="wa-sidebar">
                <div class="wa-sidebar-header">
                    <i class="fa fa-whatsapp"></i>
                    <span>WhatsApp Chats</span>
                </div>
                <div id="wa-chat-list" class="wa-chat-list"></div>
            </div>
            <div class="wa-main-chat">
                <div class="wa-chat-header">
                    <i class="fa fa-user-circle"></i>
                    <div id="wa-header-name">Select a conversation</div>
                </div>
                <div id="wa-messages-area" class="wa-messages-area">
                    <div class="wa-no-chat">
                        <i class="fa fa-comments fa-3x mb-3" style="color:#ccc;"></i>
                        <p>Select a conversation to start messaging</p>
                    </div>
                </div>
                <div class="wa-input-area">
                    <div class="wa-input-wrapper">
                        <span class="wa-emoji-btn" id="wa-emoji-btn">😊</span>
                        <input id="wa-message-input" type="text" placeholder="Type a message" autocomplete="off">
                    </div>
                    <button id="wa-send-btn">
                        <i class="fa fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>

        <div class="wa-emoji-picker" id="wa-emoji-picker">
            <div class="wa-emoji-grid" id="wa-emoji-grid"></div>
        </div>
    `);

    let active_contact = null;
    let active_customer = null;

    // Common emojis
    const common_emojis = ['😊','😂','❤️','😍','😢','😭','😡','👍','👏','🙏','🔥','✨','🎉','💪','🤔','😎','🥰','😘','😜','😇','🤗','🥺','😴','😋','🤩','💯','✅','❌','🎁','🌟','💖'];

    function init_emoji_picker() {
        let html = '';
        common_emojis.forEach(emoji => {
            html += `<div class="wa-emoji" data-emoji="${emoji}">${emoji}</div>`;
        });
        $('#wa-emoji-grid').html(html);

        $('#wa-emoji-btn').on('click', function(e) {
            e.stopPropagation();
            $('#wa-emoji-picker').toggleClass('show');
        });

        $(document).on('click', '.wa-emoji', function() {
            const emoji = $(this).data('emoji');
            const input = $('#wa-message-input');
            input.val(input.val() + emoji);
            input.focus();
            $('#wa-emoji-picker').removeClass('show');
        });

        $(document).on('click', function(e) {
            if (!$(e.target).closest('.wa-emoji-picker, .wa-emoji-btn').length) {
                $('#wa-emoji-picker').removeClass('show');
            }
        });
    }

    function get_tick_icon(status, is_read) {
        if (status === "Incoming") return '';
        
        if (is_read) {
            return '<span class="wa-tick wa-tick-read">✓✓</span>';
        } else {
            return '<span class="wa-tick wa-tick-delivered">✓✓</span>';
        }
    }

    function append_local_message(text) {
        const time = new Date().toTimeString().slice(0,5);
        const html = `
            <div class="wa-message outgoing sending-msg">
                <div class="wa-message-text">${text.replace(/\n/g,"<br>")}</div>
                <div class="wa-message-time">
                    ${time}
                    <span class="wa-tick wa-tick-sent">✓</span>
                </div>
            </div>`;
        $("#wa-messages-area").append(html);
        $("#wa-messages-area")[0].scrollTop = $("#wa-messages-area")[0].scrollHeight;
    }

    function load_conversations() {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Whatsapp Message",
                fields: ["name","customer","from_number","message","creation","custom_status","custom_read"],
                filters: [["message","!=", ""]],
                order_by: "creation desc",
                limit_page_length: 500
            },
            callback(r) {
                if (!r.message) return;

                const convMap = {}, unreadMap = {};
                r.message.forEach(msg => {
                    const key = msg.customer || msg.from_number;
                    if (!convMap[key] || new Date(msg.creation) > new Date(convMap[key].creation))
                        convMap[key] = msg;
                    if (msg.custom_status === "Incoming" && !msg.custom_read)
                        unreadMap[key] = (unreadMap[key] || 0) + 1;
                });

                let html = "";
                Object.keys(convMap).forEach(key => {
                    const msg = convMap[key];
                    const name = msg.customer || msg.from_number;
                    const preview = (msg.message||"").substring(0,45)+(msg.message.length>45?"...":"");
                    const unread = unreadMap[key] || 0;
                    const time = frappe.datetime.comment_when(msg.creation);

                    html += `
                        <div class="wa-chat-item ${active_contact===msg.from_number || active_customer===msg.customer?'active':''}"
                             data-contact="${msg.from_number}" data-customer="${msg.customer||''}">
                            <div style="flex:1; min-width:0;">
                                <div style="font-weight:600; margin-bottom:2px;">${frappe.utils.escape_html(name)}</div>
                                <div class="wa-chat-preview">${frappe.utils.escape_html(preview)||"<i>No message</i>"}</div>
                            </div>
                            <div style="text-align:right; font-size:11px; color:#667781; min-width:60px;">
                                ${time}
                                ${unread?`<div style="margin-top:4px;"><span class="wa-unread-badge">${unread}</span></div>`:''}
                            </div>
                        </div>`;
                });

                $("#wa-chat-list").html(html || "<div style='padding:30px;text-align:center;color:#aaa;'>No conversations yet</div>");

                $(".wa-chat-item").off("click").on("click", function() {
                    $(".wa-chat-item").removeClass("active");
                    $(this).addClass("active");
                    active_contact = $(this).data("contact");
                    active_customer = $(this).data("customer");
                    $("#wa-header-name").text(active_customer || active_contact);
                    load_messages(active_customer, active_contact);
                });
            }
        });
    }

    function load_messages(customer, contact) {
        $("#wa-messages-area").html(`<div style="text-align:center;padding:100px;color:#667781;"><i class="fa fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Loading messages...</p></div>`);

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Whatsapp Message",
                fields: ["name","message","from_number","creation","custom_status","custom_document","custom_read","message_id"],
                filters: customer ? [["customer","=",customer]] : [["from_number","=",contact]],
                order_by: "creation asc",
                limit_page_length: 1000
            },
            callback(r) {
                let html = "";
                const unread_ids = [];
                const unread_message_ids = [];

                (r.message || []).forEach(msg => {
                    if (msg.custom_status === "Incoming" && !msg.custom_read) {
                        unread_ids.push(msg.name);
                        if (msg.message_id) {
                            unread_message_ids.push(msg.message_id);
                        }
                    }

                    const isOutgoing = msg.custom_status !== "Incoming";
                    const time = frappe.datetime.str_to_user(msg.creation).split(' ')[1].slice(0,5);
                    const tick_icon = get_tick_icon(msg.custom_status, msg.custom_read);

                    let attachment = "";
                    if (msg.custom_document) {
                        const url = msg.custom_document;
                        const ext = url.split('.').pop().toLowerCase();

                        if (["jpg","jpeg","png","gif","webp"].includes(ext)) {
                            attachment = `<div style="margin-top:8px;"><img src="${url}" style="max-width:100%;max-height:300px;border-radius:8px;cursor:pointer;" onclick="open_lightbox('${url}', 'image')"></div>`;
                        }
                        else if (ext === "pdf") {
                            attachment = `<div style="margin-top:8px;background:#fdf4f4;padding:10px;border-radius:8px;display:inline-block;">
                                <a href="${url}" target="_blank" style="color:#d32f2f;text-decoration:none;">
                                    <i class="fa fa-file-pdf-o fa-2x"></i> PDF Document
                                </a></div>`;
                        }
                        else if (["mp4","webm","ogg"].includes(ext)) {
                            attachment = `<div style="margin-top:8px;"><video controls style="max-width:100%;max-height:300px;border-radius:8px;">
                                <source src="${url}">Your browser does not support video.</video></div>`;
                        }
                        else {
                            attachment = `<div style="margin-top:8px;background:#f0f0f0;padding:10px;border-radius:8px;display:inline-block;">
                                <a href="${url}" target="_blank" style="color:#333;text-decoration:none;">
                                    <i class="fa fa-paperclip"></i> File Attachment
                                </a></div>`;
                        }
                    }

                    html += `
                        <div class="wa-message ${isOutgoing?'outgoing':'incoming'}">
                            <div class="wa-message-text">${msg.message ? frappe.utils.escape_html(msg.message).replace(/\n/g,"<br>") : ""}</div>
                            ${attachment}
                            <div class="wa-message-time">
                                ${time}
                                ${tick_icon}
                            </div>
                        </div>`;
                });

                $("#wa-messages-area").html(html || "<div class='wa-no-chat'><i class='fa fa-comments fa-3x mb-3' style='color:#ccc;'></i><p>No messages yet. Start the conversation!</p></div>");
                $("#wa-messages-area")[0].scrollTop = $("#wa-messages-area")[0].scrollHeight;

                if (unread_ids.length) {
                    Promise.all(unread_ids.map(id => frappe.call({
                        method: "frappe.client.set_value",
                        args: {doctype: "Whatsapp Message", name: id, fieldname: "custom_read", value: 1}
                    }))).then(() => {
                        load_conversations();
                    });
                }

                // Send read receipts to WhatsApp API
                if (unread_message_ids.length) {
                    unread_message_ids.forEach(message_id => {
                        frappe.call({
                            method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.read_receipts.mark_whatsapp_message_read",
                            args: { message_id: message_id },
                            callback(resp) {
                                if (resp.message && !resp.message.ok) {
                                    console.error("Read receipt failed:", message_id);
                                }
                            }
                        });
                    });
                }
            }
        });
    }

    function send_message() {
        const text = $("#wa-message-input").val().trim();
        if (!text || !active_contact) return;

        append_local_message(text);
        $("#wa-message-input").val("");
        $("#wa-send-btn").prop("disabled", true);

        frappe.call({
            method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply.send_whatsapp_reply",
            args: { to_number: active_contact, message_body: text },
            callback(r) {
                $("#wa-send-btn").prop("disabled", false);
                if (r.message?.success) {
                    $(".sending-msg").last().removeClass("sending-msg")
                        .find(".wa-tick").removeClass("wa-tick-sent").addClass("wa-tick-delivered");
                    load_messages(active_customer, active_contact);
                } else {
                    frappe.msgprint("Failed to send message");
                }
            },
            error() {
                $("#wa-send-btn").prop("disabled", false);
                frappe.msgprint("Network error");
            }
        });
    }

    window.open_lightbox = function(src, type) {
        const box = $(`<div class="wa-lightbox"><${type === 'image' ? 'img src' : 'video controls autoplay'}="${src}"></${type === 'image' ? 'img' : 'video'}></div>`);
        $("body").append(box);
        box.fadeIn(200).on("click", () => box.fadeOut(200, () => box.remove()));
    };

    $(document).on("click", "#wa-send-btn", send_message);
    $(document).on("keypress", "#wa-message-input", e => {
        if (e.which === 13 && !e.shiftKey) { e.preventDefault(); send_message(); }
    });

    init_emoji_picker();
    load_conversations();
    setInterval(load_conversations, 30000);
};
