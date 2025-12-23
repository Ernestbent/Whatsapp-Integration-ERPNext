frappe.pages['whatsapp'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'WhatsApp Chat',
        single_column: true
    });
    
    page.main.html(`
        <style>
            /* Base styles */
            .wa-container {
                display: flex;
                height: calc(100vh - 120px);
                background: #f0f2f5;
                position: relative;
            }
            /* Sidebar */
            .wa-sidebar {
                width: 380px;
                background: white;
                border-right: 1px solid #e9edef;
                display: flex;
                flex-direction: column;
                transition: transform 0.3s ease;
            }
            .wa-sidebar-header {
                padding: 20px;
                background: #008069;
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .wa-search {
                padding: 12px;
                background: #f0f2f5;
            }
            .wa-search input {
                width: 100%;
                padding: 10px 15px;
                border: none;
                border-radius: 8px;
                background: white;
                font-size: 14px;
            }
            .wa-chat-list {
                flex: 1;
                overflow-y: auto;
            }
            .wa-chat-item {
                padding: 15px;
                border-bottom: 1px solid #f0f2f5;
                cursor: pointer;
                display: flex;
                align-items: center;
                transition: background 0.2s;
            }
            .wa-chat-item:hover {
                background: #f5f6f6;
            }
            .wa-chat-item.active {
                background: #e9edef;
            }
            .wa-avatar {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: #128c7e;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                font-weight: 500;
                flex-shrink: 0;
            }
            .wa-chat-info {
                flex: 1;
                margin-left: 15px;
                min-width: 0;
            }
            .wa-chat-name {
                font-weight: 500;
                margin-bottom: 3px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .wa-chat-preview {
                color: #667781;
                font-size: 13px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .wa-chat-meta {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 5px;
                flex-shrink: 0;
                margin-left: 10px;
            }
            .wa-chat-time {
                font-size: 12px;
                color: #667781;
            }
            .wa-unread-badge {
                background: #25d366;
                color: white;
                border-radius: 12px;
                padding: 2px 7px;
                font-size: 12px;
                font-weight: 500;
                min-width: 20px;
                text-align: center;
            }
            /* Chat area */
            .wa-chat-area {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: #efeae2;
                position: relative;
            }
            .wa-chat-header {
                padding: 15px 20px;
                background: #008069;
                color: white;
                display: flex;
                align-items: center;
                gap: 15px;
                position: sticky;
                top: 0;
                z-index: 100;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .wa-back-btn {
                display: none;
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 5px;
            }
            .wa-messages-area {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 20px;
                background-image: url('data:image/svg+xml;utf8,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="%23efeae2"/></svg>');
            }
            .wa-date-separator {
                text-align: center;
                margin: 20px 0;
            }
            .wa-date-badge {
                display: inline-block;
                background: rgba(255, 255, 255, 0.9);
                padding: 6px 12px;
                border-radius: 8px;
                font-size: 12px;
                color: #54656f;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            }
            .wa-message {
                display: flex;
                margin-bottom: 8px;
                animation: fadeIn 0.3s ease;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .wa-message-content {
                max-width: 65%;
                padding: 8px 12px;
                border-radius: 8px;
                position: relative;
                word-wrap: break-word;
            }
            .wa-message.outgoing {
                justify-content: flex-end;
            }
            .wa-message.outgoing .wa-message-content {
                background: #d9fdd3;
                border-radius: 8px 8px 0 8px;
            }
            .wa-message.incoming .wa-message-content {
                background: white;
                border-radius: 8px 8px 8px 0;
            }
            .wa-message-text {
                margin-bottom: 5px;
                line-height: 1.4;
            }
            .wa-message-footer {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 5px;
                font-size: 11px;
                color: #667781;
                margin-top: 4px;
            }
            .wa-tick {
                width: 16px;
                height: 16px;
            }
            .wa-tick-sent { color: #667781; }
            .wa-tick-delivered { color: #667781; }
            .wa-tick-read { color: #53bdeb; }
            /* Input area */
            .wa-input-area {
                padding: 15px;
                background: #f0f2f5;
                display: flex;
                gap: 10px;
                align-items: flex-end;
                position: sticky;
                bottom: 0;
                z-index: 100;
                box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.05);
            }
            .wa-emoji-btn, .wa-attachment-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #54656f;
                padding: 5px;
            }
            .wa-input-wrapper {
                flex: 1;
                position: relative;
            }
            .wa-message-input {
                width: 100%;
                padding: 10px 15px;
                border: none;
                border-radius: 8px;
                background: white;
                font-size: 15px;
                font-family: inherit;
                resize: none;
                max-height: 100px;
                overflow-y: auto;
            }
            .wa-send-btn {
                background: #008069;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 10px 15px;
                border-radius: 50%;
                width: 48px;
                height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .wa-send-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            /* Emoji picker */
            .wa-emoji-picker {
                position: absolute;
                bottom: 60px;
                left: 10px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                padding: 10px;
                display: none;
                width: 300px;
                max-height: 250px;
                overflow-y: auto;
                z-index: 1000;
            }
            .wa-emoji-picker.show {
                display: block;
            }
            .wa-emoji-btn-picker {
                display: inline-block;
                padding: 5px;
                cursor: pointer;
                font-size: 24px;
                transition: transform 0.2s;
            }
            .wa-emoji-btn-picker:hover {
                transform: scale(1.2);
            }
            /* Media content */
            .wa-media-container {
                max-width: 300px;
                border-radius: 8px;
                overflow: hidden;
            }
            .wa-media-container img,
            .wa-media-container video {
                width: 100%;
                display: block;
                cursor: pointer;
            }
            .wa-media-caption {
                padding: 8px 0;
            }
            /* Lightbox */
            .wa-lightbox {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                z-index: 10000;
                align-items: center;
                justify-content: center;
            }
            .wa-lightbox img,
            .wa-lightbox video {
                max-width: 90%;
                max-height: 90%;
            }
            .wa-lightbox-close {
                position: absolute;
                top: 20px;
                right: 20px;
                color: white;
                font-size: 36px;
                cursor: pointer;
            }
            /* Empty states */
            .wa-empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: #667781;
                text-align: center;
                padding: 20px;
            }
            .wa-empty-state svg {
                width: 200px;
                height: 200px;
                margin-bottom: 20px;
                opacity: 0.3;
            }
            /* Loading */
            .wa-loading {
                text-align: center;
                padding: 20px;
                color: #667781;
                display: none;
            }
            /* Document preview styles */
            .wa-document-preview {
                background: #f0f2f5;
                border-radius: 8px;
                padding: 12px;
                display: flex;
                align-items: center;
                gap: 12px;
                max-width: 300px;
            }
            .wa-doc-icon {
                width: 48px;
                height: 48px;
                background: #008069;
                color: white;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 12px;
                flex-shrink: 0;
            }
            .wa-doc-info {
                flex: 1;
                min-width: 0;
            }
            .wa-doc-name {
                font-weight: 500;
                margin-bottom: 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .wa-doc-meta {
                font-size: 12px;
                color: #667781;
            }
            .wa-download-link {
                color: #008069;
                text-decoration: none;
                cursor: pointer;
                font-weight: 500;
            }
            .wa-download-link:hover {
                text-decoration: underline;
            }
            /* Temp attachment indicator */
            .wa-temp-attachment {
                opacity: 0.7;
            }
            .sending-msg {
                opacity: 0.8;
            }
            /* Responsive breakpoints */
            @media (max-width: 1024px) {
                .wa-sidebar {
                    width: 320px;
                }
                .wa-message-content {
                    max-width: 75%;
                }
            }
            @media (max-width: 768px) {
                .wa-container {
                    height: calc(100vh - 60px);
                }
                .wa-sidebar {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10;
                    transform: translateX(0);
                }
                .wa-sidebar.hidden {
                    transform: translateX(-100%);
                }
                .wa-chat-area {
                    width: 100%;
                }
                .wa-back-btn {
                    display: block;
                }
                .wa-message-content {
                    max-width: 85%;
                }
                .wa-avatar {
                    width: 45px;
                    height: 45px;
                    font-size: 18px;
                }
                .wa-chat-item {
                    padding: 12px 15px;
                }
                .wa-messages-area {
                    padding: 15px;
                }
                .wa-emoji-picker {
                    width: 280px;
                    max-height: 200px;
                }
            }
            @media (max-width: 480px) {
                .wa-sidebar-header {
                    padding: 15px;
                }
                .wa-chat-header {
                    padding: 12px 15px;
                }
                .wa-input-area {
                    padding: 10px;
                    gap: 8px;
                }
                .wa-message-content {
                    max-width: 90%;
                    padding: 7px 10px;
                }
                .wa-emoji-picker {
                    width: calc(100vw - 40px);
                    left: 50%;
                    transform: translateX(-50%);
                }
                .wa-send-btn {
                    width: 42px;
                    height: 42px;
                    font-size: 20px;
                }
                .wa-media-container {
                    max-width: 250px;
                }
            }
            /* Connection status indicator */
            .connection-status {
                position: fixed;
                bottom: 10px;
                right: 10px;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.3s ease;
            }
            .connection-status.connected {
                background: rgba(37, 211, 102, 0.1);
                color: #25d366;
                border: 1px solid rgba(37, 211, 102, 0.3);
            }
            .connection-status.disconnected {
                background: rgba(255, 59, 48, 0.1);
                color: #ff3b30;
                border: 1px solid rgba(255, 59, 48, 0.3);
            }
            .connection-status.connecting {
                background: rgba(255, 204, 0, 0.1);
                color: #ffcc00;
                border: 1px solid rgba(255, 204, 0, 0.3);
            }
            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                display: inline-block;
            }
            .status-dot.connected { background: #25d366; }
            .status-dot.disconnected { background: #ff3b30; }
            .status-dot.connecting { background: #ffcc00; animation: pulse 1.5s infinite; }
            
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
        </style>
        <div class="wa-container">
            <div class="wa-sidebar">
                <div class="wa-sidebar-header">
                    <h3 style="margin: 0;">WhatsApp Chats</h3>
                    <button onclick="location.reload()" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">🔄</button>
                </div>
                <div class="wa-search">
                    <input type="text" id="wa-search-input" placeholder="Search conversations..." />
                </div>
                <div class="wa-chat-list" id="wa-chat-list">
                    <div class="wa-empty-state">
                        <div>Select a conversation to start messaging</div>
                    </div>
                </div>
            </div>
            <div class="wa-chat-area">
                <div class="wa-chat-header">
                    <button class="wa-back-btn" id="wa-back-btn">←</button>
                    <div class="wa-avatar" id="wa-profile-avatar">?</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 500;" id="wa-header-name">Select a conversation</div>
                    </div>
                </div>
                <div class="wa-messages-area" id="wa-messages-area">
                    <div class="wa-empty-state" id="wa-empty-state">
                        <svg viewBox="0 0 303 172" fill="none">
                            <path d="M151.5 0C68.8 0 0 68.8 0 151.5c0 27 7 52.3 19.3 74.2L0 303l78.8-19.3c21.9 12.3 47.2 19.3 74.2 19.3 82.7 0 151.5-68.8 151.5-151.5S234.2 0 151.5 0z" fill="currentColor" opacity="0.1"/>
                        </svg>
                        <div>Select a conversation to start messaging</div>
                    </div>
                    <div class="wa-loading" id="wa-loading">Loading messages...</div>
                </div>
                <div class="wa-input-area">
                    <button class="wa-emoji-btn" id="wa-emoji-btn">😊</button>
                    <button class="wa-attachment-btn" id="wa-attachment-btn">📎</button>
                    <input type="file" id="wa-file-input" style="display: none;" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" />
                    <div class="wa-input-wrapper">
                        <textarea
                            class="wa-message-input"
                            id="wa-message-input"
                            placeholder="Type a message"
                            rows="1"
                        ></textarea>
                        <div class="wa-emoji-picker" id="wa-emoji-picker"></div>
                    </div>
                    <button class="wa-send-btn" id="wa-send-btn">➤</button>
                </div>
            </div>
        </div>
        <div class="wa-lightbox" id="wa-lightbox">
            <span class="wa-lightbox-close" onclick="$('#wa-lightbox').fadeOut(200);">×</span>
            <img id="wa-lightbox-img" src="" alt="" />
        </div>
        <!-- Connection Status Indicator -->
        <div id="connection-status" class="connection-status connecting" style="display: none;">
            <span class="status-dot connecting"></span>
            <span class="status-text">Connecting...</span>
        </div>
    `);
    
    let active_contact = null;
    let active_customer = null;
    let selected_file = null;
    let temp_file_url = null;
    let customer_name_cache = {};
    let realtime_subscribed = false;
    let user_at_bottom = true;
    let message_cache = {};
    let heartbeat_interval = null;
    let reconnect_attempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    let connection_status = 'disconnected';
    
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
    
    // =============== UTILITY FUNCTIONS ===============
    
    function update_connection_status(status, message = '') {
        connection_status = status;
        const $status = $('#connection-status');
        const $dot = $status.find('.status-dot');
        const $text = $status.find('.status-text');
        
        $status.removeClass('connected disconnected connecting').addClass(status);
        $dot.removeClass('connected disconnected connecting').addClass(status);
        
        switch(status) {
            case 'connected':
                $text.text(message || 'Connected');
                $status.fadeIn();
                break;
            case 'disconnected':
                $text.text(message || 'Disconnected');
                $status.fadeIn();
                break;
            case 'connecting':
                $text.text(message || 'Connecting...');
                $status.fadeIn();
                break;
        }
        
        console.log(`Connection status: ${status} - ${message}`);
    }
    
    // WhatsApp tick logic
    function get_whatsapp_ticks(status, is_read, message_status) {
        if (status === "Incoming") return '';
        
        const msg_status = (message_status || '').toLowerCase();
        
        if (msg_status === 'sent' || msg_status === 'accepted') {
            return `<svg class="wa-tick wa-tick-sent" viewBox="0 0 16 15">
                <path fill="currentColor" d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
            </svg>`;
        }
        
        if (msg_status === 'delivered') {
            return `<svg class="wa-tick wa-tick-delivered" viewBox="0 0 16 15">
                <path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
            </svg>`;
        }
        
        if (msg_status === 'read') {
            return `<svg class="wa-tick wa-tick-read" viewBox="0 0 16 15">
                <path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
            </svg>`;
        }
        
        if (is_read) {
            return `<svg class="wa-tick wa-tick-read" viewBox="0 0 16 15">
                <path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
            </svg>`;
        }
        
        return `<svg class="wa-tick wa-tick-sent" viewBox="0 0 16 15">
            <path fill="currentColor" d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
        </svg>`;
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
    
    function format_date_display(date_str) {
        if (!date_str) return "";
        const date = new Date(date_str);
        const now = new Date();
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        if (messageDate.getTime() === today.getTime()) return "Today";
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (messageDate.getTime() === yesterday.getTime()) return "Yesterday";
        return `${day}/${month}/${year}`;
    }
    
    function format_time_ago(date_str) {
        if (!date_str) return "";
        const date = new Date(date_str);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return "now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
        return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
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
    
    function render_media_content(message) {
        const type = message.message_type;
        const file_url = message.custom_document;
        const message_text = message.message;
        
        if (!file_url) {
            return `<div class="wa-message-text">${frappe.utils.escape_html(message_text||'').replace(/\n/g,"<br>")}</div>`;
        }
        
        switch(type) {
            case 'image':
                const safeImageUrl = frappe.utils.escape_html(file_url);
                return `<div class="wa-media-container"><img src="${safeImageUrl}" alt="Image" onload="if(window.scrollAfterLoad) window.scrollAfterLoad()" onclick="open_lightbox('${safeImageUrl}', 'image')" />${message_text && !message_text.startsWith('Image:') ? `<div class="wa-media-caption">${frappe.utils.escape_html(message_text).replace(/\n/g,"<br>")}</div>` : ''}</div>`;
            
            case 'document':
                const filename = message_text ? message_text.replace('Document: ', '').split(' – ')[0] : 'Document';
                const file_ext = filename.split('.').pop().toUpperCase();
                const safeFileUrl = frappe.utils.escape_html(file_url);
                const safeFilename = frappe.utils.escape_html(filename);
                return `<div class="wa-document-preview"><div class="wa-doc-icon">${file_ext}</div><div class="wa-doc-info"><div class="wa-doc-name">${safeFilename}</div><div class="wa-doc-meta"><a href="${safeFileUrl}" target="_blank" download="${safeFilename}" class="wa-download-link">📥 Click to download</a></div></div></div>`;
            
            case 'video':
                const safeVideoUrl = frappe.utils.escape_html(file_url);
                return `<div class="wa-media-container"><video controls onloadeddata="if(window.scrollAfterLoad) window.scrollAfterLoad()" onclick="open_lightbox('${safeVideoUrl}', 'video')"><source src="${safeVideoUrl}" type="video/mp4"></video>${message_text && !message_text.startsWith('Video:') ? `<div class="wa-media-caption">${frappe.utils.escape_html(message_text).replace(/\n/g,"<br>")}</div>` : ''}</div>`;
            
            case 'audio':
                const safeAudioUrl = frappe.utils.escape_html(file_url);
                return `<audio controls src="${safeAudioUrl}" style="max-width: 300px;"></audio>`;
            
            default:
                return `<div class="wa-message-text">${frappe.utils.escape_html(message_text||'Unsupported message type').replace(/\n/g,"<br>")}</div>`;
        }
    }
    
    function check_scroll_position() {
        const container = $("#wa-messages-area")[0];
        if (!container) return;
        const threshold = 100;
        user_at_bottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    }
    
    // =============== CHAT FUNCTIONS ===============
    
    function init_emoji_picker() {
        const emojiPicker = $('#wa-emoji-picker');
        common_emojis.forEach(emoji => {
            emojiPicker.append(`<span class="wa-emoji-btn-picker">${emoji}</span>`);
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
            temp_file_url = URL.createObjectURL(file);
            show_file_preview(file, temp_file_url, true);
            setTimeout(() => send_attachment(file), 1000);
        });
    }
    
    function show_file_preview(file, fileUrl, isTemp) {
        const fileType = file.type;
        let previewHtml = '';
        const time = new Date().toTimeString().slice(0,5);
        const tempClass = isTemp ? ' wa-temp-attachment' : '';
        const safeFileUrl = isTemp ? fileUrl : frappe.utils.escape_html(fileUrl);
        const safeFilename = frappe.utils.escape_html(file.name);
        
        if (fileType.startsWith('image/')) {
            previewHtml = `<div class="wa-media-container"><img src="${safeFileUrl}" alt="Image" onload="scrollToBottomDelayed()" ${isTemp ? '' : 'onclick="open_lightbox(\'' + safeFileUrl + '\', \'image\')"'} /></div>`;
        } else if (fileType.startsWith('video/')) {
            previewHtml = `<div class="wa-media-container"><video controls onloadeddata="scrollToBottomDelayed()" ${isTemp ? '' : 'onclick="open_lightbox(\'' + safeFileUrl + '\', \'video\')"'}><source src="${safeFileUrl}"></video></div>`;
        } else if (fileType === 'application/pdf') {
            const downloadLink = isTemp ? 'javascript:void(0)' : `${safeFileUrl}`;
            const downloadAttr = isTemp ? '' : `download="${safeFilename}"`;
            const targetAttr = isTemp ? '' : 'target="_blank"';
            previewHtml = `<div class="wa-document-preview"><div class="wa-doc-icon">PDF</div><div class="wa-doc-info"><div class="wa-doc-name">${safeFilename}</div><div class="wa-doc-meta">${formatFileSize(file.size)} • PDF • <a href="${downloadLink}" ${targetAttr} ${downloadAttr} class="wa-download-link">Click to download</a></div></div></div>`;
        } else {
            const file_ext = file.name.split('.').pop().toUpperCase();
            const downloadLink = isTemp ? 'javascript:void(0)' : `${safeFileUrl}`;
            const downloadAttr = isTemp ? '' : `download="${safeFilename}"`;
            const targetAttr = isTemp ? '' : 'target="_blank"';
            previewHtml = `<div class="wa-document-preview"><div class="wa-doc-icon">${file_ext}</div><div class="wa-doc-info"><div class="wa-doc-name">${safeFilename}</div><div class="wa-doc-meta">${formatFileSize(file.size)} • <a href="${downloadLink}" ${targetAttr} ${downloadAttr} class="wa-download-link">Click to download</a></div></div></div>`;
        }
        
        const html = `<div class="wa-message outgoing sending-msg${tempClass}"><div class="wa-message-content">${previewHtml}<div class="wa-message-footer"><span>${format_timestamp(time)}</span><svg class="wa-tick wa-tick-sent" viewBox="0 0 16 15"><path fill="currentColor" d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/></svg></div></div></div>`;
        $("#wa-messages-area").append(html);
        scrollToBottomDelayed();
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
            const base64Data = await fileToBase64(file);
            frappe.call({
                method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply.send_whatsapp_attachment",
                args: {
                    to_number: active_contact,
                    file_data: base64Data.split(',')[1],
                    filename: file.name,
                    file_type: file.type
                },
                callback(r) {
                    if (r.message?.success) {
                        $(".sending-msg.wa-temp-attachment").last().removeClass("sending-msg wa-temp-attachment").find(".wa-tick").removeClass("wa-tick-sent").addClass("wa-tick-delivered");
                        selected_file = null;
                        $('#wa-file-input').val('');
                        if (temp_file_url) {
                            URL.revokeObjectURL(temp_file_url);
                            temp_file_url = null;
                        }
                        frappe.show_alert({message: "Attachment sent successfully", indicator: 'green'}, 2);
                    } else {
                        frappe.show_alert({message: "Failed to send attachment", indicator: 'red'}, 3);
                        $(".sending-msg.wa-temp-attachment").last().remove();
                    }
                },
                error(err) {
                    frappe.show_alert({message: "Network error", indicator: 'red'}, 3);
                    $(".sending-msg.wa-temp-attachment").last().remove();
                }
            });
        } catch (error) {
            frappe.show_alert({message: "Error processing file", indicator: 'red'}, 3);
            $(".sending-msg.wa-temp-attachment").last().remove();
        }
    }
    
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
        const html = `<div class="wa-message outgoing sending-msg"><div class="wa-message-content"><div class="wa-message-text">${frappe.utils.escape_html(text).replace(/\n/g,"<br>")}</div><div class="wa-message-footer"><span>${format_timestamp(time)}</span><svg class="wa-tick wa-tick-sent" viewBox="0 0 16 15"><path fill="currentColor" d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/></svg></div></div></div>`;
        $("#wa-messages-area").append(html);
        scrollToBottomDelayed();
    }
    
    function load_conversations() {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Whatsapp Message",
                fields: ["name","customer","from_number","message","creation","custom_status","custom_read","message_status"],
                filters: [["message","!=", ""]],
                order_by: "creation desc",
                limit_page_length: 500
            },
            callback(r) {
                if (!r.message) return;
                const convMap = {}, unreadMap = {};
                const phoneNumbers = new Set();
                
                r.message.forEach(msg => {
                    const key = msg.from_number;
                    phoneNumbers.add(key);
                    
                    if (!convMap[key] || new Date(msg.creation) > new Date(convMap[key].creation)) {
                        convMap[key] = msg;
                    }
                    
                    if (msg.custom_status === "Incoming" && !msg.custom_read) {
                        unreadMap[key] = (unreadMap[key] || 0) + 1;
                    }
                });
                
                frappe.call({
                    method: "frappe.client.get_list",
                    args: {
                        doctype: "Whatsapp Message",
                        fields: ["from_number", "customer"],
                        filters: [["customer", "!=", ""], ["from_number", "in", Array.from(phoneNumbers)]],
                        order_by: "creation desc",
                        group_by: "from_number"
                    },
                    callback(customerResult) {
                        const customerMap = {};
                        (customerResult.message || []).forEach(item => {
                            if (item.customer && item.from_number) {
                                customerMap[item.from_number] = item.customer;
                            }
                        });
                        
                        let html = "";
                        Object.keys(convMap).forEach(key => {
                            const msg = convMap[key];
                            const displayName = customerMap[key] || format_phone_display(msg.from_number);
                            const preview = (msg.message||"").substring(0,45)+(msg.message.length>45?"...":"");
                            const unread = unreadMap[key] || 0;
                            const time = format_time_ago(msg.creation);
                            const tickHtml = msg.custom_status !== "Incoming" ? get_whatsapp_ticks(msg.custom_status, msg.custom_read, msg.message_status) : '';
                            
                            html += `<div class="wa-chat-item" data-contact="${frappe.utils.escape_html(msg.from_number)}">
                                        <div class="wa-avatar">${frappe.utils.escape_html(displayName).charAt(0).toUpperCase()}</div>
                                        <div class="wa-chat-info">
                                            <div class="wa-chat-name">${frappe.utils.escape_html(displayName)}</div>
                                            <div class="wa-chat-preview">${tickHtml}${frappe.utils.escape_html(preview)||"No message"}</div>
                                        </div>
                                        <div class="wa-chat-meta">
                                            <div class="wa-chat-time">${time}</div>
                                            ${unread ? `<div class="wa-unread-badge">${unread}</div>` : ''}
                                        </div>
                                    </div>`;
                        });
                        
                        $("#wa-chat-list").html(html || "<div class='wa-empty-state'><div>No conversations yet</div></div>");
                        
                        $(".wa-chat-item").off("click").on("click", function() {
                            $(".wa-chat-item").removeClass("active");
                            $(this).addClass("active");
                            
                            active_contact = $(this).data("contact");
                            active_customer = $(this).find('.wa-chat-name').text();
                            
                            $("#wa-header-name").text(active_customer);
                            $("#wa-profile-avatar").text(active_customer.charAt(0).toUpperCase());
                            
                            if ($(window).width() <= 768) {
                                $('.wa-sidebar').addClass('hidden');
                            }
                            
                            show_cached_messages(active_contact);
                            load_messages(active_contact, true);
                        });
                        
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
        });
    }
    
    window.scrollAfterLoad = function() {
        scrollToBottomDelayed();
    };
    
    window.scrollToBottomDelayed = function() {
        scrollToBottom(true);
        setTimeout(() => scrollToBottom(true), 100);
        setTimeout(() => scrollToBottom(true), 300);
        setTimeout(() => scrollToBottom(true), 500);
    };
    
    function show_cached_messages(contact_number) {
        $("#wa-empty-state").hide();
        $("#wa-loading").hide();
        
        if (message_cache[contact_number]) {
            $("#wa-messages-area").html(message_cache[contact_number]);
            scrollToBottomDelayed();
        } else {
            $("#wa-messages-area").html('');
        }
    }
    
    function load_messages(contact_number, forceRefresh = false) {
        const cacheKey = contact_number;
        
        if (!message_cache[cacheKey] || forceRefresh) {
            $("#wa-loading").show();
        }
        
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Whatsapp Message",
                fields: ["name","message","from_number","creation","custom_status","custom_document","custom_read","message_id","message_type","timestamp","message_status","customer"],
                filters: [["from_number", "=", contact_number]],
                order_by: "creation asc",
                limit_page_length: 1000
            },
            callback(r) {
                $("#wa-loading").hide();
                
                if (!r.message) {
                    if (!message_cache[cacheKey]) {
                        $("#wa-empty-state").show();
                    }
                    return;
                }
                
                let html = "";
                const unread_ids = [];
                const unread_message_ids = [];
                let lastDate = null;
                
                const sortedMessages = (r.message || []).sort((a, b) => new Date(a.creation) - new Date(b.creation));
                
                sortedMessages.forEach(msg => {
                    const msgDate = frappe.datetime.str_to_user(msg.creation).split(' ')[0];
                    const displayDate = format_date_display(msg.creation);
                    
                    if (msgDate !== lastDate) {
                        html += `<div class="wa-date-separator"><span class="wa-date-badge">${displayDate}</span></div>`;
                        lastDate = msgDate;
                    }
                    
                    if (msg.custom_status === "Incoming" && !msg.custom_read) {
                        unread_ids.push(msg.name);
                        if (msg.message_id) unread_message_ids.push(msg.message_id);
                    }
                    
                    const isOutgoing = msg.custom_status !== "Incoming";
                    const time = msg.timestamp ? format_timestamp(msg.timestamp) : frappe.datetime.str_to_user(msg.creation).split(' ')[1].slice(0,5);
                    const tick_icon = get_whatsapp_ticks(msg.custom_status, msg.custom_read, msg.message_status);
                    const media_content = render_media_content(msg);
                    
                    html += `<div class="wa-message ${isOutgoing ? 'outgoing' : 'incoming'}" data-message-id="${msg.name}" data-message-status="${msg.message_status||''}">
                                <div class="wa-message-content">
                                    ${media_content}
                                    <div class="wa-message-footer">
                                        <span>${time}</span>${tick_icon}
                                    </div>
                                </div>
                            </div>`;
                });
                
                message_cache[cacheKey] = html;
                
                if (active_contact === contact_number) {
                    if (html) {
                        $("#wa-empty-state").hide();
                        $("#wa-messages-area").html(html);
                        scrollToBottomDelayed();
                    } else {
                        $("#wa-empty-state").show();
                    }
                }
                
                if (unread_ids.length) {
                    Promise.all(unread_ids.map(id => 
                        frappe.call({
                            method: "frappe.client.set_value", 
                            args: {
                                doctype: "Whatsapp Message", 
                                name: id, 
                                fieldname: "custom_read", 
                                value: 1
                            }
                        })
                    )).then(() => load_conversations());
                }
                
                if (unread_message_ids.length) {
                    unread_message_ids.forEach(message_id => {
                        frappe.call({
                            method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.read_receipts.mark_whatsapp_message_read", 
                            args: {message_id: message_id}
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
        $("#wa-message-input").val("").css("height", "auto");
        $("#wa-send-btn").prop("disabled", true);
        
        frappe.call({
            method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply.send_whatsapp_reply",
            args: {to_number: active_contact, message_body: text},
            callback(r) {
                $("#wa-send-btn").prop("disabled", false);
                if (r.message?.success) {
                    $(".sending-msg").last().removeClass("sending-msg").find(".wa-tick").removeClass("wa-tick-sent").addClass("wa-tick-delivered");
                } else {
                    frappe.show_alert({message: "Failed to send", indicator: 'red'}, 3);
                }
            },
            error() {
                $("#wa-send-btn").prop("disabled", false);
                frappe.show_alert({message: "Network error", indicator: 'red'}, 3);
            }
        });
    }
    
    function scrollToBottom(force = false) {
        const container = $("#wa-messages-area")[0];
        if (container) {
            if (force) {
                container.scrollTop = container.scrollHeight;
                user_at_bottom = true;
            } else {
                if (user_at_bottom) {
                    container.scrollTop = container.scrollHeight;
                }
            }
        }
    }
    
    window.open_lightbox = function(src, type) {
        const lightbox = $('#wa-lightbox');
        if (type === 'image') {
            $('#wa-lightbox-img').attr('src', src).show();
            $('#wa-lightbox video').hide();
        } else if (type === 'video') {
            $('#wa-lightbox-img').hide();
            if (!$('#wa-lightbox video').length) {
                lightbox.append('<video controls autoplay><source src="' + src + '" type="video/mp4"></video>');
            } else {
                $('#wa-lightbox video').show();
                $('#wa-lightbox video source').attr('src', src);
                $('#wa-lightbox video')[0].load();
            }
        }
        lightbox.fadeIn(200);
    };
    
    $(document).on('click', '.wa-lightbox', function(e) {
        if (e.target === this || $(e.target).hasClass('wa-lightbox-close')) {
            $('#wa-lightbox').fadeOut(200);
            $('#wa-lightbox video').remove();
        }
    });
    
    $('#wa-back-btn').on('click', function() {
        $('.wa-sidebar').removeClass('hidden');
        active_contact = null;
        active_customer = null;
        $("#wa-header-name").text("Select a conversation");
        $("#wa-profile-avatar").text("?");
        $("#wa-empty-state").show();
        $("#wa-loading").hide();
        $("#wa-messages-area").html('');
    });
    
    const textarea = $("#wa-message-input");
    textarea.on("input", function() {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 100) + "px";
    });
    
    // =============== REAL-TIME HANDLING ===============
    
    // Initialize real-time with proper connection management
    function init_realtime() {
        console.log('🚀 Initializing real-time system...');
        update_connection_status('connecting', 'Connecting to real-time server...');
        
        // Check if we're already connected
        if (frappe.realtime.socket && frappe.realtime.socket.connected) {
            console.log('✅ Already connected to real-time');
            update_connection_status('connected', 'Connected to real-time');
            setup_realtime_listeners();
            return;
        }
        
        // Initialize real-time connection
        try {
            frappe.realtime.init();
            
            // Give it a moment to connect, then setup listeners
            setTimeout(() => {
                if (frappe.realtime.socket && frappe.realtime.socket.connected) {
                    console.log('✅ Real-time connection established');
                    update_connection_status('connected', 'Real-time connected');
                    setup_realtime_listeners();
                } else {
                    console.warn('⚠️ Real-time connection not established, retrying...');
                    update_connection_status('connecting', 'Retrying connection...');
                    setTimeout(init_realtime, 2000);
                }
            }, 1000);
            
        } catch (error) {
            console.error('❌ Failed to initialize real-time:', error);
            update_connection_status('disconnected', 'Failed to connect');
            
            // Fallback to polling mode
            console.log('Falling back to polling mode...');
            setup_polling_fallback();
        }
    }
    
    // Setup real-time event listeners
    function setup_realtime_listeners() {
        console.log('Setting up real-time listeners...');
        
        // Clear existing listeners to prevent duplicates
        frappe.realtime.off('whatsapp_new_message');
        frappe.realtime.off('whatsapp_message_status_changed');
        frappe.realtime.off('doc_update');
        
        // 1. New message event (both incoming and outgoing)
        frappe.realtime.on('whatsapp_new_message', function(data) {
            console.log('🔔 whatsapp_new_message received:', data);
            
            if (!data || !data.contact_number) {
                console.warn('Invalid message event data:', data);
                return;
            }
            
            const contact = data.contact_number;
            const isActiveContact = (active_contact === contact);
            const isIncoming = data.message_type === 'incoming';
            
            console.log(`Message event for: ${contact}, Active: ${isActiveContact}, Type: ${data.message_type}`);
            
            // Debounced refresh of conversation list
            debounced_refresh_conversations();
            
            // If this is the active conversation, refresh messages
            if (isActiveContact) {
                console.log('Refreshing active conversation messages...');
                
                // Play sound for incoming messages
                if (isIncoming && frappe.utils.play_sound) {
                    try {
                        frappe.utils.play_sound("message");
                    } catch(e) {
                        console.log('Sound play failed:', e);
                    }
                }
                
                // Load messages with a slight delay to ensure server has saved
                setTimeout(() => {
                    load_messages(contact, true);
                }, 300);
            }
        });
        
        // 2. Message status updates
        frappe.realtime.on('whatsapp_message_status_changed', function(data) {
            console.log('📊 whatsapp_message_status_changed received:', data);
            
            if (data && data.message_name && data.new_status) {
                // Update the specific message tick immediately
                update_message_tick(data.message_name, data.new_status);
                
                // Also refresh conversation list to update preview ticks
                debounced_refresh_conversations();
            }
        });
        
        // 3. Connection monitoring
        frappe.realtime.on('connected', function() {
            console.log('✅ Real-time WebSocket connected');
            update_connection_status('connected', 'Real-time connected');
            reconnect_attempts = 0; // Reset reconnect attempts
            
            // Ensure listeners are setup
            setup_realtime_listeners();
        });
        
        frappe.realtime.on('disconnected', function() {
            console.log('❌ Real-time WebSocket disconnected');
            update_connection_status('disconnected', 'Real-time disconnected');
            
            // Try to reconnect with exponential backoff
            reconnect_attempts++;
            if (reconnect_attempts <= MAX_RECONNECT_ATTEMPTS) {
                const delay = Math.min(1000 * Math.pow(2, reconnect_attempts), 10000);
                console.log(`Reconnecting attempt ${reconnect_attempts} in ${delay}ms...`);
                update_connection_status('connecting', `Reconnecting (${reconnect_attempts}/${MAX_RECONNECT_ATTEMPTS})...`);
                
                setTimeout(() => {
                    console.log('Attempting to reconnect...');
                    frappe.realtime.init();
                }, delay);
            } else {
                console.error('Max reconnect attempts reached, falling back to polling');
                update_connection_status('disconnected', 'Using polling mode');
                frappe.show_alert({message: 'Real-time disconnected, using polling for updates', indicator: 'orange'}, 5);
            }
        });
        
        console.log('✅ Real-time listeners setup complete');
    }
    
    // Helper function to update individual message tick
    function update_message_tick(message_name, new_status) {
        const $message = $(`.wa-message[data-message-id="${message_name}"]`);
        
        if ($message.length && $message.hasClass('outgoing')) {
            const $footer = $message.find('.wa-message-footer');
            
            if ($footer.length) {
                // Preserve the time
                const timeText = $footer.find('span').first().text();
                
                // Generate new tick HTML
                const newTickHtml = get_whatsapp_ticks('Outgoing', false, new_status);
                
                // Update footer
                $footer.html(`<span>${timeText}</span>${newTickHtml}`);
                
                // Update data attribute
                $message.attr('data-message-status', new_status);
                
                console.log(`✅ Tick updated for ${message_name} to ${new_status}`);
            }
        }
    }
    
    // Heartbeat to keep connection alive
    function start_heartbeat() {
        if (heartbeat_interval) clearInterval(heartbeat_interval);
        
        heartbeat_interval = setInterval(() => {
            // Send heartbeat to keep connection alive
            if (frappe.realtime.socket && frappe.realtime.socket.connected) {
                frappe.realtime.socket.emit('heartbeat', {timestamp: Date.now()});
            } else if (connection_status !== 'connecting') {
                // If not connected and not already trying to connect, try to reconnect
                console.log('Heartbeat: Connection lost, attempting to reconnect...');
                init_realtime();
            }
        }, 25000); // Every 25 seconds
        
        console.log('💓 Heartbeat started');
    }
    
    // Debounced refresh for conversations
    let refresh_conversations_timeout;
    function debounced_refresh_conversations() {
        clearTimeout(refresh_conversations_timeout);
        refresh_conversations_timeout = setTimeout(() => {
            load_conversations();
        }, 300);
    }
    
    // Setup polling as fallback (runs alongside real-time)
    function setup_polling_fallback() {
        console.log('Setting up polling fallback...');
        
        // Poll for updates every 10 seconds
        setInterval(() => {
            // Only poll if we have active contact or need updates
            if (!active_contact && connection_status === 'connected') return;
            
            // Check for new messages using a simple timestamp check
            const lastCheck = new Date(Date.now() - 15000).toISOString();
            
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Whatsapp Message",
                    fields: ["name", "creation", "from_number", "custom_status", "message_status"],
                    filters: [
                        ["creation", ">", lastCheck],
                        ["from_number", "=", active_contact || ""]
                    ],
                    limit: 10
                },
                callback(r) {
                    if (r.message && r.message.length > 0) {
                        console.log(`Polling: Found ${r.message.length} new/updated messages`);
                        
                        // Check if any are new messages for active contact
                        const newMessages = r.message.filter(msg => 
                            msg.creation > lastCheck && 
                            msg.from_number === active_contact
                        );
                        
                        if (newMessages.length > 0 && active_contact) {
                            console.log(`Polling: ${newMessages.length} new messages for active contact`);
                            load_messages(active_contact, true);
                        }
                        
                        // Always refresh conversation list
                        load_conversations();
                        
                        // Check for status updates
                        const statusUpdates = r.message.filter(msg => 
                            msg.message_status && 
                            msg.custom_status === 'Outgoing'
                        );
                        
                        statusUpdates.forEach(msg => {
                            if (msg.message_status) {
                                update_message_tick(msg.name, msg.message_status);
                            }
                        });
                    }
                }
            });
        }, 10000); // Every 10 seconds
    }
    
    // Initialize event listeners
    function setup_event_listeners() {
        $("#wa-messages-area").on('scroll', check_scroll_position);
        
        $(document).on("click", "#wa-send-btn", send_message);
        
        $(document).on("keydown", "#wa-message-input", function(e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send_message();
            }
        });
        
        // Mobile sidebar handling
        $(document).on('click', function(e) {
            if ($(window).width() <= 768) {
                if (!$('.wa-sidebar').hasClass('hidden')) {
                    if (!$(e.target).closest('.wa-sidebar').length && !$(e.target).is('#wa-back-btn')) {
                        $('.wa-sidebar').addClass('hidden');
                    }
                }
            }
        });
        
        // Enable send button when there's text
        $("#wa-message-input").on('input', function() {
            const hasText = $(this).val().trim().length > 0;
            $("#wa-send-btn").prop('disabled', !hasText);
        });
        
        // Connection status indicator click to reconnect
        $('#connection-status').on('click', function() {
            if (connection_status === 'disconnected') {
                console.log('Manual reconnection requested...');
                update_connection_status('connecting', 'Manual reconnection...');
                init_realtime();
            }
        });
    }
    
    // Initialize everything
    function initialize() {
        console.log('🚀 Initializing WhatsApp chat...');
        
        init_emoji_picker();
        init_attachment();
        setup_event_listeners();
        
        // Load initial data
        load_conversations();
        
        // Initialize real-time system
        setTimeout(() => {
            init_realtime();
        }, 1000);
        
        // Setup polling as backup (always runs)
        setup_polling_fallback();
        
        // Start heartbeat
        start_heartbeat();
        
        // Initial scroll
        setTimeout(() => scrollToBottom(true), 100);
        
        console.log('✅ WhatsApp chat fully initialized');
    }
    
    // Start initialization
    initialize();
};