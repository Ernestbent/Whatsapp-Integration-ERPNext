// wa.reactions — reaction picker and pills
//
// Backend requirement: the WhatsApp Cloud API only lets a business react to a
// message it received (see the sender-side note from earlier in this
// conversation), so the picker only appears on incoming bubbles. You need:
//   custom_reactions (Long Text JSON) on Whatsapp Message.
//   A whitelisted method, e.g. send_whatsapp_reaction(message_id, emoji),
//   that posts {type:"reaction", reaction:{message_id, emoji}} to the Cloud API
//   and updates custom_reactions. Sending an empty emoji removes your reaction.
frappe.provide("wa.reactions");

wa.reactions.emoji_set = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Picker button, shown only for incoming messages, positioned by CSS at the top of the bubble
wa.reactions.render_picker = function () {
    const buttons = wa.reactions.emoji_set.map((e) => `<span data-emoji="${e}">${e}</span>`).join("");
    return `<div class="wa-reaction-picker">${buttons}</div>`;
};

// Pills row for whatever reactions are already stored on this message
wa.reactions.render_pills = function (msg) {
    let reactions = [];
    if (msg.custom_reactions) {
        try {
            reactions = JSON.parse(msg.custom_reactions);
            if (!Array.isArray(reactions) && reactions && typeof reactions === "object") {
                reactions = Object.keys(reactions).map((from) => ({ from, emoji: reactions[from] }));
            }
        } catch (e) {
            reactions = [];
        }
    }
    if ((!Array.isArray(reactions) || !reactions.length) && msg.custom_reaction) {
        reactions = [{ emoji: msg.custom_reaction, from: msg.custom_reaction_from || "contact" }];
    }
    if (!Array.isArray(reactions)) reactions = [];
    reactions = reactions.filter((reaction) => reaction && reaction.emoji);
    if (!reactions.length) return "";

    const counts = {};
    reactions.forEach((r) => {
        counts[r.emoji] = counts[r.emoji] || { n: 0, me: false };
        counts[r.emoji].n += 1;
        if (r.from === "me") counts[r.emoji].me = true;
    });

    const pills = Object.keys(counts)
        .map((emoji) => {
            const c = counts[emoji];
            const safeEmoji = frappe.utils.escape_html(String(emoji));
            return `<span class="wa-reaction-pill${c.me ? " me" : ""}" data-emoji="${safeEmoji}">${safeEmoji} ${c.n}</span>`;
        })
        .join("");

    return `<div class="wa-reactions">${pills}</div>`;
};

// Sends (or clears, with emoji = "") a reaction for one message
wa.reactions.send = function (messageName, whatsappMessageId, emoji) {
    frappe.call({
        method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply.send_whatsapp_reaction",
        args: { message_id: whatsappMessageId, emoji: emoji },
        callback(r) {
            if (r.message?.success && wa.state.active_contact) {
                wa.state.message_cache[wa.state.active_contact] = null;
                wa.messages.load_messages(wa.state.active_contact, true);
            } else {
                frappe.show_alert(
                    { message: r.message?.error || "Failed to send reaction", indicator: "red" },
                    3
                );
            }
        },
        error() {
            frappe.show_alert({ message: "Network error", indicator: "red" }, 2.5);
        }
    });
};

wa.reactions.bind_events = function () {
    // Toggles the picker for one incoming bubble, closes any other open picker
    $(document).on("click", ".wa-reaction-trigger", function (e) {
        e.stopPropagation();
        const $picker = $(this).closest(".wa-message-content").find(".wa-reaction-picker");
        $(".wa-reaction-picker").not($picker).removeClass("show");
        $picker.toggleClass("show");
    });

    $(document).on("click", function () {
        $(".wa-reaction-picker").removeClass("show");
    });

    $(document).on("click", ".wa-reaction-picker span", function (e) {
        e.stopPropagation();
        const emoji = $(this).attr("data-emoji");
        const $message = $(this).closest(".wa-message");
        $(this).closest(".wa-reaction-picker").removeClass("show");
        wa.reactions.send($message.attr("data-message-id"), $message.attr("data-whatsapp-message-id"), emoji);
    });

    // Clicking your own pill again removes the reaction
    $(document).on("click", ".wa-reaction-pill.me", function () {
        const $message = $(this).closest(".wa-message");
        wa.reactions.send($message.attr("data-message-id"), $message.attr("data-whatsapp-message-id"), "");
    });
};
