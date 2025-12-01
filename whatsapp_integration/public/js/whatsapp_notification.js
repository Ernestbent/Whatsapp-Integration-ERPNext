(function() {
    add_whatsapp_icon();
})();

// Run on DOM ready
$(document).ready(function() {
    add_whatsapp_icon();
});

// Run on window load
$(window).on('load', function() {
    add_whatsapp_icon();
});

// Run after multiple delays
setTimeout(add_whatsapp_icon, 50);
setTimeout(add_whatsapp_icon, 100);
setTimeout(add_whatsapp_icon, 200);
setTimeout(add_whatsapp_icon, 500);
setTimeout(add_whatsapp_icon, 1000);
setTimeout(add_whatsapp_icon, 1500);
setTimeout(add_whatsapp_icon, 2000);
setTimeout(add_whatsapp_icon, 3000);

// Keep checking every second for the first 10 seconds
let check_count = 0;
const early_checker = setInterval(function() {
    add_whatsapp_icon();
    check_count++;
    if (check_count >= 10) {
        clearInterval(early_checker);
    }
}, 1000);

// Continue checking every 5 seconds forever (in case navbar disappears/reappears)
setInterval(add_whatsapp_icon, 5000);

// Hook into ALL Frappe events
if (typeof frappe !== 'undefined') {
    // After AJAX
    frappe.after_ajax(function() {
        add_whatsapp_icon();
        setTimeout(add_whatsapp_icon, 100);
        setTimeout(add_whatsapp_icon, 500);
        setTimeout(add_whatsapp_icon, 1000);
    });
    
    // Route changes
    if (frappe.router) {
        frappe.router.on('change', function() {
            add_whatsapp_icon();
            setTimeout(add_whatsapp_icon, 100);
            setTimeout(add_whatsapp_icon, 500);
        });
    }
    
    // Page render
    frappe.ui.pages = frappe.ui.pages || {};
    const original_page_show = frappe.ui.Page && frappe.ui.Page.prototype.show;
    if (original_page_show) {
        frappe.ui.Page.prototype.show = function() {
            original_page_show.apply(this, arguments);
            add_whatsapp_icon();
            setTimeout(add_whatsapp_icon, 200);
        };
    }
}

// jQuery events
$(document).on('page-change', add_whatsapp_icon);
$(document).on('form-load', add_whatsapp_icon);
$(document).on('form-refresh', add_whatsapp_icon);
$(document).on('grid-row-render', add_whatsapp_icon);
$(document).on('desk-render', add_whatsapp_icon);

// Watch for DOM changes using MutationObserver
if (window.MutationObserver) {
    const observer = new MutationObserver(function(mutations) {
        let should_check = false;
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                        const $node = $(node);
                        if ($node.find('header, .navbar, nav, .navbar-right, .navbar-nav').length > 0 || 
                            $node.is('header, .navbar, nav, .navbar-right, .navbar-nav')) {
                            should_check = true;
                        }
                    }
                });
            }
        });
        if (should_check) {
            add_whatsapp_icon();
        }
    });
    
    // Start observing the entire document
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

// Whatsapp MAin Funciton and Icon
function add_whatsapp_icon() {
    // Check if icon already exists
    if ($('.whatsapp-icon-container').length > 0) {
        return;
    }

    // Make sure jQuery and page are ready
    if (typeof $ === 'undefined' || !document.body) {
        return;
    }

    // Check if navbar exists
    const navbar_selectors = [
        '.navbar-right',
        '.navbar-nav',
        'header .navbar ul',
        '#navbar-breadcrumbs + ul',
        'header nav ul',
        '.navbar ul',
        'nav ul'
    ];
    
    let navbar_exists = false;
    for (let selector of navbar_selectors) {
        if ($(selector).length > 0) {
            navbar_exists = true;
            break;
        }
    }
    
    if (!navbar_exists) {
        return; // Navbar not ready yet, will retry automatically
    }

    console.log("🟢 Adding WhatsApp icon to navbar");

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
                    <a href="/app/whatsapp-live-chat" style="color: #25D366; font-size: 13px; text-decoration: none;">
                        View All Chats →
                    </a>
                </div>
            </div>
        </li>
    `;

    // Try multiple locations in order of preference
    const possible_locations = [
        '.navbar-right',
        '.navbar-nav',
        'header .navbar ul',
        '#navbar-breadcrumbs + ul',
        '.dropdown-help',
        'header nav ul',
        '.navbar ul',
        'nav ul'
    ];

    let inserted = false;
    for (let selector of possible_locations) {
        const target = $(selector).first();
        if (target.length) {
            console.log("✅ Found navbar location:", selector);
            
            // Try to insert before help dropdown if it exists
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
        console.log("⚠️ Using fallback insertion method");
        $('header nav ul, .navbar ul, nav ul').first().append(whatsapp_html);
    }

    console.log("✅ WhatsApp icon added successfully!");

    // Setup click handler for dropdown
    $('.whatsapp-icon-container .nav-link').on('click', function(e) {
        e.preventDefault();
        $('.whatsapp-icon-container').toggleClass('open');
        update_whatsapp_notifications();
    });

    // Start updating notifications
    update_whatsapp_notifications();
    
    // Clear any existing interval and start new one
    if (window.whatsapp_update_interval) {
        clearInterval(window.whatsapp_update_interval);
    }
    window.whatsapp_update_interval = setInterval(update_whatsapp_notifications, 30000);
}

// Update Whatsapp Notifications
function update_whatsapp_notifications() {
    if (typeof frappe === 'undefined') {
        return;
    }

    console.log("🔄 Updating WhatsApp notifications...");

    // Update unread count
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
            console.log("📬 Unread WhatsApp messages:", count);
            const badge = $('.whatsapp-count-badge');
            if (count > 0) {
                badge.text(count > 99 ? "99+" : count).show();
            } else {
                badge.hide();
            }
        }
    });

    // Load recent messages
    frappe.call({
        method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.api_fetch_message.get_unread_messages",
        callback: function(r) {
            const messages = r.message || [];
            console.log("📨 WhatsApp messages loaded:", messages.length);
            render_whatsapp_messages(messages);
        },
        error: function(r) {
            console.error("❌ Error loading messages:", r);
            $('.whatsapp-messages-container').html(`
                <div class="text-center text-muted" style="padding: 40px 20px;">
                    <i class="fa fa-exclamation-triangle" style="font-size: 24px; color: #DC3545;"></i>
                    <p>Error loading messages</p>
                </div>
            `);
        }
    });
}

// Show Messages Grouped by Number
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

    // Group messages by from_number
    const grouped = {};
    messages.forEach(function(msg) {
        const from_number = msg.from_number || "Unknown";
        if (!grouped[from_number]) {
            grouped[from_number] = {
                messages: [],
                contact_name: msg.contact_name || msg.from_number || "Unknown",
                live_chat_name: msg.live_chat_name,
                latest_time: msg.creation
            };
        }
        grouped[from_number].messages.push(msg);
        // Keep track of the latest message time
        if (msg.creation > grouped[from_number].latest_time) {
            grouped[from_number].latest_time = msg.creation;
        }
    });

    // Convert to array and sort by latest message time
    const grouped_array = Object.keys(grouped).map(function(from_number) {
        return {
            from_number: from_number,
            data: grouped[from_number]
        };
    }).sort(function(a, b) {
        return new Date(b.data.latest_time) - new Date(a.data.latest_time);
    });

    let html = '<div style="padding: 8px 0;">';
    grouped_array.forEach(function(group) {
        const data = group.data;
        const message_count = data.messages.length;
        const latest_msg = data.messages[data.messages.length - 1];
        const message_text = latest_msg.message || "";
        const truncated = message_text.length > 70 ? message_text.substring(0, 70) + "..." : message_text;
        const contact = data.contact_name;
        const time = frappe.datetime.comment_when(data.latest_time);
        const link_url = data.live_chat_name
            ? `/app/whatsapp-live-chat/${data.live_chat_name}`
            : `/app/whatsapp-message/${latest_msg.name}`;

        html += `
            <a href="${link_url}"
               class="whatsapp-message-item"
               onclick="mark_all_whatsapp_read_for_number('${group.from_number}'); return true;"
               style="display: block; padding: 12px 16px; text-decoration: none;
                      color: inherit; border-bottom: 1px solid #f0f0f0;
                      transition: background-color 0.2s;"
               onmouseover="this.style.backgroundColor='#f5f5f5'"
               onmouseout="this.style.backgroundColor='white'">
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <i class="fa fa-whatsapp" style="color: #25D366; margin-right: 8px; font-size: 16px;"></i>
                    <span style="font-weight: 600; font-size: 13px; flex: 1;">${contact}</span>
                    ${message_count > 1 ? `<span style="background-color: #25D366; color: white; border-radius: 10px; padding: 2px 8px; font-size: 11px; margin-right: 8px; font-weight: 600;">${message_count}</span>` : ''}
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

// Mark Message as read
function mark_whatsapp_read(message_name) {
    if (typeof frappe === 'undefined') {
        return;
    }
    
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

// Mark all messages from a number as read
function mark_all_whatsapp_read_for_number(from_number) {
    if (typeof frappe === 'undefined') {
        return;
    }
    
    // Try to use custom server method first (more efficient)
    frappe.call({
        method: "whatsapp_integration.whatsapp_integration.custom_scripts.mark_read.mark_all_read_by_number",
        args: {
            from_number: from_number
        },
        callback: function(r) {
            setTimeout(update_whatsapp_notifications, 100);
        },
        error: function() {
            // Fallback: Get all unread messages and mark them individually
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Whatsapp Message",
                    filters: {
                        from_number: from_number,
                        custom_status: "Incoming",
                        custom_read: 0
                    },
                    fields: ["name"]
                },
                callback: function(r) {
                    if (r.message && r.message.length > 0) {
                        // Mark each message as read
                        const promises = r.message.map(function(msg) {
                            return frappe.call({
                                method: "frappe.client.set_value",
                                args: {
                                    doctype: "Whatsapp Message",
                                    name: msg.name,
                                    fieldname: "custom_read",
                                    value: 1
                                }
                            });
                        });
                        
                        // Wait for all to complete, then refresh notiifcations
                        Promise.all(promises).then(function() {
                            setTimeout(update_whatsapp_notifications, 100);
                        });
                    }
                }
            });
        }
    });
}