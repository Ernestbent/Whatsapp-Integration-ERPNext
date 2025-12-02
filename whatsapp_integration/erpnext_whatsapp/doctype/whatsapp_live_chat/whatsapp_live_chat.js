frappe.ui.form.on("Whatsapp Live Chat", {
    refresh(frm) {
        const chat_field = frm.get_field("chat_area");
        if (!chat_field) return;

        //  WhatsApp UI
        chat_field.$wrapper.html(`
            <div id="wp_ui" style="
                height: 100%;
                display: flex;
                flex-direction: column;
                background: #efeae2;
                font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
                position: relative;
            ">
                <!-- Background Pattern -->
                <div style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    opacity: 0.06;
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\" viewBox=\"0 0 100 100\"><path d=\"M25 25 L75 25 L50 75 Z\" fill=\"%23000000\" opacity=\"0.1\"/></svg>');
                    background-repeat: repeat;
                    pointer-events: none;
                "></div>

                <!-- Header -->
                <div style="
                    background: #008069;
                    color: white;
                    padding: 10px 16px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    position: relative;
                    z-index: 10;
                ">
                    <!-- Profile -->
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
                    ">
                        ${(frm.doc.contact_name || frm.doc.contact || 'U').charAt(0).toUpperCase()}
                    </div>

                    <!-- Contact Info -->
                    <div style="flex: 1; min-width: 0;">
                        <div style="
                            font-size: 16px;
                            font-weight: 500;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        ">
                            ${frappe.utils.escape_html(frm.doc.contact_name || frm.doc.contact || 'Unknown')}
                        </div>
                        <div id="online_status" style="
                            font-size: 13px;
                            opacity: 0.9;
                            margin-top: 2px;
                        ">
                            ${frappe.utils.escape_html(frm.doc.contact || '')}
                        </div>
                    </div>

                    <!-- Refresh Button -->
                    <div style="display: flex; gap: 20px; align-items: center;">
                        <button id="refresh_chat" style="
                            background: none;
                            border: none;
                            color: white;
                            cursor: pointer;
                            font-size: 20px;
                            padding: 6px;
                            border-radius: 50%;
                            transition: background 0.2s;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        " title="Refresh messages">
                            🔄
                        </button>
                    </div>
                </div>

                <!-- Messages Container -->
                <div id="messages" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px 8%;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    position: relative;
                    z-index: 1;
                "></div>

                <!-- Typing Indicator -->
                <div id="typing_indicator" style="
                    display: none;
                    padding: 0 8%;
                    margin-bottom: 8px;
                    position: relative;
                    z-index: 1;
                ">
                    <div style="
                        max-width: 70%;
                        padding: 10px 14px;
                        border-radius: 7.5px;
                        background: #ffffff;
                        align-self: flex-start;
                        box-shadow: 0 1px 0.5px rgba(0,0,0,0.13);
                        display: inline-flex;
                        gap: 4px;
                        align-items: center;
                    ">
                        <span class="typing-dot" style="
                            width: 8px;
                            height: 8px;
                            border-radius: 50%;
                            background: #90949c;
                            animation: typing 1.4s infinite;
                        "></span>
                        <span class="typing-dot" style="
                            width: 8px;
                            height: 8px;
                            border-radius: 50%;
                            background: #90949c;
                            animation: typing 1.4s infinite 0.2s;
                        "></span>
                        <span class="typing-dot" style="
                            width: 8px;
                            height: 8px;
                            border-radius: 50%;
                            background: #90949c;
                            animation: typing 1.4s infinite 0.4s;
                        "></span>
                    </div>
                </div>

                <!-- Input Area -->
                <div style="
                    background: #f0f2f5;
                    padding: 10px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    box-shadow: 0 -1px 2px rgba(0,0,0,0.05);
                    position: relative;
                    z-index: 10;
                ">
                    <div style="display: flex; gap: 8px; align-items: flex-end;">
                        <!-- Emoji Button -->
                        <button id="emoji_btn" style="
                            background: none;
                            border: none;
                            color: #54656f;
                            cursor: pointer;
                            font-size: 26px;
                            padding: 6px;
                            border-radius: 50%;
                            transition: background 0.2s;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        " title="Emoji">😊</button>

                        <!-- Message Input -->
                        <div style="
                            flex: 1;
                            background: white;
                            border-radius: 8px;
                            padding: 10px 16px;
                            max-height: 120px;
                            overflow-y: auto;
                        ">
                            <textarea id="msg_input" placeholder="Type a message" style="
                                width: 100%;
                                border: none;
                                outline: none;
                                resize: none;
                                font-size: 15px;
                                font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
                                color: #111b21;
                                line-height: 20px;
                                max-height: 100px;
                            " rows="1"></textarea>
                        </div>

                        <!-- Send Button -->
                        <button id="send_btn" style="
                            background: #008069;
                            border: none;
                            color: white;
                            cursor: pointer;
                            font-size: 24px;
                            padding: 10px;
                            border-radius: 50%;
                            width: 48px;
                            height: 48px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            transition: background 0.2s;
                            flex-shrink: 0;
                        " title="Send">➤</button>
                    </div>

                    <!-- Emoji Picker -->
                    <div id="emoji_picker" style="
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
                    "></div>
                </div>

                <!-- CSS Animations -->
                <style>
                    @keyframes typing {
                        0%, 60%, 100% { transform: translateY(0); opacity: 0.7; }
                        30% { transform: translateY(-10px); opacity: 1; }
                    }

                    #messages::-webkit-scrollbar {
                        width: 6px;
                    }

                    #messages::-webkit-scrollbar-track {
                        background: transparent;
                    }

                    #messages::-webkit-scrollbar-thumb {
                        background: rgba(0,0,0,0.2);
                        border-radius: 3px;
                    }

                    #messages::-webkit-scrollbar-thumb:hover {
                        background: rgba(0,0,0,0.3);
                    }

                    #emoji_btn:hover {
                        background: rgba(0,0,0,0.05);
                    }

                    #refresh_chat:hover {
                        background: rgba(255,255,255,0.1);
                    }

                    #send_btn:hover {
                        background: #06cf9c;
                    }

                    #send_btn:active {
                        transform: scale(0.95);
                    }

                    .message-bubble {
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

                    .emoji-btn {
                        background: none;
                        border: none;
                        font-size: 22px;
                        cursor: pointer;
                        padding: 4px;
                        border-radius: 4px;
                        transition: background 0.2s;
                    }

                    .emoji-btn:hover {
                        background: #f0f2f5;
                    }
                </style>
            </div>
        `);

        const contact_number = frm.doc.contact;

        // Auto-expand textarea
        const textarea = $("#msg_input");
        textarea.on("input", function() {
            this.style.height = "auto";
            this.style.height = Math.min(this.scrollHeight, 100) + "px";
        });

        // WhatsApp ticks (Proper SVG)
        function get_whatsapp_ticks(status) {
            // Debug: log the status to console
            console.log("Message status:", status);
            
            // Convert to lowercase and trim for matching
            const statusLower = (status || '').toString().toLowerCase().trim();
            
            switch(statusLower){
                case "read": 
                    // Blue double checkmarks for read
                    return `<span style="display:inline-flex;align-items:center;margin-left:3px;">
                        <svg viewBox="0 0 16 11" width="16" height="11">
                            <path fill="#53bdeb" d="M11.071.653a.496.496 0 0 0-.7.076L6.207 6.525 5.183 5.41a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493zm4 0a.496.496 0 0 0-.7.076l-4.164 5.796-1.024-1.115a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493z"/>
                        </svg>
                    </span>`;
                case "delivered": 
                    // Gray double checkmarks for delivered
                    return `<span style="display:inline-flex;align-items:center;margin-left:3px;">
                        <svg viewBox="0 0 16 11" width="16" height="11">
                            <path fill="#8696a0" d="M11.071.653a.496.496 0 0 0-.7.076L6.207 6.525 5.183 5.41a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493zm4 0a.496.496 0 0 0-.7.076l-4.164 5.796-1.024-1.115a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493z"/>
                        </svg>
                    </span>`;
                case "sent": 
                    // Gray double checkmarks for sent (message reached WhatsApp servers)
                    return `<span style="display:inline-flex;align-items:center;margin-left:3px;">
                        <svg viewBox="0 0 16 11" width="16" height="11">
                            <path fill="#8696a0" d="M11.071.653a.496.496 0 0 0-.7.076L6.207 6.525 5.183 5.41a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493zm4 0a.496.496 0 0 0-.7.076l-4.164 5.796-1.024-1.115a.495.495 0 0 0-.7.009l-.626.644a.498.498 0 0 0 .009.7l2.023 1.962a.498.498 0 0 0 .7-.009l5.26-6.87a.498.498 0 0 0-.076-.7l-.702-.493z"/>
                        </svg>
                    </span>`;
                case "failed": 
                case "error":
                    // Red error icon for failed
                    return `<span style="display:inline-flex;align-items:center;margin-left:3px;">
                        <svg viewBox="0 0 16 16" width="16" height="16">
                            <path fill="#f44336" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.536 9.122l-1.414 1.414L8 9.414l-2.122 2.122-1.414-1.414L6.586 8 4.464 5.878l1.414-1.414L8 6.586l2.122-2.122 1.414 1.414L9.414 8l2.122 2.122z"/>
                        </svg>
                    </span>`;
                case "pending":
                case "queued":
                    // Clock icon for pending
                    return `<span style="display:inline-flex;align-items:center;margin-left:3px;">
                        <svg viewBox="0 0 16 16" width="12" height="12">
                            <circle cx="8" cy="8" r="6.5" fill="none" stroke="#8696a0" stroke-width="1"/>
                            <path fill="#8696a0" d="M8 4v4.5l3 1.7"/>
                        </svg>
                    </span>`;
                case "received":
                case "incoming":
                    // No tick for incoming messages
                    return '';
                default: 
                    // Default: show double gray tick for any other status
                    console.warn("Unknown message status:", status);
                    return `<span style="display:inline-flex;align-items:center;margin-left:3px;">
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

        // Render media content
        function render_media_content(message){
            const type = message.message_type;
            const file_url = message.custom_document;
            const message_text = message.message;

            if(!file_url){
                return `<div style="white-space:pre-wrap;word-wrap:break-word;">${frappe.utils.escape_html(message_text||'')}</div>`;
            }

            switch(type){
                case 'image':
                    return `<div style="margin-bottom:4px;position:relative;border-radius:8px;overflow:hidden;">
                        <img src="${file_url}" style="max-width:100%;max-height:350px;border-radius:8px;" />
                        ${message_text && !message_text.startsWith('Image:') ? `<div style="margin-top:6px;">${frappe.utils.escape_html(message_text)}</div>` : ''}
                    </div>`;
                
                case 'document':
                    const filename = message_text.replace('Document: ', '').split(' – ')[0];
                    const file_ext = filename.split('.').pop().toUpperCase();
                    return `<a href="${file_url}" target="_blank" style="text-decoration:none;color:inherit;">
                        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(0,0,0,0.04);border-radius:8px;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.08)'" onmouseout="this.style.background='rgba(0,0,0,0.04)'">
                            <div style="min-width:48px;height:48px;background:#008069;color:white;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:10px;font-weight:600;">
                                ${file_ext}
                            </div>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;">
                                    ${frappe.utils.escape_html(filename)}
                                </div>
                                <div style="font-size:12px;color:#667781;margin-top:2px;">
                                    📥 Click to download
                                </div>
                            </div>
                        </div>
                    </a>`;

                case 'video':
                    return `<div style="margin-bottom:4px;border-radius:8px;overflow:hidden;">
                        <video controls style="max-width:100%;max-height:350px;border-radius:8px;display:block;">
                            <source src="${file_url}" type="video/mp4">
                            <source src="${file_url}" type="video/webm">
                        </video>
                        ${message_text && !message_text.startsWith('Video:') ? `<div style="margin-top:6px;">${frappe.utils.escape_html(message_text)}</div>` : ''}
                    </div>`;

                case 'audio':
                    return `<div style="padding:8px;background:rgba(0,0,0,0.04);border-radius:8px;min-width:250px;">
                        <audio controls style="width:100%;height:42px;">
                            <source src="${file_url}" type="audio/ogg">
                            <source src="${file_url}" type="audio/mpeg">
                            <source src="${file_url}" type="audio/mp4">
                        </audio>
                    </div>`;

                default:
                    return `<div style="white-space:pre-wrap;">${frappe.utils.escape_html(message_text||'Unsupported message type')}</div>`;
            }
        }

        // Load messages
        function load_messages(){
            frappe.call({
                method:"frappe.client.get_list",
                args:{
                    doctype:"Whatsapp Message",
                    filters:[["from_number","=",contact_number]],
                    fields:["name","message","custom_status","timestamp","message_status","message_type","custom_document","media_id"],
                    order_by:"creation asc",
                    limit_page_length:500
                },
                callback:function(r){
                    if(!r.message) return;
                    const box=$("#messages").empty();

                    r.message.forEach(m=>{
                        const is_outgoing=m.custom_status==="Outgoing";
                        const ticks=is_outgoing?get_whatsapp_ticks(m.message_status):"";
                        const media_content=render_media_content(m);
                        const formatted_time=format_timestamp(m.timestamp);

                        const html=`
                            <div id="msg_${m.name}" class="message-bubble" style="
                                max-width:65%;
                                padding:6px 7px 8px 9px;
                                border-radius:7.5px;
                                background:${is_outgoing?"#d9fdd3":"#ffffff"};
                                align-self:${is_outgoing?"flex-end":"flex-start"};
                                box-shadow:0 1px 0.5px rgba(0,0,0,0.13);
                                word-wrap:break-word;
                                position:relative;
                                margin-bottom:2px;
                            ">
                                ${media_content}
                                <div class="tick_area" style="
                                    font-size:11px;
                                    color:#667781;
                                    text-align:right;
                                    margin-top:4px;
                                    display:flex;
                                    align-items:center;
                                    gap:4px;
                                    justify-content:flex-end;
                                    min-height:15px;
                                ">
                                    <span>${formatted_time}</span>${ticks}
                                </div>
                            </div>
                        `;
                        box.append(html);
                    });

                    box.scrollTop(box[0].scrollHeight);
                }
            });
        }

        load_messages();

        // Emoji picker
        const emojis=[
            '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
            '😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥',
            '😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','😶‍🌫️','🥴','😵','🤯','🤠','🥳',
            '😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱',
            '😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡',
            '👋','🤚','🖐️','✋','🖖','👌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎',
            '✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','❤️','🧡','💛','💚','💙',
            '💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','🔥','✨','⭐','🌟','💫','💥','🎉','🎊'
        ];

        const emojiPicker=$("#emoji_picker");
        emojis.forEach(e=>{
            emojiPicker.append(`<button class="emoji-btn">${e}</button>`);
        });

        $(document).off("click","#emoji_btn").on("click","#emoji_btn",function(e){
            e.stopPropagation();
            emojiPicker.toggle();
        });

        $(document).off("click",".emoji-btn").on("click",".emoji-btn",function(){
            const emoji=$(this).text();
            const textarea=$("#msg_input");
            const currentVal=textarea.val();
            const cursorPos=textarea[0].selectionStart;
            const newVal=currentVal.substring(0,cursorPos)+emoji+currentVal.substring(cursorPos);
            textarea.val(newVal).focus();
            textarea[0].setSelectionRange(cursorPos+emoji.length,cursorPos+emoji.length);
        });

        $(document).on("click",function(e){
            if(!$(e.target).closest("#emoji_btn,#emoji_picker").length){
                emojiPicker.hide();
            }
        });

        // Send message
        function send_message(){
            const txt=$("#msg_input").val().trim();
            if(!txt) return;

            $("#send_btn").prop("disabled",true).css("opacity","0.6");

            frappe.call({
                method:"whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply.send_whatsapp_reply",
                args:{to_number:contact_number,message_body:txt},
                callback(r){
                    $("#send_btn").prop("disabled",false).css("opacity","1");
                    if(r.message?.success){
                        $("#msg_input").val("").css("height","auto");
                        load_messages();
                    } else {
                        frappe.msgprint({
                            title:"Send Failed",
                            message:r.message?.error||"Please check console for details",
                            indicator:"red"
                        });
                    }
                }
            });
        }

        $(document).off("click","#send_btn").on("click","#send_btn",send_message);
        $(document).off("keydown","#msg_input").on("keydown","#msg_input",function(e){
            if(e.key==="Enter"&&!e.shiftKey){
                e.preventDefault();
                send_message();
            }
        });

        // Refresh button
        $(document).off("click","#refresh_chat").on("click","#refresh_chat",function(){
            $(this).css("transform","rotate(360deg)").css("transition","transform 0.5s");
            setTimeout(()=>$(this).css("transform","rotate(0deg)"),500);
            load_messages();
        });

        // Real-time updates

        frappe.realtime.on("whatsapp_new_message",(data)=>{
            if(data.contact_number===contact_number){
                load_messages();
                frappe.utils.play_sound("message");
            }
        });

        frappe.realtime.on("whatsapp_message_status_changed",(data)=>{
            if(data.contact_number===contact_number){
                const msgDiv=$(`#msg_${data.message_name}`);
                if(msgDiv.length){
                    const tickHtml=get_whatsapp_ticks(data.new_status);
                    const formatted_time=format_timestamp(data.timestamp);
                    msgDiv.find(".tick_area").html(`<span>${formatted_time}</span>${tickHtml}`);
                }
            }
        });

        // // Auto-refresh every 30 seconds
        // clearInterval(frm._interval);
        // frm._interval=setInterval(()=>{
        //     if(!frm.is_dirty()){
        //         load_messages();
        //     }
        // }, 30000);
        
        frm.on_unload=()=>clearInterval(frm._interval);

    } // refresh
});