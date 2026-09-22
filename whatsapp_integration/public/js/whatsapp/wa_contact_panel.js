// wa.contact_panel — slide-in contact detail panel, opened by clicking the chat header
frappe.provide("wa.contact_panel");

// Injects the panel markup once, appended inside .wa-chat-area
wa.contact_panel.build = function () {
    if ($("#wa-contact-panel").length) return;
    const html = `<div class="wa-contact-panel" id="wa-contact-panel" aria-hidden="true">
        <div class="wa-contact-panel-header">
            <span class="wa-contact-panel-close" id="wa-contact-panel-close">&#8592;</span>
            <span>Contact info</span>
        </div>
        <div class="wa-contact-panel-body">
            <div class="wa-contact-panel-avatar" id="wa-contact-panel-avatar">?</div>
            <div class="wa-contact-panel-name" id="wa-contact-panel-name">Select a conversation</div>
            <div class="wa-contact-panel-row">
                <div class="wa-contact-panel-label">Phone</div>
                <div class="wa-contact-panel-value" id="wa-contact-panel-phone">-</div>
            </div>
        </div>
    </div>`;
    $(".wa-chat-area").append(html);

    $("#wa-contact-panel-close").on("click", wa.contact_panel.close);
};

// Fills the panel from wa.state and slides it in
wa.contact_panel.open = function () {
    if (!wa.state.active_contact) return;

    const name = wa.state.active_customer || wa.utils.format_phone_display(wa.state.active_contact);
    $("#wa-contact-panel-name").text(name);
    $("#wa-contact-panel-avatar").text(name.charAt(0).toUpperCase());
    $("#wa-contact-panel-phone").text(wa.utils.format_phone_display(wa.state.active_contact));

    $("#wa-contact-panel").addClass("show").attr("aria-hidden", "false");
};

wa.contact_panel.close = function () {
    $("#wa-contact-panel").removeClass("show").attr("aria-hidden", "true");
};

// Opens the panel when the header (but not the back button) is clicked
wa.contact_panel.bind_events = function () {
    $(document).on("click", ".wa-chat-header", function (e) {
        if ($(e.target).closest("#wa-back-btn").length) return;
        wa.contact_panel.open();
    });
};
