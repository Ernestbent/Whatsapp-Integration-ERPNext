// wa.actions — the "..." menu on each message bubble
//
// Note: the WhatsApp Cloud API has no endpoint to delete or edit a message you
// already sent, so "Delete" here only removes the bubble from your own view —
// it does not delete anything on the customer's phone. Label it accordingly
// if that could confuse whoever uses this page.
frappe.provide("wa.actions");

// Returns the "..." button plus its (initially hidden) menu, for one bubble
wa.actions.render = function (allowReaction = false) {
    return `<div class="wa-msg-actions-btn">...</div>
        <div class="wa-msg-menu">
            <div class="wa-msg-menu-item" data-action="reply">Reply</div>
            ${allowReaction ? '<div class="wa-msg-menu-item" data-action="react">React</div>' : ""}
            <div class="wa-msg-menu-item" data-action="copy">Copy</div>
            <div class="wa-msg-menu-item danger" data-action="delete">Delete for me</div>
        </div>`;
};

wa.actions.bind_events = function () {
    // Opens the clicked message's own menu, closes any other open menu
    $(document).on("click", ".wa-msg-actions-btn", function (e) {
        e.stopPropagation();
        const $menu = $(this).siblings(".wa-msg-menu");
        $(".wa-msg-menu").not($menu).removeClass("show");
        $menu.toggleClass("show");
    });

    $(document).on("click", function () {
        $(".wa-msg-menu").removeClass("show");
    });

    $(document).on("click", ".wa-msg-menu-item", function (e) {
        e.stopPropagation();
        const action = $(this).attr("data-action");
        const $message = $(this).closest(".wa-message");
        $(this).closest(".wa-msg-menu").removeClass("show");

        if (action === "reply") {
            wa.reply.set_reply($message);
        } else if (action === "react") {
            $message.find(".wa-reaction-picker").addClass("show");
        } else if (action === "copy") {
            const text = $message.find(".wa-message-text").first().text().trim();
            if (text && navigator.clipboard) {
                navigator.clipboard.writeText(text);
                frappe.show_alert({ message: "Copied", indicator: "green" }, 1.5);
            }
        } else if (action === "delete") {
            $message.fadeOut(150, function () {
                $(this).remove();
            });
        }
    });
};
