// whatsapp.js — thin entry point, wires wa.state and the wa.* modules together
frappe.pages["whatsapp"].on_page_load = function (wrapper) {
    // Check role before loading page
    const allowed_roles = ["CRM"]; // change to your roles
    const user_roles = frappe.user_roles || [];
    const has_access = allowed_roles.some((role) => user_roles.includes(role));

    if (!has_access) {
        $(wrapper).html('<div style="padding:40px;text-align:center;color:#667781;">You do not have permission to access this page.</div>');
        return;
    }

    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: "Whatsapp",
        single_column: true
    });
    $(wrapper).addClass("wa-page");
    page.container.addClass("full-width");

    // wa.state holds everything the modules share, in one place instead of loose closures
    frappe.provide("wa");
    wa.state = {
        active_contact: null,
        active_customer: null,
        selected_file: null,
        temp_file_url: null,
        customer_name_cache: {},
        recipient_name_cache: {},
        user_at_bottom: true,
        message_cache: {},
        heartbeat_interval: null,
        sidebar_sync_interval: null,
        status_sync_interval: null,
        reply_to: null,
        SIM_QUEUE_KEY: "wa_sim_broadcast_queue",
        SIM_MESSAGES_KEY: "wa_sim_messages_by_contact",
        refresh_conversations_timeout: null
    };

    // wa_utils.js, wa_documents.js, wa_templates.js, wa_sidebar.js, wa_messages.js, wa_input.js, wa_realtime.js
    // must be loaded first, via app_include_js in hooks.py or frappe.require
    page.main.html(`
        <div class="wa-container">
            <div class="wa-sidebar">
                <div class="wa-sidebar-header">
                    <h3>Whatsapp</h3>
                </div>
                <div class="wa-search">
                    <input type="text" id="wa-search-input" placeholder="Search or start new chat" />
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
                        <div class="wa-header-subtitle" id="wa-header-subtitle"></div>
                    </div>
                </div>
                <div class="wa-messages-area" id="wa-messages-area">
                    <div class="wa-empty-state" id="wa-empty-state">
                        <svg viewBox="0 0 303 303" fill="none" aria-hidden="true">
                            <path d="M151.5 0C68.8 0 0 68.8 0 151.5c0 27 7 52.3 19.3 74.2L0 303l78.8-19.3c21.9 12.3 47.2 19.3 74.2 19.3 82.7 0 151.5-68.8 151.5-151.5S234.2 0 151.5 0z" fill="currentColor" opacity="0.1"/>
                        </svg>
                        <div>Select a conversation to start messaging</div>
                    </div>
                    <div class="wa-loading" id="wa-loading">Loading messages...</div>
                </div>
                <div class="wa-reply-bar" id="wa-reply-bar">
                    <div class="wa-reply-bar-inner">
                        <div class="wa-reply-bar-text" id="wa-reply-bar-text"></div>
                        <button class="wa-reply-bar-close" id="wa-reply-bar-close" type="button" aria-label="Cancel reply">&times;</button>
                    </div>
                </div>
                <div class="wa-input-area">
                    <button class="wa-attachment-btn" id="wa-attachment-btn" type="button" title="Attach file" aria-label="Attach file">&#43;</button>
                    <input type="file" id="wa-file-input" style="display: none;" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" />
                    <div class="wa-input-wrapper">
                        <button class="wa-emoji-btn" id="wa-emoji-btn" type="button" title="Emoji" aria-label="Emoji">&#9786;</button>
                        <textarea
                            class="wa-message-input"
                            id="wa-message-input"
                            placeholder="Type a message"
                            rows="1"
                        ></textarea>
                        <div class="wa-emoji-picker" id="wa-emoji-picker"></div>
                    </div>
                    <button class="wa-send-btn" id="wa-send-btn" type="button" title="Send" aria-label="Send">&#9654;</button>
                </div>
            </div>
        </div>
        <div class="wa-lightbox" id="wa-lightbox">
            <span class="wa-lightbox-close" onclick="$('#wa-lightbox').fadeOut(200);">×</span>
            <img id="wa-lightbox-img" src="" alt="" />
        </div>
    `);

    // Binds every DOM event this page needs, once
    function setup_event_listeners() {
        $("#wa-messages-area").on("scroll", wa.messages.check_scroll_position);

        $(document).on("click", "#wa-send-btn", wa.input.send_message);

        $(document).on("keydown", "#wa-message-input", function (e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                wa.input.send_message();
            }
        });

        $("#wa-message-input").on("input", function () {
            const hasText = $(this).val().trim().length > 0;
            $("#wa-send-btn").prop("disabled", !hasText);
        });

        $(window).on("beforeunload", wa.realtime.stop_sync_loops);

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) return;

            wa.sidebar.load_recipient_name_cache(() => wa.sidebar.load_conversations());
            if (wa.state.active_contact) {
                wa.messages.load_messages(wa.state.active_contact, true);
            }
        });
    }

    // Auto-resizes the textarea as the user types
    const textarea = $("#wa-message-input");
    textarea.on("input", function () {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 100) + "px";
    });

    $(document).on("click", ".wa-lightbox", function (e) {
        if (e.target === this || $(e.target).hasClass("wa-lightbox-close")) {
            $("#wa-lightbox").fadeOut(200);
            $("#wa-lightbox video").remove();
        }
    });

    $("#wa-back-btn").on("click", function () {
        $(".wa-sidebar").removeClass("hidden");
        wa.state.active_contact = null;
        wa.state.active_customer = null;
        wa.reply.clear_reply();
        wa.contact_panel.close();
        $("#wa-header-name").text("Select a conversation");
        $("#wa-header-subtitle").text("");
        $("#wa-profile-avatar").text("?");
        $("#wa-empty-state").show();
        $("#wa-loading").hide();
        $("#wa-messages-area").html("");
    });

    // Runs once, after every module above has attached itself to wa.*
    function initialize() {
        wa.messages.consume_simulated_broadcast_queue();
        wa.input.init_emoji_picker();
        wa.input.init_attachment();
        wa.reply.bind_events();
        wa.actions.bind_events();
        wa.reactions.bind_events();
        wa.templates.bind_events();
        wa.carousel.bind_events();
        wa.contact_panel.build();
        wa.contact_panel.bind_events();
        setup_event_listeners();
        wa.sidebar.load_recipient_name_cache(() => wa.sidebar.load_conversations());
        wa.realtime.bind_events();
        wa.realtime.start_sync_loops();
        setTimeout(() => wa.messages.scrollToBottom(true), 100);
    }

    initialize();
};
