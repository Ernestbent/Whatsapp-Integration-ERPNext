// wa.realtime — socket event handlers and the polling loops that back them up
frappe.provide("wa.realtime");

// Coalesces rapid-fire events into a single sidebar reload, 300ms after the last one
wa.realtime.debounced_refresh_conversations = function () {
    clearTimeout(wa.state.refresh_conversations_timeout);
    wa.state.refresh_conversations_timeout = setTimeout(() => {
        wa.sidebar.load_conversations();
    }, 300);
};

// Starts the 2.5s status poll that backs up the realtime status event
wa.realtime.start_sync_loops = function () {
    if (!wa.state.status_sync_interval) {
        wa.state.status_sync_interval = setInterval(() => {
            wa.messages.sync_active_message_statuses();
        }, 2500);
    }
};

// Clears every interval on page unload
wa.realtime.stop_sync_loops = function () {
    if (wa.state.heartbeat_interval) {
        clearInterval(wa.state.heartbeat_interval);
        wa.state.heartbeat_interval = null;
    }

    if (wa.state.sidebar_sync_interval) {
        clearInterval(wa.state.sidebar_sync_interval);
        wa.state.sidebar_sync_interval = null;
    }

    if (wa.state.status_sync_interval) {
        clearInterval(wa.state.status_sync_interval);
        wa.state.status_sync_interval = null;
    }
};

// Registers the two frappe.realtime listeners this page relies on
wa.realtime.bind_events = function () {
    frappe.realtime.on("whatsapp_new_message", function (data) {
        console.log("whatsapp_new_message received:", data);

        if (!data || !data.contact_number) {
            console.warn("Invalid message event data:", data);
            return;
        }

        const contact = data.contact_number;
        const isActiveContact = wa.state.active_contact === contact;

        wa.sidebar.update_sidebar_conversation({
            contact_number: contact,
            customer: data.customer || null,
            message_text: data.message_text || data.file_url || data.media_url || data.whatsapp_type || "",
            message_type: data.whatsapp_type || "text",
            file_url: data.file_url || data.media_url || "",
            message_status: data.message_status || (data.message_type === "outgoing" ? "sent" : ""),
            custom_status: data.message_type === "incoming" ? "Incoming" : "Outgoing",
            unread: data.message_type === "incoming" ? (isActiveContact ? 0 : null) : 0,
            timestamp: data.timestamp || new Date().toISOString()
        });

        wa.state.message_cache[contact] = null;

        wa.realtime.debounced_refresh_conversations();

        if (isActiveContact) {
            setTimeout(() => {
                wa.messages.load_messages(contact, true);
            }, 300);
        }
    });

    frappe.realtime.on("whatsapp_message_status_changed", function (data) {
        console.log("whatsapp_message_status_changed received:", data);

        if (!data || !data.message_name || !data.contact_number || !data.new_status) return;

        const contact = data.contact_number;
        const isActiveChat = wa.state.active_contact && wa.state.active_contact === contact;
        wa.sidebar.update_sidebar_status(contact, data.new_status);
        wa.state.message_cache[contact] = null;

        if (isActiveChat) {
            setTimeout(() => {
                wa.messages.sync_active_message_statuses();
            }, 400);
        }

        wa.messages.apply_message_status_update(data.message_name, data.message_id, data.new_status);

        wa.realtime.debounced_refresh_conversations();
    });

    frappe.realtime.on("whatsapp_message_reaction_changed", function (data) {
        if (!data || !data.contact_number) return;
        wa.state.message_cache[data.contact_number] = null;
        if (wa.state.active_contact === data.contact_number) {
            wa.messages.load_messages(data.contact_number, true);
        }
    });
};
