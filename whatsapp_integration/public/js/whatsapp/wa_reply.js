// wa.reply — reply preview and composer reply bar
//
// Backend requirement: to persist and display quotes, add two fields to the
// Whatsapp Message doctype and include them in wa_messages.js's load_messages
// field list:
//   custom_reply_to_name    (Data)  — the name of the message being replied to
//   custom_reply_to_sender  (Data)  — display label for who sent the quoted message
//   custom_reply_to_text    (Data)  — short snippet of the quoted message
// send_whatsapp_reply must also accept a reply_to_message_id arg (the wamid)
// and pass it as WhatsApp Cloud API's context.message_id — see the sender-side
// note from earlier in this conversation.
frappe.provide("wa.reply");

// Returns the quoted block HTML for a bubble, or "" if this message is not a reply
wa.reply.render_quote = function (msg) {
    if (!msg.custom_reply_to_text) return "";
    const sender = frappe.utils.escape_html(msg.custom_reply_to_sender || "");
    const text = frappe.utils.escape_html(msg.custom_reply_to_text);
    return `<div class="wa-reply-quote" data-reply-target="${frappe.utils.escape_html(msg.custom_reply_to_name || "")}">
        <span class="wa-reply-quote-sender">${sender}</span>${text}
    </div>`;
};

// Sets the active reply target from a clicked bubble and shows the reply bar
wa.reply.set_reply = function ($message) {
    const sender = $message.hasClass("outgoing") ? "You" : wa.state.active_customer || "Contact";
    const text =
        $message.find(".wa-message-text").first().text().trim() ||
        $message.find(".wa-doc-name").first().text().trim() ||
        "Attachment";

    wa.state.reply_to = {
        name: $message.attr("data-message-id") || "",
        whatsapp_message_id: $message.attr("data-whatsapp-message-id") || "",
        sender: sender,
        text: text
    };

    $("#wa-reply-bar-text")
        .empty()
        .append($("<span>", { class: "wa-reply-bar-sender", text: `Replying to ${sender}` }))
        .append($("<span>", { class: "wa-reply-bar-preview", text: text }));
    $("#wa-reply-bar").addClass("show");
    $("#wa-message-input").focus();
};

// Clears the reply target, called on close-click and right after a message is sent
wa.reply.clear_reply = function () {
    wa.state.reply_to = null;
    $("#wa-reply-bar").removeClass("show");
};

wa.reply.bind_events = function () {
    $(document).on("click", "#wa-reply-bar-close", wa.reply.clear_reply);

    // Clicking a quoted block scrolls to the original message, reusing the
    // existing "jump to message" flow in wa.messages.scroll_to_selected_message
    $(document).on("click", ".wa-reply-quote", function () {
        const target = $(this).attr("data-reply-target");
        if (!target) return;
        sessionStorage.setItem("whatsapp_selected_message", target);
        wa.messages.scroll_to_selected_message();
    });
};
