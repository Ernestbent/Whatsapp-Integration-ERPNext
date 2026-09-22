// wa.sidebar — chat list: loading, rendering, click handling, preview updates
frappe.provide("wa.sidebar");

// Fetches the display-name map used by wa.utils.get_display_name
wa.sidebar.load_recipient_name_cache = function (callback = null) {
    frappe.call({
        method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.api_fetch_message.get_recipient_name_map",
        callback(r) {
            wa.state.recipient_name_cache = r.message || {};
            if (typeof callback === "function") callback();
        },
        error() {
            wa.state.recipient_name_cache = {};
            if (typeof callback === "function") callback();
        }
    });
};

// Re-binds the click handler after the chat list HTML is replaced
wa.sidebar.bind_chat_list_events = function () {
    $(".wa-chat-item")
        .off("click")
        .on("click", function () {
            $(".wa-chat-item").removeClass("active");
            $(this).addClass("active");

            wa.state.active_contact = String($(this).attr("data-contact") || "");
            wa.state.active_customer = $(this).find(".wa-chat-name").text();
            wa.state.customer_name_cache[wa.state.active_contact] = wa.state.active_customer;
            localStorage.setItem("wa_active_contact", wa.state.active_contact);
            wa.reply.clear_reply();
            wa.contact_panel.close();

            $("#wa-header-name").text(wa.state.active_customer);
            $("#wa-header-subtitle").text(wa.utils.format_phone_display(wa.state.active_contact));
            $("#wa-profile-avatar").text(wa.state.active_customer.charAt(0).toUpperCase());

            if ($(window).width() <= 640) {
                $(".wa-sidebar").addClass("hidden");
            }

            wa.messages.show_cached_messages(wa.state.active_contact);
            wa.messages.load_messages(wa.state.active_contact, true);
        });

    if (!wa.state.active_contact) {
        const savedContact = localStorage.getItem("wa_active_contact");
        const $saved = savedContact
            ? $(".wa-chat-item").filter(function () {
                  return String($(this).data("contact")) === String(savedContact);
              }).first()
            : $();
        ($saved.length ? $saved : $(".wa-chat-item").first()).trigger("click");
    } else {
        $(".wa-chat-item").filter(function () {
            return String($(this).data("contact")) === String(wa.state.active_contact);
        }).addClass("active");
    }
};

// Inserts or replaces one sidebar row after a new message or a locally sent one
wa.sidebar.update_sidebar_conversation = function ({
    contact_number,
    message_text = "",
    customer = null,
    message_status = "",
    custom_status = "Outgoing",
    message_type = "text",
    file_url = "",
    template_type = "",
    unread = null,
    timestamp = null,
    move_to_top = true
}) {
    if (!contact_number) return;

    const displayName = wa.utils.get_display_name(contact_number, customer);
    wa.state.customer_name_cache[contact_number] = displayName;
    const previewText = wa.utils.get_sidebar_preview({
        message_text,
        message_type,
        file_url,
        template_type
    });
    const normalizedStatus = (message_status || "").toLowerCase();
    const tickHtml =
        custom_status !== "Incoming"
            ? normalizedStatus === "pending"
                ? wa.utils.get_pending_tick()
                : wa.utils.get_whatsapp_ticks(custom_status, false, message_status)
            : "";

    const time = timestamp ? wa.utils.format_time_ago(timestamp) : "now";
    const unreadCount =
        unread == null
            ? (() => {
                  const currentUnread = parseInt(
                      $(`.wa-chat-item[data-contact="${contact_number}"]`).attr("data-unread-count") || "0",
                      10
                  );
                  if (custom_status === "Incoming" && wa.state.active_contact !== contact_number) {
                      return currentUnread + 1;
                  }
                  return 0;
              })()
            : unread;

    const safeContact = frappe.utils.escape_html(contact_number);
    const safeDisplayName = frappe.utils.escape_html(displayName);
    const safePreview = frappe.utils.escape_html(previewText);
    const previewDirection = custom_status === "Incoming" ? "Incoming" : "Outgoing";
    const itemHtml = `<div class="wa-chat-item${wa.state.active_contact === contact_number ? " active" : ""}" data-contact="${safeContact}" data-unread-count="${unreadCount}" data-preview-text="${safePreview}" data-preview-direction="${previewDirection}">
            <div class="wa-avatar">${safeDisplayName.charAt(0).toUpperCase()}</div>
            <div class="wa-chat-info">
                <div class="wa-chat-name">${safeDisplayName}</div>
                <div class="wa-chat-preview">${tickHtml}${safePreview || "No message"}</div>
            </div>
            <div class="wa-chat-meta">
                <div class="wa-chat-time">${time}</div>
                ${unreadCount ? `<div class="wa-unread-badge">${unreadCount}</div>` : ""}
            </div>
        </div>`;

    const $existing = $(`.wa-chat-item[data-contact="${contact_number}"]`);
    if ($existing.length) {
        if (move_to_top) {
            $existing.remove();
            $("#wa-chat-list").prepend(itemHtml);
        } else {
            $existing.replaceWith(itemHtml);
        }
    } else {
        $("#wa-chat-list").prepend(itemHtml);
    }

    wa.sidebar.bind_chat_list_events();
};

// Refreshes only the tick icon on an outgoing row, without touching unread count
wa.sidebar.update_sidebar_status = function (contactNumber, newStatus) {
    if (!contactNumber) return;
    const $item = $(`.wa-chat-item[data-contact="${contactNumber}"]`);
    if (!$item.length) return;
    if (($item.attr("data-preview-direction") || "Outgoing") !== "Outgoing") return;

    const $preview = $item.find(".wa-chat-preview");
    const lastText = $item.attr("data-preview-text") || $preview.text().trim() || "No message";
    const statusHtml =
        (newStatus || "").toLowerCase() === "pending"
            ? wa.utils.get_pending_tick()
            : wa.utils.get_whatsapp_ticks("Outgoing", false, newStatus);

    $preview.html(`${statusHtml}${frappe.utils.escape_html(lastText)}`);
};

// Mirrors the last bubble in the open chat back onto its sidebar row
wa.sidebar.sync_sidebar_with_chat_panel = function (contactNumber) {
    if (!contactNumber || wa.state.active_contact !== contactNumber) return;

    const $lastMessage = $("#wa-messages-area .wa-message").last();
    if (!$lastMessage.length) return;

    const isOutgoing = $lastMessage.hasClass("outgoing");
    const messageStatus = ($lastMessage.attr("data-message-status") || "").toLowerCase();
    let messageType = ($lastMessage.attr("data-message-type") || "").toLowerCase();
    if (!messageType && $lastMessage.find(".wa-audio-player, audio").length) messageType = "audio";
    if (!messageType && $lastMessage.find("video").length) messageType = "video";
    if (!messageType && $lastMessage.find("img").length) messageType = "image";
    if (!messageType && $lastMessage.find(".wa-document-preview").length) messageType = "document";
    if (!messageType && $lastMessage.find(".wa-carousel-wrap").length) messageType = "carousel";

    const messageText =
        $lastMessage.find(".wa-message-text").first().text().trim() ||
        $lastMessage.find(".wa-media-caption").first().text().trim() ||
        "";
    const fileUrl =
        $lastMessage.attr("data-file-url") || $lastMessage.find(".wa-doc-name").first().text().trim() || "";

    wa.sidebar.update_sidebar_conversation({
        contact_number: contactNumber,
        customer: wa.state.active_customer,
        message_text: messageText,
        message_type: messageType,
        file_url: fileUrl,
        template_type: messageType === "carousel" ? "carousel" : "",
        message_status: isOutgoing ? messageStatus || "pending" : "",
        custom_status: isOutgoing ? "Outgoing" : "Incoming",
        unread: 0,
        timestamp: $lastMessage.attr("data-creation") || null,
        move_to_top: false
    });
};

// Builds the full chat list from scratch, used on load and by the search box
wa.sidebar.load_conversations = function () {
    frappe.call({
        method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.api_fetch_message.get_conversations",
        callback(r) {
            if (!r.message) return;

            const convMap = {};
            const unreadMap = {};

            r.message.forEach((msg) => {
                const key = msg.from_number;

                if (!convMap[key] || new Date(msg.creation) > new Date(convMap[key].creation)) {
                    convMap[key] = msg;
                }
                if (msg.custom_status === "Incoming" && !msg.custom_read) {
                    unreadMap[key] = (unreadMap[key] || 0) + 1;
                }
            });

            let html = "";
            Object.keys(convMap).forEach((key) => {
                const msg = convMap[key];

                const displayName = wa.utils.get_display_name(msg.from_number, msg.customer_name, msg.user_first_name);
                wa.state.customer_name_cache[key] = displayName;

                const preview = wa.utils.get_sidebar_preview({
                    message_text: msg.message,
                    message_type: msg.message_type,
                    file_url: msg.custom_document,
                    template_type: msg.custom_template_type
                });
                const unread = unreadMap[key] || 0;
                const time = wa.utils.format_time_ago(msg.creation);
                const tickHtml =
                    msg.custom_status !== "Incoming"
                        ? wa.utils.get_whatsapp_ticks(msg.custom_status, msg.custom_read, msg.message_status)
                        : "";

                html += `<div class="wa-chat-item" data-contact="${frappe.utils.escape_html(msg.from_number)}" data-unread-count="${unread}" data-preview-text="${frappe.utils.escape_html(preview)}" data-preview-direction="${msg.custom_status === "Incoming" ? "Incoming" : "Outgoing"}">
                            <div class="wa-avatar">${frappe.utils.escape_html(displayName).charAt(0).toUpperCase()}</div>
                            <div class="wa-chat-info">
                                <div class="wa-chat-name">${frappe.utils.escape_html(displayName)}</div>
                                <div class="wa-chat-preview">${tickHtml}${frappe.utils.escape_html(preview) || "No message"}</div>
                            </div>
                            <div class="wa-chat-meta">
                                <div class="wa-chat-time">${time}</div>
                                ${unread ? `<div class="wa-unread-badge">${unread}</div>` : ""}
                            </div>
                        </div>`;
            });

            const finalHtml = html || "<div class='wa-empty-state'><div>No conversations yet</div></div>";
            if ($("#wa-chat-list").html() !== finalHtml) {
                $("#wa-chat-list").html(finalHtml);
                wa.sidebar.bind_chat_list_events();
            }

            $("#wa-search-input")
                .off("input")
                .on("input", function () {
                    const searchTerm = $(this).val().toLowerCase();
                    $(".wa-chat-item").each(function () {
                        const name = $(this).find(".wa-chat-name").text().toLowerCase();
                        const preview = $(this).find(".wa-chat-preview").text().toLowerCase();
                        $(this).toggle(name.includes(searchTerm) || preview.includes(searchTerm));
                    });
                });
        }
    });
};
