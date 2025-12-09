frappe.pages['whatsapp'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'WhatsApp Chat',
        single_column: true
    });

    page.main.html(`
        <style>
            .wa-app-container {
                height: calc(100vh - 100px); 
                display: flex; 
                background:#f0f2f5; 
                font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
                border-radius: 12px;
                overflow: hidden;
                margin: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .wa-sidebar {
                width:380px; 
                background:#fff; 
                border-right:1px solid #ddd; 
                display:flex; 
                flex-direction:column;
                border-radius: 12px 0 0 12px;
            }
            
            .wa-sidebar-header {
                padding:20px; 
                background:#075e54; 
                color:white; 
                font-weight:600; 
                font-size:18px; 
                display:flex; 
                align-items:center; 
                gap:12px;
                border-radius: 12px 0 0 0;
            }
            
            .wa-sidebar-header i {
                font-size:28px;
            }
            
            .wa-search-container {
                padding: 15px;
                background: #fff;
                border-bottom: 1px solid #eee;
            }
            
            .wa-search-box {
                display: flex;
                align-items: center;
                background: #f0f2f5;
                border-radius: 20px;
                padding: 10px 15px;
                gap: 10px;
            }
            
            .wa-search-box i {
                color: #667781;
                font-size: 16px;
            }
            
            #wa-search-input {
                flex: 1;
                border: none;
                background: transparent;
                outline: none;
                font-size: 14px;
                color: #333;
            }
            
            #wa-search-input::placeholder {
                color: #667781;
            }
            
            .wa-chat-list {
                flex:1; 
                overflow-y:auto;
            }
            
            .wa-chat-item {
                padding:15px 20px; 
                border-bottom:1px solid #f0f0f0; 
                cursor:pointer; 
                display:flex; 
                justify-content:space-between; 
                align-items:center; 
                transition: background 0.2s;
            }
            
            .wa-chat-item:hover {
                background:#f5f5f5;
            }
            
            .wa-chat-item.active {
                background:#e8f5e9;
            }
            
            .wa-chat-content {
                flex: 1;
                min-width: 0;
            }
            
            .wa-chat-name {
                font-weight:600; 
                margin-bottom:4px;
                color: #111b21;
                font-size: 15px;
            }
            
            .wa-chat-preview {
                font-size:13px; 
                color:#667781; 
                white-space:nowrap; 
                overflow:hidden; 
                text-overflow:ellipsis; 
                max-width:200px;
            }
            
            .wa-unread-badge {
                background:#25d366; 
                color:white; 
                font-size:11px; 
                padding:3px 8px; 
                border-radius:12px; 
                min-width:20px; 
                font-weight:600;
                text-align: center;
            }
            
            .wa-chat-time {
                font-size:11px; 
                color:#667781;
                white-space: nowrap;
            }
            
            .wa-main-chat {
                flex:1; 
                display:flex; 
                flex-direction:column; 
                background:#e5ddd5 url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDUzYgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkU5QkYwMzZDNzU2NzExRUE4Njk2RTg0N0YxRkY4QkFCIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkU5QkYwMzZENzU2NzExRUE4Njk2RTg0N0YxRkY4QkFCIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6RTlCRjAzNkE3NTY3MTFFQTg2OTZFODQ3RjFGRjhCQUIiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6RTlCRjAzNkI3NTY3MTFFQTg2OTZFODQ3RjFGRjhCQUIiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDwvcGFja2V0IGVuZD0iciI/Pg==') repeat;
                border-radius: 0 12px 12px 0;
            }
            
            .wa-chat-header {
                padding:15px 25px; 
                background:#075e54; 
                color:white; 
                font-weight:600; 
                font-size:16px; 
                display:flex; 
                align-items:center; 
                gap:12px; 
                box-shadow:0 1px 2px rgba(0,0,0,0.1);
                border-radius: 0 12px 0 0;
            }
            
            .wa-chat-header i {
                font-size:20px; 
                color:#25d366;
            }
            
            .wa-messages-area {
                flex:1; 
                overflow-y:auto; 
                padding:20px 80px; 
                display:flex; 
                flex-direction:column; 
                gap:8px;
            }
            
            .wa-date-separator {
                text-align: center;
                margin: 20px 0;
                position: relative;
            }
            
            .wa-date-separator span {
                background: rgba(0,0,0,0.1);
                color: #667781;
                padding: 5px 15px;
                border-radius: 15px;
                font-size: 12px;
                font-weight: 500;
            }
            
            .wa-message {
                max-width:70%; 
                padding:8px 12px 6px 12px; 
                border-radius:8px; 
                box-shadow:0 1px 2px rgba(0,0,0,0.15); 
                word-wrap:break-word; 
                position:relative;
                border-radius: 8px 18px 18px 8px;
            }
            
            .wa-message.incoming {
                background:#fff; 
                align-self:flex-start; 
                border-top-left-radius:4px;
                border-radius: 4px 18px 18px 4px;
            }
            
            .wa-message.outgoing {
                background:#d9fdd3; 
                align-self:flex-end; 
                border-top-right-radius:4px;
                border-radius: 18px 4px 4px 18px;
            }
            
            .wa-message-text {
                margin-bottom:2px; 
                line-height:1.5; 
                white-space:pre-wrap;
                font-size: 14px;
            }
            
            .wa-message-time {
                font-size:11px; 
                color:#667781; 
                text-align:right; 
                display:flex; 
                align-items:center; 
                justify-content:flex-end; 
                gap:4px; 
                margin-top:4px;
            }
            
            .wa-message.outgoing .wa-message-time {
                color:#53bdeb;
            }
            
            .wa-tick {
                font-size:14px; 
                line-height:1;
            }
            
            .wa-tick-sent {
                color:#8696a0;
            }
            
            .wa-tick-delivered {
                color:#53bdeb;
            }
            
            .wa-tick-read {
                color:#53bdeb;
            }
            
            .wa-input-area {
                padding:15px 25px; 
                background:#f0f0f0; 
                display:flex; 
                align-items:center; 
                gap:15px;
                border-radius: 0 0 12px 0;
            }
            
            .wa-input-wrapper {
                flex:1; 
                display:flex; 
                align-items:center; 
                background:white; 
                border-radius:24px; 
                padding:8px 20px; 
                gap:12px;
                border: 1px solid #ddd;
            }
            
            #wa-message-input {
                flex:1; 
                border:none; 
                outline:none; 
                font-size:15px; 
                background:transparent;
                min-height: 20px;
            }
            
            .wa-emoji-btn {
                cursor:pointer; 
                font-size:24px; 
                color:#8696a0; 
                transition:color 0.2s;
            }
            
            .wa-emoji-btn:hover {
                color:#075e54;
            }
            
            #wa-send-btn {
                background:#25d366; 
                color:white; 
                border:none; 
                border-radius:50%; 
                width:50px; 
                height:50px; 
                cursor:pointer; 
                transition:background 0.2s; 
                display:flex; 
                align-items:center; 
                justify-content:center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            #wa-send-btn:hover {
                background:#128c7e;
            }
            
            #wa-send-btn:disabled {
                opacity:0.5; 
                cursor:not-allowed;
            }
            
            .wa-no-chat {
                display:flex; 
                flex-direction:column; 
                align-items:center; 
                justify-content:center; 
                height:100%; 
                color:#888;
            }
            
            .sending-msg {
                opacity:0.7;
            }
            
            .wa-lightbox {
                display:none; 
                position:fixed; 
                top:0; 
                left:0; 
                right:0; 
                bottom:0; 
                background:rgba(0,0,0,0.95); 
                z-index:9999; 
                justify-content:center; 
                align-items:center; 
                cursor:pointer;
            }
            
            .wa-lightbox img, .wa-lightbox video {
                max-width:90%; 
                max-height:90%; 
                border-radius:12px;
            }
            
            .wa-emoji-picker {
                display:none; 
                position:absolute; 
                bottom:85px; 
                right:25px; 
                background:white; 
                border-radius:12px; 
                box-shadow:0 4px 20px rgba(0,0,0,0.2); 
                padding:15px; 
                max-width:350px; 
                z-index:100;
                border: 1px solid #ddd;
            }
            
            .wa-emoji-picker.show {
                display:block;
            }
            
            .wa-emoji-grid {
                display:grid; 
                grid-template-columns:repeat(8,1fr); 
                gap:8px; 
                max-height:250px; 
                overflow-y:auto;
            }
            
            .wa-emoji {
                font-size:24px; 
                cursor:pointer; 
                padding:4px; 
                border-radius:6px; 
                transition:background 0.2s;
                text-align: center;
            }
            
            .wa-emoji:hover {
                background:#f5f5f5;
            }
            
            .wa-attachment-btn {
                cursor: pointer;
                font-size: 20px;
                color: #667781;
                transition: color 0.2s;
            }
            
            .wa-attachment-btn:hover {
                color: #075e54;
            }
            
            .wa-attachment-preview {
                margin-top: 10px;
            }
            
            .wa-attachment-preview img {
                max-width: 100%;
                max-height: 300px;
                border-radius: 8px;
                cursor: pointer;
                border: 1px solid #ddd;
            }
            
            .wa-attachment-preview video {
                max-width: 100%;
                max-height: 300px;
                border-radius: 8px;
                background: #000;
            }
            
            .wa-document-preview {
                background: #f5f5f5;
                border-radius: 8px;
                padding: 12px;
                display: flex;
                align-items: center;
                gap: 12px;
                border: 1px solid #ddd;
            }
            
            .wa-document-preview i {
                font-size: 32px;
                color: #d32f2f;
            }
            
            .wa-document-info {
                flex: 1;
            }
            
            .wa-document-name {
                font-weight: 500;
                color: #333;
                margin-bottom: 4px;
                word-break: break-all;
            }
            
            .wa-document-size {
                font-size: 12px;
                color: #667781;
            }
            
            #wa-file-input {
                display: none;
            }
            
            .wa-empty-state {
                text-align: center;
                padding: 50px;
                color: #667781;
            }
            
            .wa-temp-attachment {
                opacity: 0.6;
            }
        </style>

        <div class="wa-app-container">
            <!-- Sidebar -->
            <div class="wa-sidebar">
                <div class="wa-sidebar-header">
                    <i class="fa fa-whatsapp"></i>
                    <span>WhatsApp Chats</span>
                </div>
                
                <div class="wa-search-container">
                    <div class="wa-search-box">
                        <i class="fa fa-search"></i>
                        <input id="wa-search-input" type="text" placeholder="Search contacts..." autocomplete="off">
                    </div>
                </div>
                
                <div id="wa-chat-list" class="wa-chat-list"></div>
            </div>
            
            <!-- Main Chat Area -->
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
                    <input type="file" id="wa-file-input" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt">
                    
                    <div class="wa-input-wrapper">
                        <span class="wa-attachment-btn" id="wa-attachment-btn" title="Attach file">
                            <i class="fa fa-paperclip"></i>
                        </span>
                        <input id="wa-message-input" type="text" placeholder="Type a message" autocomplete="off">
                        <span class="wa-emoji-btn" id="wa-emoji-btn" title="Emoji">
                            <i class="fa fa-smile-o"></i>
                        </span>
                    </div>
                    
                    <button id="wa-send-btn">
                        <i class="fa fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- Emoji Picker -->
        <div class="wa-emoji-picker" id="wa-emoji-picker">
            <div class="wa-emoji-grid" id="wa-emoji-grid"></div>
        </div>
        
        <!-- Lightbox -->
        <div class="wa-lightbox" id="wa-lightbox">
            <img id="wa-lightbox-img" src="" alt="">
            <div style="position: absolute; top: 20px; right: 20px; color: white; font-size: 30px; cursor: pointer; background: rgba(0,0,0,0.5); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;" onclick="$('#wa-lightbox').fadeOut()">×</div>
        </div>
    `);

    let active_contact = null;
    let active_customer = null;
    let selected_file = null;
    let temp_file_url = null; // Store the local file URL for preview

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

    function init_attachment() {
        $('#wa-attachment-btn').on('click', function() {
            $('#wa-file-input').click();
        });
        
        $('#wa-file-input').on('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            selected_file = file;
            
            // Create a local URL for the file preview
            temp_file_url = URL.createObjectURL(file);
            
            // Show file preview in chat immediately
            show_file_preview(file, temp_file_url, true);
            
            // Auto-send after preview
            setTimeout(() => {
                send_attachment(file);
            }, 1000);
        });
    }
    
    function show_file_preview(file, fileUrl, isTemp = false) {
        const fileType = file.type;
        let previewHtml = '';
        const time = new Date().toTimeString().slice(0,5);
        const tempClass = isTemp ? ' wa-temp-attachment' : '';
        
        if (fileType.startsWith('image/')) {
            previewHtml = `
                <div class="wa-attachment-preview">
                    <img src="${fileUrl}" alt="${file.name}" style="max-width: 200px;" onclick="${!isTemp ? `open_lightbox('${fileUrl}', 'image')` : ''}">
                </div>
            `;
        } else if (fileType.startsWith('video/')) {
            previewHtml = `
                <div class="wa-attachment-preview">
                    <video controls style="max-width: 200px;">
                        <source src="${fileUrl}" type="${fileType}">
                    </video>
                </div>
            `;
        } else if (fileType === 'application/pdf') {
            previewHtml = `
                <div class="wa-attachment-preview">
                    <div class="wa-document-preview">
                        <i class="fa fa-file-pdf-o"></i>
                        <div class="wa-document-info">
                            <div class="wa-document-name">${file.name}</div>
                            <div class="wa-document-size">${formatFileSize(file.size)} • PDF</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            previewHtml = `
                <div class="wa-attachment-preview">
                    <div class="wa-document-preview">
                        <i class="fa fa-file"></i>
                        <div class="wa-document-info">
                            <div class="wa-document-name">${file.name}</div>
                            <div class="wa-document-size">${formatFileSize(file.size)}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        const html = `
            <div class="wa-message outgoing sending-msg${tempClass}">
                <div class="wa-message-text">${isTemp ? 'Sending ' : ''}${file.name}</div>
                ${previewHtml}
                <div class="wa-message-time">
                    ${time}
                    <span class="wa-tick wa-tick-sent">✓</span>
                </div>
            </div>
        `;
        $("#wa-messages-area").append(html);
        scrollToBottom();
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    async function send_attachment(file) {
        if (!active_contact || !file) return;
        
        try {
            // Convert file to base64
            const base64Data = await fileToBase64(file);
            
            frappe.call({
                method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply.send_whatsapp_attachment",
                args: {
                    to_number: active_contact,
                    file_data: base64Data.split(',')[1], // Remove data: prefix
                    filename: file.name,
                    file_type: file.type
                },
                callback(r) {
                    if (r.message?.success) {
                        // Update the sending message to show success
                        $(".sending-msg.wa-temp-attachment").last()
                            .removeClass("sending-msg wa-temp-attachment")
                            .find(".wa-tick").removeClass("wa-tick-sent").addClass("wa-tick-delivered");
                        
                        selected_file = null;
                        $('#wa-file-input').val('');
                        
                        // Clean up the temporary URL
                        if (temp_file_url) {
                            URL.revokeObjectURL(temp_file_url);
                            temp_file_url = null;
                        }
                        
                        // Reload messages after a short delay to get the server-stored file
                        setTimeout(() => {
                            load_messages(active_customer, active_contact);
                        }, 2000);
                        
                        frappe.show_alert({message: "Attachment sent successfully", indicator: 'green'}, 2);
                    } else {
                        frappe.show_alert({message: "Failed to send attachment: " + (r.message?.error || "Unknown error"), indicator: 'red'}, 3);
                        $(".sending-msg.wa-temp-attachment").last().remove();
                    }
                },
                error(err) {
                    frappe.show_alert({message: "Network error while sending attachment", indicator: 'red'}, 3);
                    $(".sending-msg.wa-temp-attachment").last().remove();
                    console.error("Attachment send error:", err);
                }
            });
        } catch (error) {
            frappe.show_alert({message: "Error processing file: " + error.message, indicator: 'red'}, 3);
            $(".sending-msg.wa-temp-attachment").last().remove();
        }
    }

    // Helper function to convert file to base64
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
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
                <div class="wa-message-text">${frappe.utils.escape_html(text).replace(/\n/g,"<br>")}</div>
                <div class="wa-message-time">
                    ${time}
                    <span class="wa-tick wa-tick-sent">✓</span>
                </div>
            </div>`;
        $("#wa-messages-area").append(html);
        scrollToBottom();
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
                        <div class="wa-chat-item" data-contact="${msg.from_number}" data-customer="${msg.customer||''}">
                            <div class="wa-chat-content">
                                <div class="wa-chat-name">${frappe.utils.escape_html(name)}</div>
                                <div class="wa-chat-preview">${frappe.utils.escape_html(preview)||"<i>No message</i>"}</div>
                            </div>
                            <div>
                                <div class="wa-chat-time">${time}</div>
                                ${unread ? `<div style="margin-top:4px;"><span class="wa-unread-badge">${unread}</span></div>` : ''}
                            </div>
                        </div>`;
                });

                $("#wa-chat-list").html(html || "<div class='wa-empty-state'>No conversations yet</div>");

                $(".wa-chat-item").off("click").on("click", function() {
                    $(".wa-chat-item").removeClass("active");
                    $(this).addClass("active");
                    active_contact = $(this).data("contact");
                    active_customer = $(this).data("customer");
                    $("#wa-header-name").text(active_customer || active_contact);
                    load_messages(active_customer, active_contact);
                });
                
                // Search functionality
                $('#wa-search-input').off('input').on('input', function() {
                    const searchTerm = $(this).val().toLowerCase();
                    $('.wa-chat-item').each(function() {
                        const name = $(this).find('.wa-chat-name').text().toLowerCase();
                        const preview = $(this).find('.wa-chat-preview').text().toLowerCase();
                        $(this).toggle(name.includes(searchTerm) || preview.includes(searchTerm));
                    });
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
                let lastDate = null;

                (r.message || []).forEach(msg => {
                    // Check if date changed for separator
                    const msgDate = frappe.datetime.str_to_user(msg.creation).split(' ')[0];
                    if (msgDate !== lastDate) {
                        html += `<div class="wa-date-separator"><span>${msgDate}</span></div>`;
                        lastDate = msgDate;
                    }

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
                        const filename = url.split('/').pop();

                        if (["jpg","jpeg","png","gif","webp"].includes(ext)) {
                            attachment = `
                                <div class="wa-attachment-preview">
                                    <img src="${url}" onclick="open_lightbox('${url}', 'image')" alt="Attachment">
                                </div>`;
                        }
                        else if (ext === "pdf") {
                            attachment = `
                                <div class="wa-attachment-preview">
                                    <div class="wa-document-preview">
                                        <i class="fa fa-file-pdf-o"></i>
                                        <div class="wa-document-info">
                                            <div class="wa-document-name">${filename}</div>
                                            <div class="wa-document-size">PDF Document</div>
                                        </div>
                                        <a href="${url}" target="_blank" style="color:#d32f2f;">
                                            <i class="fa fa-download"></i>
                                        </a>
                                    </div>
                                </div>`;
                        }
                        else if (["mp4","webm","ogg","mov","avi"].includes(ext)) {
                            attachment = `
                                <div class="wa-attachment-preview">
                                    <video controls>
                                        <source src="${url}">
                                        Your browser does not support video.
                                    </video>
                                </div>`;
                        }
                        else {
                            attachment = `
                                <div class="wa-attachment-preview">
                                    <div class="wa-document-preview">
                                        <i class="fa fa-file"></i>
                                        <div class="wa-document-info">
                                            <div class="wa-document-name">${filename}</div>
                                            <div class="wa-document-size">${ext.toUpperCase()} File</div>
                                        </div>
                                        <a href="${url}" target="_blank" style="color:#333;">
                                            <i class="fa fa-download"></i>
                                        </a>
                                    </div>
                                </div>`;
                        }
                    }

                    html += `
                        <div class="wa-message ${isOutgoing?'outgoing':'incoming'}">
                            ${msg.message ? `<div class="wa-message-text">${frappe.utils.escape_html(msg.message).replace(/\n/g,"<br>")}</div>` : ''}
                            ${attachment}
                            <div class="wa-message-time">
                                ${time}
                                ${tick_icon}
                            </div>
                        </div>`;
                });

                $("#wa-messages-area").html(html || "<div class='wa-no-chat'><i class='fa fa-comments fa-3x mb-3' style='color:#ccc;'></i><p>No messages yet. Start the conversation!</p></div>");
                scrollToBottom();

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

    function scrollToBottom() {
        const container = $("#wa-messages-area")[0];
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    window.open_lightbox = function(src, type) {
        const lightbox = $('#wa-lightbox');
        if (type === 'image') {
            $('#wa-lightbox-img').attr('src', src).show();
            $('#wa-lightbox video').hide();
        } else if (type === 'video') {
            $('#wa-lightbox-img').hide();
            // Create video element if not exists
            if (!$('#wa-lightbox video').length) {
                lightbox.append('<video controls autoplay><source src="' + src + '"></video>');
            } else {
                $('#wa-lightbox video source').attr('src', src);
                $('#wa-lightbox video')[0].load();
                $('#wa-lightbox video').show();
            }
        }
        lightbox.fadeIn(200);
    };

    $(document).on("click", "#wa-send-btn", send_message);
    $(document).on("keypress", "#wa-message-input", e => {
        if (e.which === 13 && !e.shiftKey) { 
            e.preventDefault(); 
            send_message(); 
        }
    });

    init_emoji_picker();
    init_attachment();
    load_conversations();
    setInterval(load_conversations, 30000);
};