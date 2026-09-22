// wa.messages — message bubbles: rendering, loading, status updates, scrolling
frappe.provide("wa.messages");

// Renders the bubble body for one message: text, image, video, audio, document, sticker
wa.messages.render_media_content = function (message) {
    const type = message.message_type;
    const file_url = message.custom_document;
    const message_text = message.message;

    const carouselHtml =
        wa.carousel && typeof wa.carousel.render === "function" ? wa.carousel.render(message) : "";
    if (carouselHtml) return carouselHtml;

    const configuredTemplateHeader = String(message.custom_template_header_type || "").toLowerCase();
    const isTemplate =
        type === "template" ||
        Boolean(configuredTemplateHeader && configuredTemplateHeader !== "none") ||
        Boolean(message.custom_template_header_file) ||
        Boolean(message.custom_template_footer);
    if (isTemplate && wa.templates && typeof wa.templates.render === "function") {
        return wa.templates.render(message);
    }

    if (!file_url) {
        return wa.utils.render_message_text(message_text);
    }

    const isDocument = type === "document" || file_url.toLowerCase().split(/[?#]/)[0].endsWith(".pdf");
    if (isDocument && wa.documents && typeof wa.documents.render === "function") {
        return wa.documents.render(file_url, message_text, message.file_size || null);
    }

    switch (type) {
        case "image": {
            const safeImageUrl = frappe.utils.escape_html(file_url);
            return `<div class="wa-media-container"><img src="${safeImageUrl}" alt="Image" onload="if(window.scrollAfterLoad) window.scrollAfterLoad()" onclick="open_lightbox('${safeImageUrl}', 'image')" />${
                message_text && !message_text.startsWith("Image:")
                    ? wa.utils.render_message_text(message_text, "wa-media-caption")
                    : ""
            }</div>`;
        }

        case "video": {
            const safeVideoUrl = frappe.utils.escape_html(file_url);
            return `<div class="wa-media-container"><video controls onloadeddata="if(window.scrollAfterLoad) window.scrollAfterLoad()" onclick="open_lightbox('${safeVideoUrl}', 'video')"><source src="${safeVideoUrl}" type="video/mp4"></video>${
                message_text && !message_text.startsWith("Video:")
                    ? wa.utils.render_message_text(message_text, "wa-media-caption")
                    : ""
            }</div>`;
        }

        case "audio": {
            if (wa.audio && typeof wa.audio.render === "function") {
                return wa.audio.render(file_url);
            }
            return `<audio controls preload="metadata" src="${frappe.utils.escape_html(file_url)}"></audio>`;
        }

        case "document":
            return wa.utils.render_message_text(message_text || "Document");

        case "sticker":
            return `<div class="wa-media-container"><img src="${frappe.utils.escape_html(file_url)}" alt="Sticker" /></div>`;

        default:
            return wa.utils.render_message_text(message_text || "Unsupported message type");
    }
};

// Activates controls that need direct bindings after message HTML is replaced.
wa.messages.hydrate_components = function () {
    if (wa.audio && typeof wa.audio.bind_all === "function") {
        wa.audio.bind_all();
    }
};

wa.messages.show_panel_state = function (message, loading = false) {
    const safeMessage = frappe.utils.escape_html(message || "");
    $("#wa-messages-area").html(
        `<div class="wa-panel-state${loading ? " loading" : ""}">${safeMessage}</div>`
    );
};

// Swaps a temp-id bubble's footer for a real tick once the server confirms the send
wa.messages.finalize_pending_message = function (tempId, docName, messageId, status = "sent") {
    const $message = $(wa.utils.get_temp_message_selector(tempId));
    if (!$message.length) return;

    const $footer = $message.find(".wa-message-footer");
    const timeText = $footer.find("span").first().text();

    $message
        .removeClass("sending-msg wa-temp-attachment")
        .attr("data-message-id", docName || "")
        .attr("data-whatsapp-message-id", messageId || "")
        .attr("data-message-status", status);

    const statusHtml =
        (status || "").toLowerCase() === "pending"
            ? wa.utils.get_pending_tick()
            : wa.utils.get_whatsapp_ticks("Outgoing", false, status);
    $footer.html(`<span>${timeText}</span>${statusHtml}`);
    if (wa.state.active_contact) {
        wa.sidebar.sync_sidebar_with_chat_panel(wa.state.active_contact);
    }
};

// Marks a temp-id bubble as failed after a send error
wa.messages.mark_pending_message_failed = function (tempId) {
    const $message = $(wa.utils.get_temp_message_selector(tempId));
    if (!$message.length) return;

    const $footer = $message.find(".wa-message-footer");
    const timeText = $footer.find("span").first().text();

    $message.removeClass("sending-msg wa-temp-attachment").attr("data-message-status", "failed");

    $footer.html(`<span>${timeText}</span>${wa.utils.get_whatsapp_ticks("Outgoing", false, "failed")}`);
    if (wa.state.active_contact) {
        wa.sidebar.sync_sidebar_with_chat_panel(wa.state.active_contact);
    }
};

// Applies a delivered/read/failed status update pushed from the realtime handler or the poll
wa.messages.apply_message_status_update = function (messageName, whatsappMessageId, newStatus, timestamp = null) {
    const $message = $(
        `.wa-message[data-message-id="${messageName}"], .wa-message[data-whatsapp-message-id="${whatsappMessageId}"]`
    );
    if (!$message.length || !$message.hasClass("outgoing")) return false;

    const currentStatus = ($message.attr("data-message-status") || "").toLowerCase();
    const nextStatus = (newStatus || "").toLowerCase();
    if (currentStatus === nextStatus && !timestamp) return false;

    const $footer = $message.find(".wa-message-footer");
    if (!$footer.length) return false;

    const timeText = timestamp ? wa.utils.format_timestamp(timestamp) : $footer.find("span").first().text();
    $footer.html(`<span>${timeText}</span>${wa.utils.get_whatsapp_ticks("Outgoing", false, newStatus)}`);
    $message
        .removeClass("sending-msg wa-temp-attachment")
        .attr("data-message-id", messageName || $message.attr("data-message-id") || "")
        .attr("data-whatsapp-message-id", whatsappMessageId || $message.attr("data-whatsapp-message-id") || "")
        .attr("data-message-status", newStatus);

    if (wa.state.active_contact) {
        wa.sidebar.sync_sidebar_with_chat_panel(wa.state.active_contact);
    }

    return true;
};

// Polls the open chat's own messages for status changes, used by the 2.5s sync loop
wa.messages.sync_active_message_statuses = function () {
    if (document.hidden || !wa.state.active_contact) return;

    frappe.call({
        method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.api_fetch_message.get_chat_statuses",
        args: { contact: String(wa.state.active_contact || "") },
        callback(r) {
            if (!r.message || !wa.state.active_contact) return;

            let latestOutgoingStatus = null;

            (r.message || []).forEach((msg) => {
                if (msg.custom_status === "Incoming") return;

                wa.messages.apply_message_status_update(
                    msg.name,
                    msg.message_id,
                    msg.message_status || "sent",
                    msg.timestamp || null
                );

                if (!latestOutgoingStatus) {
                    latestOutgoingStatus = msg.message_status || "sent";
                }
            });

            if (latestOutgoingStatus) {
                wa.sidebar.update_sidebar_status(wa.state.active_contact, latestOutgoingStatus);
            }
        }
    });
};

// True while the user is scrolled near the bottom, used to decide whether to auto-scroll
wa.messages.check_scroll_position = function () {
    const container = $("#wa-messages-area")[0];
    if (!container) return;
    const threshold = 100;
    wa.state.user_at_bottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
};

// Jumps the message list to the bottom, forced or only if the user was already there
wa.messages.scrollToBottom = function (force = false) {
    const container = $("#wa-messages-area")[0];
    if (container) {
        if (force) {
            container.scrollTop = container.scrollHeight;
            wa.state.user_at_bottom = true;
        } else if (wa.state.user_at_bottom) {
            container.scrollTop = container.scrollHeight;
        }
    }
};

// Retries the scroll a few times, needed because images and videos load after the bubble renders
window.scrollAfterLoad = function () {
    window.scrollToBottomDelayed();
};

window.scrollToBottomDelayed = function () {
    wa.messages.scrollToBottom(true);
    setTimeout(() => wa.messages.scrollToBottom(true), 100);
    setTimeout(() => wa.messages.scrollToBottom(true), 300);
    setTimeout(() => wa.messages.scrollToBottom(true), 500);
};

// If the user opened this page from a "jump to message" link, scrolls to and highlights it
wa.messages.scroll_to_selected_message = function () {
    const messageName = sessionStorage.getItem("whatsapp_selected_message");
    if (!messageName) return false;

    const target = Array.from(document.querySelectorAll(".wa-message")).find(
        (message) => message.dataset.messageId === messageName
    );
    if (!target) return false;

    sessionStorage.removeItem("whatsapp_selected_message");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("wa-selected-message");
    setTimeout(() => target.classList.remove("wa-selected-message"), 1800);
    return true;
};

// Paints the cached HTML for a contact instantly, before the fresh fetch resolves
wa.messages.show_cached_messages = function (contact_number) {
    $("#wa-empty-state").hide();
    $("#wa-loading").hide();

    if (wa.state.message_cache[contact_number]) {
        $("#wa-messages-area").html(wa.state.message_cache[contact_number]);
        wa.messages.append_simulated_messages_to_active_chat(contact_number);
        wa.messages.hydrate_components();
        window.scrollToBottomDelayed();
    } else {
        wa.messages.show_panel_state("Loading messages...", true);
    }
};

// Reads the locally-queued broadcast messages used by the demo/simulated send path
wa.messages.get_simulated_messages_map = function () {
    try {
        return JSON.parse(localStorage.getItem(wa.state.SIM_MESSAGES_KEY) || "{}");
    } catch (e) {
        return {};
    }
};

// Appends any simulated broadcast messages queued for this contact onto the open chat
wa.messages.append_simulated_messages_to_active_chat = function (contact_number) {
    const msgMap = wa.messages.get_simulated_messages_map();
    const rows = msgMap[contact_number] || [];
    if (!rows.length) return;

    rows.forEach((msg) => {
        const textHtml = msg.text ? wa.utils.render_message_text(msg.text) : "";
        const imageList = (msg.image_data_urls || []).filter(Boolean);
        const fallbackList = imageList.length ? imageList : msg.image_data_url ? [msg.image_data_url] : [];
        const mediaHtml = fallbackList
            .map((url) => `<div class="wa-media-container"><img src="${url}" alt="Broadcast image" /></div>`)
            .join("");
        const simulatedType = fallbackList.length ? "image" : "text";
        const html = `<div class="wa-message outgoing wa-sim-broadcast" data-sim-id="${frappe.utils.escape_html(msg.id || "")}" data-message-type="${simulatedType}" data-creation="${frappe.utils.escape_html(msg.time || "")}">
                        <div class="wa-message-content">
                            ${mediaHtml}
                            ${textHtml}
                            <div class="wa-message-footer">
                                <span>${wa.utils.format_timestamp(msg.time || "") || "now"}</span>${wa.utils.get_whatsapp_ticks("Outgoing", 1, "sent")}
                            </div>
                        </div>
                    </div>`;
        $("#wa-messages-area").append(html);
    });
};

// Moves any queued broadcast jobs from localStorage into the per-contact message map
wa.messages.consume_simulated_broadcast_queue = function () {
    let jobs = [];
    try {
        jobs = JSON.parse(localStorage.getItem(wa.state.SIM_QUEUE_KEY) || "[]");
    } catch (e) {
        jobs = [];
    }
    if (!jobs.length) return;

    const msgMap = wa.messages.get_simulated_messages_map();
    jobs.forEach((job) => {
        const recipients = job.recipients || [];
        recipients.forEach((recipient) => {
            if (!msgMap[recipient.contact]) msgMap[recipient.contact] = [];
            msgMap[recipient.contact].push({
                id: `${job.id}-${recipient.contact}`,
                text: job.message || "",
                image_data_urls: job.image_data_urls || [],
                image_data_url: job.image_data_url || "",
                time: job.time || ""
            });

            wa.sidebar.update_sidebar_conversation({
                contact_number: recipient.contact,
                customer: recipient.customer_name || recipient.contact,
                message_text:
                    job.message ||
                    ((job.image_data_urls || []).length || job.image_data_url ? "Broadcast images" : "Broadcast message"),
                message_status: "sent",
                custom_status: "Outgoing",
                message_type:
                    (job.image_data_urls || []).length || job.image_data_url ? "image" : "text",
                unread: 0,
                timestamp: job.iso_timestamp || new Date().toISOString()
            });
        });
    });

    localStorage.setItem(wa.state.SIM_MESSAGES_KEY, JSON.stringify(msgMap));
    localStorage.removeItem(wa.state.SIM_QUEUE_KEY);
};

// Fetches and renders the full message history for one contact, with date separators
wa.messages.load_messages = function (contact_number, forceRefresh = false) {
    const cacheKey = contact_number;

    if (!wa.state.message_cache[cacheKey] || forceRefresh) {
        if (!wa.state.message_cache[cacheKey]) {
            $("#wa-loading").show();
        }
    }

    frappe.call({
        method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.api_fetch_message.get_chat_history",
        args: { contact: String(contact_number || "") },
        callback(r) {
            $("#wa-loading").hide();

            try {
                if (!r.message) {
                    wa.messages.show_panel_state("No messages in this conversation");
                    return;
                }

                let html = "";
                const unread_ids = [];
                const unread_message_ids = [];
                let lastDate = null;

                const sortedMessages = (r.message || []).sort(
                    (a, b) => new Date(a.creation) - new Date(b.creation)
                );

                sortedMessages.forEach((msg) => {
                    const userCreation = String(frappe.datetime.str_to_user(msg.creation || "") || "");
                    const creationParts = userCreation.split(" ");
                    const msgDate = creationParts[0] || String(msg.creation || "").slice(0, 10);
                    const displayDate = wa.utils.format_date_display(msg.creation);

                    if (msgDate !== lastDate) {
                        html += `<div class="wa-date-separator"><span class="wa-date-badge">${displayDate}</span></div>`;
                        lastDate = msgDate;
                    }

                    if (msg.custom_status === "Incoming" && !msg.custom_read) {
                        unread_ids.push(msg.name);
                        if (msg.message_id) unread_message_ids.push(msg.message_id);
                    }

                    const isOutgoing = msg.custom_status !== "Incoming";
                    const time = msg.timestamp
                        ? wa.utils.format_timestamp(msg.timestamp)
                        : (creationParts[1] || "").slice(0, 5);
                    const tick_icon = wa.utils.get_whatsapp_ticks(
                        msg.custom_status,
                        msg.custom_read,
                        msg.message_status
                    );
                    const media_content = wa.messages.render_media_content(msg);
                    const quote_content =
                        wa.reply && typeof wa.reply.render_quote === "function" ? wa.reply.render_quote(msg) : "";
                    const reaction_picker =
                        !isOutgoing &&
                        msg.message_id &&
                        wa.reactions &&
                        typeof wa.reactions.render_picker === "function"
                            ? wa.reactions.render_picker()
                            : "";
                    const reactions =
                        wa.reactions && typeof wa.reactions.render_pills === "function"
                            ? wa.reactions.render_pills(msg)
                            : "";
                    const actions =
                        wa.actions && typeof wa.actions.render === "function"
                            ? wa.actions.render(!isOutgoing && Boolean(msg.message_id))
                            : "";
                    const isCarousel = msg.custom_template_type === "carousel";
                    const sidebarMessageType = isCarousel ? "carousel" : msg.message_type || "text";
                    const contentClass = isCarousel ? " wa-carousel-bubble" : "";
                    const messageClass = isCarousel ? " wa-carousel-message" : "";
                    const safeName = frappe.utils.escape_html(msg.name || "");
                    const safeMessageId = frappe.utils.escape_html(msg.message_id || "");
                    const safeStatus = frappe.utils.escape_html(msg.message_status || "");
                    const safeMessageType = frappe.utils.escape_html(sidebarMessageType);
                    const safeFileUrl = frappe.utils.escape_html(msg.custom_document || "");
                    const safeCreation = frappe.utils.escape_html(msg.creation || "");

                    html += `<div class="wa-message ${isOutgoing ? "outgoing" : "incoming"}${messageClass}" data-message-id="${safeName}" data-whatsapp-message-id="${safeMessageId}" data-message-status="${safeStatus}" data-message-type="${safeMessageType}" data-file-url="${safeFileUrl}" data-creation="${safeCreation}">
                            <div class="wa-message-content${contentClass}">
                                ${actions}
                                ${reaction_picker}
                                ${quote_content}
                                ${media_content}
                                <div class="wa-message-footer">
                                    <span>${time}</span>${tick_icon}
                                </div>
                                ${reactions}
                            </div>
                        </div>`;
                });

                const previousHtml = wa.state.message_cache[cacheKey];
                const hasChanged = previousHtml !== html;
                wa.state.message_cache[cacheKey] = html;

                if (wa.state.active_contact === contact_number) {
                    if (html) {
                        $("#wa-empty-state").hide();
                        let messagesRendered = false;
                        if (hasChanged || $("#wa-messages-area").html() !== html) {
                            $("#wa-messages-area").html(html);
                            wa.messages.append_simulated_messages_to_active_chat(contact_number);
                            wa.messages.hydrate_components();
                            messagesRendered = true;
                        }
                        if (!wa.messages.scroll_to_selected_message() && messagesRendered) {
                            window.scrollToBottomDelayed();
                        }
                        wa.sidebar.sync_sidebar_with_chat_panel(contact_number);
                    } else {
                        wa.messages.show_panel_state("No messages in this conversation");
                    }
                }

                if (unread_ids.length) {
                    frappe.call({
                        method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.api_fetch_message.mark_all_read_by_number",
                        args: { from_number: String(contact_number || "") },
                        callback() {
                            wa.sidebar.load_conversations();
                        }
                    });
                }

                if (unread_message_ids.length) {
                    unread_message_ids.forEach((message_id) => {
                        frappe.call({
                            method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.read_receipts.mark_whatsapp_message_read",
                            args: { message_id: message_id }
                        });
                    });
                }
            } catch (error) {
                console.error("Unable to render WhatsApp conversation", error, r.message);
                if (wa.state.active_contact === contact_number) {
                    const detail = error && error.message ? `: ${error.message}` : "";
                    wa.messages.show_panel_state(`Unable to display this conversation${detail}`);
                }
            }
        },
        error() {
            if (wa.state.active_contact === contact_number) {
                wa.messages.show_panel_state("Unable to load this conversation. Please try again.");
            }
        }
    });
};

// Global so inline onclick="open_lightbox(...)" from a rendered bubble can reach it
window.open_lightbox = function (src, type) {
    const lightbox = $("#wa-lightbox");
    if (type === "image") {
        $("#wa-lightbox-img").attr("src", src).show();
        $("#wa-lightbox video").hide();
    } else if (type === "video") {
        $("#wa-lightbox-img").hide();
        if (!$("#wa-lightbox video").length) {
            lightbox.append('<video controls autoplay><source src="' + src + '" type="video/mp4"></video>');
        } else {
            $("#wa-lightbox video").show();
            $("#wa-lightbox video source").attr("src", src);
            $("#wa-lightbox video")[0].load();
        }
    }
    lightbox.fadeIn(200);
};
