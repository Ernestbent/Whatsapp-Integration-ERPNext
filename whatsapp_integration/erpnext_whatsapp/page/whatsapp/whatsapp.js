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
                background: #efeae2;
                font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
                border-radius: 12px;
                overflow: hidden;
                margin: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                position: relative;
            }
            
            /* WhatsApp Background Pattern */
            .wa-bg-pattern {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                opacity: 0.06;
                background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M25 25 L75 25 L50 75 Z" fill="%23000000" opacity="0.1"/></svg>');
                background-repeat: repeat;
                pointer-events: none;
            }
            
            .wa-sidebar {
                width: 380px; 
                background: #fff; 
                border-right: 1px solid #ddd; 
                display: flex; 
                flex-direction: column;
                border-radius: 12px 0 0 12px;
                position: relative;
                z-index: 1;
            }
            
            /* WhatsApp Green Header */
            .wa-sidebar-header {
                padding: 20px; 
                background: #008069; 
                color: white; 
                font-weight: 600; 
                font-size: 18px; 
                display: flex; 
                align-items: center; 
                gap: 12px;
                border-radius: 12px 0 0 0;
            }
            
            .wa-sidebar-header i {
                font-size: 28px;
                color: white;
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
                flex: 1; 
                overflow-y: auto;
            }
            
            .wa-chat-item {
                padding: 15px 20px; 
                border-bottom: 1px solid #f0f0f0; 
                cursor: pointer; 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                transition: background 0.2s;
                position: relative;
            }
            
            .wa-chat-item:hover {
                background: #f5f5f5;
            }
            
            .wa-chat-item.active {
                background: #e8f5e9;
            }
            
            .wa-chat-content {
                flex: 1;
                min-width: 0;
            }
            
            .wa-chat-name {
                font-weight: 600; 
                margin-bottom: 4px;
                color: #111b21;
                font-size: 15px;
            }
            
            .wa-chat-preview {
                font-size: 13px; 
                color: #667781; 
                white-space: nowrap; 
                overflow: hidden; 
                text-overflow: ellipsis; 
                max-width: 200px;
            }
            
            .wa-unread-badge {
                background: #25d366; 
                color: white; 
                font-size: 11px; 
                padding: 3px 8px; 
                border-radius: 12px; 
                min-width: 20px; 
                font-weight: 600;
                text-align: center;
            }
            
            .wa-chat-time {
                font-size: 11px; 
                color: #667781;
                white-space: nowrap;
            }
            
            .wa-main-chat {
                flex: 1; 
                display: flex; 
                flex-direction: column; 
                background: #efeae2;
                border-radius: 0 12px 12px 0;
                position: relative;
            }
            
            .wa-chat-header {
                padding: 15px 25px; 
                background: #008069; 
                color: white; 
                font-weight: 600; 
                font-size: 16px; 
                display: flex; 
                align-items: center; 
                gap: 12px; 
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                border-radius: 0 12px 0 0;
                position: relative;
                z-index: 10;
            }
            
            .wa-chat-header i {
                font-size: 20px; 
                color: #25d366;
            }
            
            .wa-messages-area {
                flex: 1; 
                overflow-y: auto; 
                padding: 20px 8%; 
                display: flex; 
                flex-direction: column; 
                gap: 2px;
                position: relative;
                z-index: 1;
            }
            
            /* Date Separator - WhatsApp Style */
            .wa-date-separator {
                text-align: center;
                margin: 20px 0;
                position: relative;
            }
            
            .wa-date-badge {
                display: inline-block;
                background: rgba(0,0,0,0.1);
                color: #667781;
                padding: 5px 15px;
                border-radius: 15px;
                font-size: 12px;
                font-weight: 500;
            }
            
            /* Modern Message Bubbles */
            .wa-message {
                max-width: 65%;
                padding: 6px 7px 8px 9px;
                border-radius: 7.5px;
                box-shadow: 0 1px 0.5px rgba(0,0,0,0.13);
                word-wrap: break-word;
                position: relative;
                margin-bottom: 2px;
                animation: messageSlideIn 0.2s ease-out;
            }
            
            @keyframes messageSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .wa-message.incoming {
                background: #fff; 
                align-self: flex-start; 
                border-radius: 0px 7.5px 7.5px 7.5px;
            }
            
            .wa-message.outgoing {
                background: #d9fdd3; 
                align-self: flex-end; 
                border-radius: 7.5px 0px 7.5px 7.5px;
            }
            
            .wa-message-text {
                margin-bottom: 2px; 
                line-height: 1.5; 
                white-space: pre-wrap;
                font-size: 14px;
                color: #111b21;
            }
            
            .wa-message-time {
                font-size: 11px; 
                color: #667781; 
                text-align: right; 
                display: flex; 
                align-items: center; 
                gap: 4px; 
                margin-top: 4px;
                justify-content: flex-end;
                min-height: 15px;
            }
            
            /* WhatsApp Ticks (Modern Design) */
            .wa-tick {
                display: inline-flex;
                align-items: center;
                margin-left: 3px;
            }
            
            .wa-tick-sent {
                color: #8696a0;
            }
            
            .wa-tick-delivered {
                color: #53bdeb;
            }
            
            .wa-tick-read {
                color: #53bdeb;
            }
            
            .wa-input-area {
                padding: 10px 16px; 
                background: #f0f2f5; 
                display: flex; 
                flex-direction: column;
                gap: 8px;
                box-shadow: 0 -1px 2px rgba(0,0,0,0.05);
                position: relative;
                z-index: 10;
                border-radius: 0 0 12px 0;
            }
            
            .wa-input-wrapper {
                display: flex; 
                gap: 8px; 
                align-items: flex-end;
            }
            
            .wa-attachment-btn {
                cursor: pointer;
                font-size: 20px;
                color: #54656f;
                transition: color 0.2s;
                background: none;
                border: none;
                padding: 6px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .wa-attachment-btn:hover {
                background: rgba(0,0,0,0.05);
            }
            
            .wa-input-box {
                flex: 1;
                background: white;
                border-radius: 8px;
                padding: 10px 16px;
                max-height: 120px;
                overflow-y: auto;
                border: 1px solid #ddd;
            }
            
            #wa-message-input {
                width: 100%;
                border: none;
                outline: none;
                resize: none;
                font-size: 15px;
                font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
                color: #111b21;
                line-height: 20px;
                max-height: 100px;
                background: transparent;
            }
            
            #wa-message-input::placeholder {
                color: #667781;
            }
            
            .wa-emoji-btn {
                cursor: pointer; 
                font-size: 24px; 
                color: #54656f; 
                transition: color 0.2s;
                background: none;
                border: none;
                padding: 6px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .wa-emoji-btn:hover {
                background: rgba(0,0,0,0.05);
            }
            
            #wa-send-btn {
                background: #008069; 
                color: white; 
                border: none; 
                border-radius: 50%; 
                width: 48px; 
                height: 48px; 
                cursor: pointer; 
                transition: background 0.2s; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                flex-shrink: 0;
                font-size: 24px;
            }
            
            #wa-send-btn:hover {
                background: #06cf9c;
            }
            
            #wa-send-btn:disabled {
                opacity: 0.5; 
                cursor: not-allowed;
            }
            
            #wa-send-btn:active {
                transform: scale(0.95);
            }
            
            .wa-no-chat {
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                height: 100%; 
                color: #888;
            }
            
            .sending-msg {
                opacity: 0.7;
            }
            
            /* Media Previews */
            .wa-attachment-preview {
                margin-top: 6px;
                border-radius: 8px;
                overflow: hidden;
            }
            
            .wa-attachment-preview img {
                max-width: 100%;
                max-height: 300px;
                border-radius: 8px;
                cursor: pointer;
                display: block;
            }
            
            .wa-attachment-preview video {
                max-width: 100%;
                max-height: 300px;
                border-radius: 8px;
                background: #000;
                display: block;
            }
            
            .wa-document-preview {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: rgba(0,0,0,0.04);
                border-radius: 8px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .wa-document-preview:hover {
                background: rgba(0,0,0,0.08);
            }
            
            .wa-document-icon {
                min-width: 48px;
                height: 48px;
                background: #008069;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                font-size: 10px;
                font-weight: 600;
            }
            
            .wa-document-info {
                flex: 1;
                min-width: 0;
            }
            
            .wa-document-name {
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 14px;
                color: #111b21;
            }
            
            .wa-document-size {
                font-size: 12px;
                color: #667781;
                margin-top: 2px;
            }
            
            /* Emoji Picker */
            .wa-emoji-picker {
                display: flex;
                flex-wrap: wrap;
                max-height: 200px;
                overflow-y: auto;
                padding: 6px;
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 1px 4px rgba(0,0,0,0.2);
                gap: 4px;
                display: none;
                position: absolute;
                bottom: 85px;
                right: 25px;
                z-index: 100;
                width: 350px;
            }
            
            .wa-emoji-picker.show {
                display: flex;
            }
            
            .wa-emoji-btn-picker {
                background: none;
                border: none;
                font-size: 22px;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: background 0.2s;
            }
            
            .wa-emoji-btn-picker:hover {
                background: #f0f2f5;
            }
            
            /* Scrollbar Styling */
            .wa-messages-area::-webkit-scrollbar,
            .wa-chat-list::-webkit-scrollbar,
            .wa-emoji-picker::-webkit-scrollbar {
                width: 6px;
            }
            
            .wa-messages-area::-webkit-scrollbar-track,
            .wa-chat-list::-webkit-scrollbar-track,
            .wa-emoji-picker::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .wa-messages-area::-webkit-scrollbar-thumb,
            .wa-chat-list::-webkit-scrollbar-thumb,
            .wa-emoji-picker::-webkit-scrollbar-thumb {
                background: rgba(0,0,0,0.2);
                border-radius: 3px;
            }
            
            .wa-messages-area::-webkit-scrollbar-thumb:hover,
            .wa-chat-list::-webkit-scrollbar-thumb:hover,
            .wa-emoji-picker::-webkit-scrollbar-thumb:hover {
                background: rgba(0,0,0,0.3);
            }
            
            /* Typing Indicator */
            .wa-typing-indicator {
                display: none;
                padding: 0 8%;
                margin-bottom: 8px;
            }
            
            .wa-typing-bubble {
                max-width: 70%;
                padding: 10px 14px;
                border-radius: 7.5px;
                background: #ffffff;
                align-self: flex-start;
                box-shadow: 0 1px 0.5px rgba(0,0,0,0.13);
                display: inline-flex;
                gap: 4px;
                align-items: center;
            }
            
            .typing-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #90949c;
                animation: typing 1.4s infinite;
            }
            
            .typing-dot:nth-child(2) { animation-delay: 0.2s; }
            .typing-dot:nth-child(3) { animation-delay: 0.4s; }
            
            @keyframes typing {
                0%, 60%, 100% { transform: translateY(0); opacity: 0.7; }
                30% { transform: translateY(-10px); opacity: 1; }
            }
            
            /* Lightbox */
            .wa-lightbox {
                display: none; 
                position: fixed; 
                top: 0; 
                left: 0; 
                right: 0; 
                bottom: 0; 
                background: rgba(0,0,0,0.95); 
                z-index: 9999; 
                justify-content: center; 
                align-items: center; 
                cursor: pointer;
            }
            
            .wa-lightbox img, 
            .wa-lightbox video {
                max-width: 90%; 
                max-height: 90%; 
                border-radius: 12px;
            }
            
            .wa-lightbox-close {
                position: absolute; 
                top: 20px; 
                right: 20px; 
                color: white; 
                font-size: 30px; 
                cursor: pointer; 
                background: rgba(0,0,0,0.5); 
                width: 40px; 
                height: 40px; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center;
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
            <div class="wa-bg-pattern"></div>
            
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
                    <div style="
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 18px;
                        font-weight: 600;
                        color: white;
                        flex-shrink: 0;
                    " id="wa-profile-avatar">
                        ?
                    </div>
                    <div id="wa-header-name">Select a conversation</div>
                </div>
                
                <!-- Messages Area -->
                <div id="wa-messages-area" class="wa-messages-area">
                    <div class="wa-no-chat">
                        <i class="fa fa-comments fa-3x mb-3" style="color:#ccc;"></i>
                        <p>Select a conversation to start messaging</p>
                    </div>
                </div>
                
                <!-- Typing Indicator -->
                <div id="wa-typing-indicator" class="wa-typing-indicator">
                    <div class="wa-typing-bubble">
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                    </div>
                </div>
                
                <!-- Input Area -->
                <div class="wa-input-area">
                    <input type="file" id="wa-file-input" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt">
                    
                    <div class="wa-input-wrapper">
                        <button class="wa-attachment-btn" id="wa-attachment-btn" title="Attach file">
                            <i class="fa fa-paperclip"></i>
                        </button>
                        
                        <div class="wa-input-box">
                            <textarea id="wa-message-input" placeholder="Type a message" rows="1"></textarea>
                        </div>
                        
                        <button class="wa-emoji-btn" id="wa-emoji-btn" title="Emoji">
                            <i class="fa fa-smile-o"></i>
                        </button>
                        
                        <button id="wa-send-btn">
                            <i class="fa fa-paper-plane"></i>
                        </button>
                    </div>
                    
                    <!-- Emoji Picker -->
                    <div class="wa-emoji-picker" id="wa-emoji-picker"></div>
                </div>
            </div>
        </div>
        
        <!-- Lightbox -->
        <div class="wa-lightbox" id="wa-lightbox">
            <img id="wa-lightbox-img" src="" alt="">
            <div class="wa-lightbox-close" onclick="$('#wa-lightbox').fadeOut()">×</div>
        </div>
    `);

    let active_contact = null;
    let active_customer = null;
    let selected_file = null;
    let temp_file_url = null;
    let customer_name_cache = {};
    let realtime_subscribed = false;
    let user_at_bottom = true;

    // Common emojis from your second example
    const common_emojis = [
        '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
        '😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥',
        '😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','😶‍🌫️','🥴','😵','🤯','🤠','🥳',
        '😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱',
        '😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡',
        '👋','🤚','🖐️','✋','🖖','👌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎',
        '✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','❤️','🧡','💛','💚','💙',
        '💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','🔥','✨','⭐','🌟','💫','💥','🎉','🎊'
    ];

    function get_whatsapp_ticks(status, is_read) {
        // Convert to lowercase and trim for matching
        const statusLower = (status || '').toString().toLowerCase().trim();
        
        if (status === "Incoming") return '';
        
        if (is_read) {
            return `<span class="wa-tick wa-tick-read">
                <svg viewBox="0 0 16 11" width="16" height="11">
                    <path fill="#53bdeb" d="M11.071.653a.496.496 0 0 0-.7.076L6.207 6.525 5.183 5.41a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493zm4 0a.496.496 0 0 0-.7.076l-4.164 5.796-1.024-1.115a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493z"/>
                </svg>
            </span>`;
        } else {
            return `<span class="wa-tick wa-tick-delivered">
                <svg viewBox="0 0 16 11" width="16" height="11">
                    <path fill="#8696a0" d="M11.071.653a.496.496 0 0 0-.7.076L6.207 6.525 5.183 5.41a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493zm4 0a.496.496 0 0 0-.7.076l-4.164 5.796-1.024-1.115a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493z"/>
                </svg>
            </span>`;
        }
    }

    function format_timestamp(timestamp) {
        if (!timestamp) return "";
        const parts = timestamp.split(":");
        if (parts.length < 2) return timestamp;
        let hours = parseInt(parts[0]);
        const minutes = parts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${ampm}`;
    }

    // Format date display like WhatsApp (DD/MM/YYYY)
    function format_date_display(date_str) {
        if (!date_str) return "";
        
        const date = new Date(date_str);
        const now = new Date();
        
        // Format as DD/MM/YYYY (WhatsApp style)
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const year = date.getFullYear();
        
        // Check if it's today
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        
        if (messageDate.getTime() === today.getTime()) {
            return "Today";
        } 
        
        // Check if it's yesterday
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (messageDate.getTime() === yesterday.getTime()) {
            return "Yesterday";
        }
        
        // Otherwise show DD/MM/YYYY
        return `${day}/${month}/${year}`;
    }

    function render_media_content(message) {
        const type = message.message_type;
        const file_url = message.custom_document;
        const message_text = message.message;

        if (!file_url) {
            return `<div style="white-space:pre-wrap;word-wrap:break-word;">${frappe.utils.escape_html(message_text||'')}</div>`;
        }

        switch(type) {
            case 'image':
                return `<div class="wa-attachment-preview">
                    <img src="${file_url}" style="max-width:100%;max-height:350px;" onclick="open_lightbox('${file_url}', 'image')" />
                    ${message_text && !message_text.startsWith('Image:') ? `<div style="margin-top:6px;">${frappe.utils.escape_html(message_text)}</div>` : ''}
                </div>`;
            
            case 'document':
                const filename = message_text ? message_text.replace('Document: ', '').split(' – ')[0] : 'Document';
                const file_ext = filename.split('.').pop().toUpperCase();
                return `<a href="${file_url}" target="_blank" style="text-decoration:none;color:inherit;">
                    <div class="wa-document-preview">
                        <div class="wa-document-icon">
                            ${file_ext}
                        </div>
                        <div class="wa-document-info">
                            <div class="wa-document-name">
                                ${frappe.utils.escape_html(filename)}
                            </div>
                            <div class="wa-document-size">
                                📥 Click to download
                            </div>
                        </div>
                    </div>
                </a>`;

            case 'video':
                return `<div class="wa-attachment-preview">
                    <video controls style="max-width:100%;max-height:350px;">
                        <source src="${file_url}" type="video/mp4">
                        <source src="${file_url}" type="video/webm">
                    </video>
                    ${message_text && !message_text.startsWith('Video:') ? `<div style="margin-top:6px;">${frappe.utils.escape_html(message_text)}</div>` : ''}
                </div>`;

            case 'audio':
                return `<div class="wa-attachment-preview">
                    <audio controls style="width:100%;height:42px;">
                        <source src="${file_url}" type="audio/mpeg">
                    </audio>
                </div>`;

            default:
                return `<div style="white-space:pre-wrap;">${frappe.utils.escape_html(message_text||'Unsupported message type')}</div>`;
        }
    }

    function check_scroll_position() {
        const container = $("#wa-messages-area")[0];
        if (!container) return;
        const threshold = 100;
        user_at_bottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    }

    function init_emoji_picker() {
        const emojiPicker = $('#wa-emoji-picker');
        common_emojis.forEach(emoji => {
            emojiPicker.append(`<button class="wa-emoji-btn-picker">${emoji}</button>`);
        });

        $('#wa-emoji-btn').on('click', function(e) {
            e.stopPropagation();
            emojiPicker.toggleClass('show');
        });

        $(document).on('click', '.wa-emoji-btn-picker', function() {
            const emoji = $(this).text();
            const input = $('#wa-message-input');
            const currentVal = input.val();
            const cursorPos = input[0].selectionStart;
            const newVal = currentVal.substring(0, cursorPos) + emoji + currentVal.substring(cursorPos);
            input.val(newVal).focus();
            input[0].setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
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
                    <img src="${fileUrl}" alt="${file.name}" style="max-width: 200px;">
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
                <a href="${fileUrl}" target="_blank" style="text-decoration:none;color:inherit;">
                    <div class="wa-document-preview">
                        <div class="wa-document-icon">PDF</div>
                        <div class="wa-document-info">
                            <div class="wa-document-name">${file.name}</div>
                            <div class="wa-document-size">${formatFileSize(file.size)} • PDF</div>
                        </div>
                    </div>
                </a>
            `;
        } else {
            const file_ext = file.name.split('.').pop().toUpperCase();
            previewHtml = `
                <a href="${fileUrl}" target="_blank" style="text-decoration:none;color:inherit;">
                    <div class="wa-document-preview">
                        <div class="wa-document-icon">${file_ext}</div>
                        <div class="wa-document-info">
                            <div class="wa-document-name">${file.name}</div>
                            <div class="wa-document-size">${formatFileSize(file.size)}</div>
                        </div>
                    </div>
                </a>
            `;
        }
        
        const html = `
            <div class="wa-message outgoing sending-msg${tempClass}">
                <div class="wa-message-text">${isTemp ? 'Sending ' : ''}${file.name}</div>
                ${previewHtml}
                <div class="wa-message-time">
                    ${format_timestamp(time)}
                    <span class="wa-tick wa-tick-sent">
                        <svg viewBox="0 0 16 11" width="16" height="11">
                            <path fill="#8696a0" d="M11.071.653a.496.496 0 0 0-.7.076L6.207 6.525 5.183 5.41a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493zm4 0a.496.496 0 0 0-.7.076l-4.164 5.796-1.024-1.115a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493z"/>
                        </svg>
                    </span>
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

    function append_local_message(text) {
        const time = new Date().toTimeString().slice(0,5);
        const html = `
            <div class="wa-message outgoing sending-msg">
                <div class="wa-message-text">${frappe.utils.escape_html(text).replace(/\n/g,"<br>")}</div>
                <div class="wa-message-time">
                    ${format_timestamp(time)}
                    <span class="wa-tick wa-tick-sent">
                        <svg viewBox="0 0 16 11" width="16" height="11">
                            <path fill="#8696a0" d="M11.071.653a.496.496 0 0 0-.7.076L6.207 6.525 5.183 5.41a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493zm4 0a.496.496 0 0 0-.7.076l-4.164 5.796-1.024-1.115a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493z"/>
                        </svg>
                    </span>
                </div>
            </div>`;
        $("#wa-messages-area").append(html);
        scrollToBottom();
    }

    function format_phone_display(phone_number) {
        if (!phone_number) return "Unknown";
        const clean = phone_number.replace(/\D/g, '');
        
        if (clean.length === 12 && clean.startsWith('256')) {
            return `+${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6,9)} ${clean.slice(9)}`;
        } else if (clean.length >= 10) {
            const last10 = clean.slice(-10);
            return `+${clean.slice(0,-10)} ${last10.slice(0,3)} ${last10.slice(3,6)} ${last10.slice(6)}`;
        }
        return `+${clean}`;
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
                    const name = msg.customer || format_phone_display(msg.from_number);
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
                    const displayName = active_customer || format_phone_display(active_contact);
                    $("#wa-header-name").text(displayName);
                    
                    // Update profile avatar
                    const avatar = $("#wa-profile-avatar");
                    avatar.text(displayName.charAt(0).toUpperCase());
                    
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
                fields: ["name","message","from_number","creation","custom_status","custom_document","custom_read","message_id","message_type","timestamp"],
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
                    // Get date from creation timestamp
                    const msgDate = frappe.datetime.str_to_user(msg.creation).split(' ')[0]; // YYYY-MM-DD format
                    const displayDate = format_date_display(msg.creation);
                    
                    // Add date separator if date changed
                    if (msgDate !== lastDate) {
                        html += `
                            <div class="wa-date-separator">
                                <span class="wa-date-badge">${displayDate}</span>
                            </div>
                        `;
                        lastDate = msgDate;
                    }

                    if (msg.custom_status === "Incoming" && !msg.custom_read) {
                        unread_ids.push(msg.name);
                        if (msg.message_id) {
                            unread_message_ids.push(msg.message_id);
                        }
                    }

                    const isOutgoing = msg.custom_status !== "Incoming";
                    const time = msg.timestamp ? format_timestamp(msg.timestamp) : frappe.datetime.str_to_user(msg.creation).split(' ')[1].slice(0,5);
                    const tick_icon = get_whatsapp_ticks(msg.custom_status, msg.custom_read);
                    const media_content = render_media_content(msg);

                    html += `
                        <div class="wa-message ${isOutgoing?'outgoing':'incoming'}" data-message-id="${msg.name}">
                            ${media_content}
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
        $("#wa-message-input").css("height", "auto");

        frappe.call({
            method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply.send_whatsapp_reply",
            args: { to_number: active_contact, message_body: text },
            callback(r) {
                $("#wa-send-btn").prop("disabled", false);
                if (r.message?.success) {
                    $(".sending-msg").last().removeClass("sending-msg")
                        .find(".wa-tick").removeClass("wa-tick-sent").addClass("wa-tick-delivered");
                    
                    // Refresh messages to show date separator if needed
                    setTimeout(() => {
                        load_messages(active_customer, active_contact);
                    }, 1000);
                } else {
                    frappe.show_alert({message: "Failed to send message: " + (r.message?.error || "Unknown error"), indicator: 'red'}, 3);
                }
            },
            error() {
                $("#wa-send-btn").prop("disabled", false);
                frappe.show_alert({message: "Network error while sending message", indicator: 'red'}, 3);
            }
        });
    }

    function scrollToBottom() {
        const container = $("#wa-messages-area")[0];
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
        user_at_bottom = true;
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

    // Auto-expand textarea
    const textarea = $("#wa-message-input");
    textarea.on("input", function() {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 100) + "px";
    });

    // Real-time event handling
    function subscribe_realtime() {
        if (realtime_subscribed) return;
        
        frappe.realtime.on('whatsapp_new_message', function(data) {
            console.log('New WhatsApp message received:', data);
            if (data.contact_number === active_contact) {
                load_messages(active_customer, active_contact);
                frappe.utils.play_sound("message");
            }
            load_conversations();
        });

        frappe.realtime.on('whatsapp_message_status_changed', function(data) {
            console.log('Message status changed:', data);
            if (data.contact_number === active_contact) {
                const $message = $(`.wa-message[data-message-id="${data.message_name}"]`);
                if ($message.length) {
                    const $tick = $message.find('.wa-tick');
                    if ($tick.length) {
                        $tick.removeClass('wa-tick-sent wa-tick-delivered wa-tick-read');
                        
                        if (data.new_status === 'delivered') {
                            $tick.addClass('wa-tick-delivered');
                        } else if (data.new_status === 'read') {
                            $tick.addClass('wa-tick-read');
                        }
                    }
                }
            }
        });

        realtime_subscribed = true;
    }

    // Event listeners
    $("#wa-messages-area").on('scroll', check_scroll_position);
    
    $(document).on("click", "#wa-send-btn", send_message);
    $(document).on("keydown", "#wa-message-input", function(e) {
        if (e.key === "Enter" && !e.shiftKey) { 
            e.preventDefault(); 
            send_message(); 
        }
    });

    // Initialize
    init_emoji_picker();
    init_attachment();
    subscribe_realtime();
    load_conversations();
    
    // Auto-refresh conversations every 30 seconds
    setInterval(() => load_conversations(), 30000);
};