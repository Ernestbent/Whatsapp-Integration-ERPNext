// wa.input — emoji picker, attachment upload, and sending a text message
frappe.provide("wa.input");

wa.input.common_emojis = [
    "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙",
    "😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥",
    "😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","😶‍🌫️","🥴","😵","🤯","🤠","🥳",
    "😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱",
    "😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡",
    "👋","🤚","🖐️","✋","🖖","👌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎",
    "✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","❤️","🧡","💛","💚","💙",
    "💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","🔥","✨","⭐","🌟","💫","💥","🎉","🎊"
];

// Fills the emoji panel and wires the toggle, pick, and click-outside-to-close behavior
wa.input.init_emoji_picker = function () {
    const emojiPicker = $("#wa-emoji-picker");
    wa.input.common_emojis.forEach((emoji) => {
        emojiPicker.append(`<span class="wa-emoji-btn-picker">${emoji}</span>`);
    });

    $("#wa-emoji-btn").on("click", function (e) {
        e.stopPropagation();
        emojiPicker.toggleClass("show");
    });

    $(document).on("click", ".wa-emoji-btn-picker", function () {
        const emoji = $(this).text();
        const input = $("#wa-message-input");
        const currentVal = input.val();
        const cursorPos = input[0].selectionStart;
        const newVal = currentVal.substring(0, cursorPos) + emoji + currentVal.substring(cursorPos);
        input.val(newVal).focus();
        input[0].setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    });

    $(document).on("click", function (e) {
        if (!$(e.target).closest(".wa-emoji-picker, .wa-emoji-btn").length) {
            $("#wa-emoji-picker").removeClass("show");
        }
    });
};

// Wires the paperclip button to the hidden file input and kicks off the send on pick
wa.input.init_attachment = function () {
    $("#wa-attachment-btn").on("click", function () {
        $("#wa-file-input").click();
    });

    $("#wa-file-input").on("change", function (e) {
        const file = e.target.files[0];
        if (!file) return;
        wa.state.selected_file = file;
        wa.state.temp_file_url = URL.createObjectURL(file);
        setTimeout(() => wa.input.send_attachment(file), 1000);
    });
};

// Appends a placeholder bubble for the file while it is still uploading
wa.input.show_file_preview = function (file, fileUrl, isTemp) {
    const fileType = file.type;
    let previewHtml = "";
    const time = new Date().toTimeString().slice(0, 5);
    const tempClass = isTemp ? " wa-temp-attachment" : "";
    const tempId = isTemp ? `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : "";
    const safeFileUrl = isTemp ? fileUrl : frappe.utils.escape_html(fileUrl);
    const safeFilename = frappe.utils.escape_html(file.name);
    const safeFileType = frappe.utils.escape_html(fileType || "document");
    const createdAt = new Date().toISOString();

    if (fileType.startsWith("image/")) {
        previewHtml = `<div class="wa-media-container"><img src="${safeFileUrl}" alt="Image" onload="scrollToBottomDelayed()" ${
            isTemp ? "" : "onclick=\"open_lightbox('" + safeFileUrl + "', 'image')\""
        } /></div>`;
    } else if (fileType.startsWith("video/")) {
        previewHtml = `<div class="wa-media-container"><video controls onloadeddata="scrollToBottomDelayed()" ${
            isTemp ? "" : "onclick=\"open_lightbox('" + safeFileUrl + "', 'video')\""
        }><source src="${safeFileUrl}"></video></div>`;
    } else if (fileType.startsWith("audio/")) {
        previewHtml =
            wa.audio && typeof wa.audio.render === "function"
                ? wa.audio.render(fileUrl)
                : `<audio controls preload="metadata" src="${safeFileUrl}"></audio>`;
    } else {
        const documentUrl = fileUrl;
        previewHtml =
            wa.documents && typeof wa.documents.render === "function"
                ? wa.documents.render(documentUrl, file.name, file.size)
                : wa.utils.render_message_text(file.name || "Document");
    }

    const html = `<div class="wa-message outgoing sending-msg${tempClass}" data-temp-id="${tempId}" data-message-type="${safeFileType}" data-file-url="${safeFilename}" data-creation="${createdAt}"><div class="wa-message-content">${previewHtml}<div class="wa-message-footer"><span>${wa.utils.format_timestamp(
        time
    )}</span>${wa.utils.get_pending_tick()}</div></div></div>`;
    $("#wa-messages-area").append(html);
    wa.messages.hydrate_components();
    window.scrollToBottomDelayed();
    return tempId;
};

// Base64-encodes a file for the frappe.call payload
wa.input.fileToBase64 = function (file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

// Uploads the picked file, shows the pending bubble, then finalizes or marks it failed
wa.input.send_attachment = async function (file) {
    if (!wa.state.active_contact || !file) return;

    const pendingTempId = wa.input.show_file_preview(file, wa.state.temp_file_url, true);
    const attachmentPreview = file.name || "Attachment";
    wa.sidebar.update_sidebar_conversation({
        contact_number: wa.state.active_contact,
        customer: wa.state.active_customer,
        message_text: attachmentPreview,
        message_type: file.type || "document",
        file_url: file.name,
        message_status: "pending",
        custom_status: "Outgoing",
        unread: 0,
        timestamp: new Date().toISOString()
    });

    try {
        const base64Data = await wa.input.fileToBase64(file);
        frappe.call({
            method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply.send_whatsapp_attachment",
            args: {
                to_number: wa.state.active_contact,
                file_data: base64Data.split(",")[1],
                filename: file.name,
                file_type: file.type
            },
            callback(r) {
                if (r.message?.success) {
                    wa.messages.finalize_pending_message(pendingTempId, r.message.doc_name, r.message.message_id, "pending");
                    wa.state.selected_file = null;
                    $("#wa-file-input").val("");
                    if (wa.state.temp_file_url) {
                        URL.revokeObjectURL(wa.state.temp_file_url);
                        wa.state.temp_file_url = null;
                    }
                    frappe.show_alert({ message: "Attachment sent successfully", indicator: "green" }, 2);
                } else {
                    frappe.show_alert({ message: "Failed to send attachment", indicator: "red" }, 3);
                    wa.messages.mark_pending_message_failed(pendingTempId);
                    wa.sidebar.update_sidebar_conversation({
                        contact_number: wa.state.active_contact,
                        customer: wa.state.active_customer,
                        message_text: attachmentPreview,
                        message_type: file.type || "document",
                        file_url: file.name,
                        message_status: "failed",
                        custom_status: "Outgoing",
                        unread: 0,
                        timestamp: new Date().toISOString()
                    });
                }
            },
            error() {
                frappe.show_alert({ message: "Network error", indicator: "red" }, 3);
                wa.messages.mark_pending_message_failed(pendingTempId);
                wa.sidebar.update_sidebar_conversation({
                    contact_number: wa.state.active_contact,
                    customer: wa.state.active_customer,
                    message_text: attachmentPreview,
                    message_type: file.type || "document",
                    file_url: file.name,
                    message_status: "failed",
                    custom_status: "Outgoing",
                    unread: 0,
                    timestamp: new Date().toISOString()
                });
            }
        });
    } catch (error) {
        frappe.show_alert({ message: "Error processing file", indicator: "red" }, 3);
        wa.messages.mark_pending_message_failed(pendingTempId);
        wa.sidebar.update_sidebar_conversation({
            contact_number: wa.state.active_contact,
            customer: wa.state.active_customer,
            message_text: attachmentPreview,
            message_type: file.type || "document",
            file_url: file.name,
            message_status: "failed",
            custom_status: "Outgoing",
            unread: 0,
            timestamp: new Date().toISOString()
        });
    }
};

// Appends an optimistic outgoing bubble for a text message before the server confirms it.
// Shows the quote block inline when a reply is active, using the same wa.reply.render_quote markup.
wa.input.append_local_message = function (text, reply_to) {
    const time = new Date().toTimeString().slice(0, 5);
    const createdAt = new Date().toISOString();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const quoteHtml = reply_to
        ? `<div class="wa-reply-quote"><span class="wa-reply-quote-sender">${frappe.utils.escape_html(
              reply_to.sender
          )}</span>${frappe.utils.escape_html(reply_to.text)}</div>`
        : "";
    const html = `<div class="wa-message outgoing sending-msg" data-temp-id="${tempId}" data-message-type="text" data-creation="${createdAt}"><div class="wa-message-content">${quoteHtml}${wa.utils.render_message_text(
        text
    )}<div class="wa-message-footer"><span>${wa.utils.format_timestamp(time)}</span>${wa.utils.get_pending_tick()}</div></div></div>`;
    $("#wa-messages-area").append(html);
    window.scrollToBottomDelayed();
    if (wa.state.active_contact) {
        wa.sidebar.sync_sidebar_with_chat_panel(wa.state.active_contact);
    }
    return tempId;
};

// Sends arbitrary text to the active contact, bypassing the textarea. Used by
// the composer's send button and by the carousel's "Order now" button.
wa.input.send_message_text = function (text) {
    text = (text || "").trim();
    if (!text || !wa.state.active_contact) return;

    const reply_to = wa.state.reply_to;
    const pendingTempId = wa.input.append_local_message(text, reply_to);
    wa.sidebar.update_sidebar_conversation({
        contact_number: wa.state.active_contact,
        customer: wa.state.active_customer,
        message_text: text,
        message_type: "text",
        message_status: "pending",
        custom_status: "Outgoing",
        unread: 0,
        timestamp: new Date().toISOString()
    });

    const call_args = { to_number: wa.state.active_contact, message_body: text };
    if (reply_to && reply_to.whatsapp_message_id) {
        // send_whatsapp_reply must forward this as context.message_id in the
        // Cloud API payload for the quote to actually attach on WhatsApp
        call_args.reply_to_message_id = reply_to.whatsapp_message_id;
    }
    if (typeof wa.reply !== "undefined") wa.reply.clear_reply();

    frappe.call({
        method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply.send_whatsapp_reply",
        args: call_args,
        callback(r) {
            $("#wa-send-btn").prop("disabled", false);
            if (r.message?.success) {
                wa.messages.finalize_pending_message(pendingTempId, r.message.doc_name, r.message.message_id, "pending");
            } else {
                wa.messages.mark_pending_message_failed(pendingTempId);
                wa.sidebar.update_sidebar_conversation({
                    contact_number: wa.state.active_contact,
                    customer: wa.state.active_customer,
                    message_text: text,
                    message_type: "text",
                    message_status: "failed",
                    custom_status: "Outgoing",
                    unread: 0,
                    timestamp: new Date().toISOString()
                });
                frappe.show_alert({ message: "Failed to send", indicator: "red" }, 3);
            }
        },
        error() {
            $("#wa-send-btn").prop("disabled", false);
            wa.messages.mark_pending_message_failed(pendingTempId);
            wa.sidebar.update_sidebar_conversation({
                contact_number: wa.state.active_contact,
                customer: wa.state.active_customer,
                message_text: text,
                message_type: "text",
                message_status: "failed",
                custom_status: "Outgoing",
                unread: 0,
                timestamp: new Date().toISOString()
            });
            frappe.show_alert({ message: "Network error", indicator: "red" }, 3);
        }
    });
};

// Reads the textarea and delegates to send_message_text — kept as the click/Enter handler
wa.input.send_message = function () {
    const text = $("#wa-message-input").val().trim();
    if (!text || !wa.state.active_contact) return;

    $("#wa-message-input").val("").css("height", "auto");
    $("#wa-send-btn").prop("disabled", true);
    wa.input.send_message_text(text);
};
