$(document).ready(function() {
    // Wait for Frappe to be fully loaded
    frappe.after_ajax(function() {
        setTimeout(function() {
            console.log("Attempting to add WhatsApp icon...");
            add_whatsapp_icon();
        }, 1000);
    });
});

function add_whatsapp_icon() {
    // Check if icon already exists to prevent duplicates
    if ($('.whatsapp-icon-container').length) {
        console.log("WhatsApp icon already exists");
        return;
    }

    console.log("Adding WhatsApp icon to navbar");

    // Create the WhatsApp icon HTML
    const whatsapp_html = `
        <li class="nav-item dropdown dropdown-mobile whatsapp-icon-container">
            <a class="nav-link" 
               href="#" 
               data-toggle="dropdown" 
               aria-haspopup="true" 
               aria-expanded="false"
               title="WhatsApp Messages">
                <span style="position: relative; display: inline-block;">
                    <i class="fa fa-whatsapp" style="font-size: 20px; color: #25D366;"></i>
                    <span class="badge badge-danger whatsapp-count-badge" 
                          style="position: absolute; top: -8px; right: -8px; display: none; 
                                 background-color: #DC3545; border-radius: 10px; 
                                 padding: 2px 6px; font-size: 10px; min-width: 18px;">
                        0
                    </span>
                </span>
            </a>
            <div class="dropdown-menu dropdown-menu-right" style="min-width: 350px; max-width: 400px;">
                <div style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600; font-size: 14px;">
                        <i class="fa fa-whatsapp" style="color: #25D366; margin-right: 5px;"></i>
                        WhatsApp Messages
                    </span>
                </div>
                <div class="whatsapp-messages-container" style="max-height: 400px; overflow-y: auto;">
                    <div class="text-center text-muted" style="padding: 40px 20px;">
                        <i class="fa fa-spinner fa-spin" style="font-size: 24px;"></i>
                        <p style="margin-top: 10px;">Loading...</p>
                    </div>
                </div>
                <div style="padding: 10px 16px; border-top: 1px solid #e0e0e0; text-align: center;">
                    <a href="/app/whatsapp-message" style="color: #25D366; font-size: 13px; text-decoration: none;">
                        View All Messages →
                    </a>
                </div>
            </div>
        </li>
    `;

    // Try multiple possible locations to insert the icon
    const possible_locations = [
        '.navbar-right',
        '.navbar-nav',
        'header .navbar ul',
        '#navbar-breadcrumbs + ul',
        '.dropdown-help'
    ];

    let inserted = false;
    for (let selector of possible_locations) {
        const target = $(selector).first();
        if (target.length) {
            console.log("Found navbar location:", selector);
            // Try to insert before the help dropdown or at the end
            const help_dropdown = target.find('.dropdown-help');
            if (help_dropdown.length) {
                help_dropdown.before(whatsapp_html);
            } else {
                target.append(whatsapp_html);
            }
            inserted = true;
            break;
        }
    }

    if (!inserted) {
        console.error("Could not find navbar location. Available elements:", $('header').html());
        // Fallback: append to any navbar
        $('header nav ul').first().append(whatsapp_html);
    }

    console.log("WhatsApp icon added successfully");

    // Update notifications immediately
    update_whatsapp_notifications();

    // Refresh every 30 seconds
    setInterval(update_whatsapp_notifications, 30000);

    // Refresh when dropdown is opened
    $('.whatsapp-icon-container .nav-link').on('click', function(e) {
        e.preventDefault();
        update_whatsapp_notifications();
    });
}

function update_whatsapp_notifications() {
    console.log("Updating WhatsApp notifications...");
    
    // Get unread count
    frappe.call({
        method: "frappe.client.get_count",
        args: {
            doctype: "Whatsapp Message",
            filters: {
                custom_status: "Incoming",
                custom_read: 0
            }
        },
        callback: function(r) {
            const count = r.message || 0;
            console.log("Unread WhatsApp messages:", count);
            
            const badge = $('.whatsapp-count-badge');
            if (count > 0) {
                badge.text(count).show();
            } else {
                badge.hide();
            }
        },
        error: function(r) {
            console.error("Error getting WhatsApp count:", r);
        }
    });

    // Get recent messages with live chat links
    frappe.call({
        method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.api_fetch_message.get_unread_messages",
        callback: function(r) {
            const messages = r.message || [];
            console.log("WhatsApp messages loaded:", messages.length);
            render_whatsapp_messages(messages);
        },
        error: function(r) {
            console.error("Error getting WhatsApp messages:", r);
            $('.whatsapp-messages-container').html(`
                <div class="text-center text-muted" style="padding: 40px 20px;">
                    <i class="fa fa-exclamation-triangle" style="font-size: 24px; color: #DC3545;"></i>
                    <p style="margin-top: 10px;">Error loading messages</p>
                </div>
            `);
        }
    });
}

function render_whatsapp_messages(messages) {
    const container = $('.whatsapp-messages-container');
    
    if (!messages || messages.length === 0) {
        container.html(`
            <div class="text-center text-muted" style="padding: 40px 20px;">
                <i class="fa fa-whatsapp" style="font-size: 48px; color: #25D366; opacity: 0.3;"></i>
                <p style="margin-top: 10px;">No unread messages</p>
            </div>
        `);
        return;
    }

    let html = '<div style="padding: 8px 0;">';
    
    messages.forEach(function(msg) {
        const message_text = msg.message || "";
        const truncated = message_text.length > 70 ? message_text.substring(0, 70) + "..." : message_text;
        const contact = msg.contact_name || msg.from_number || "Unknown";
        const time = frappe.datetime.comment_when(msg.creation);
        
        // Link to Whatsapp Live Chat if available, otherwise to the message
        const link_url = msg.live_chat_name 
            ? `/app/whatsapp-live-chat/${msg.live_chat_name}` 
            : `/app/whatsapp-message/${msg.name}`;

        html += `
            <a href="${link_url}" 
               class="whatsapp-message-item"
               onclick="mark_whatsapp_read('${msg.name}'); return true;"
               style="display: block; padding: 12px 16px; text-decoration: none; 
                      color: inherit; border-bottom: 1px solid #f0f0f0; 
                      transition: background-color 0.2s;"
               onmouseover="this.style.backgroundColor='#f5f5f5'" 
               onmouseout="this.style.backgroundColor='white'">
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <i class="fa fa-whatsapp" style="color: #25D366; margin-right: 8px; font-size: 16px;"></i>
                    <span style="font-weight: 600; font-size: 13px; flex: 1;">${contact}</span>
                    <span style="font-size: 11px; color: #999;">${time}</span>
                </div>
                <div style="padding-left: 24px; font-size: 12px; color: #666; line-height: 1.4;">
                    ${truncated}
                </div>
            </a>
        `;
    });
    
    html += '</div>';
    container.html(html);
}

function mark_whatsapp_read(message_name) {
    frappe.call({
        method: "frappe.client.set_value",
        args: {
            doctype: "Whatsapp Message",
            name: message_name,
            fieldname: "custom_read",
            value: 1
        },
        callback: function() {
            setTimeout(update_whatsapp_notifications, 100);
        }
    });
}

// Log when script loads
console.log("WhatsApp notification script loaded successfully");