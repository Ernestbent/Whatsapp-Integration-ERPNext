(function() {
    add_whatsapp_icon();
})();

$(document).ready(add_whatsapp_icon);
$(window).on('load', add_whatsapp_icon);

setTimeout(add_whatsapp_icon, 50);
setTimeout(add_whatsapp_icon, 100);
setTimeout(add_whatsapp_icon, 200);
setTimeout(add_whatsapp_icon, 500);
setTimeout(add_whatsapp_icon, 1000);
setTimeout(add_whatsapp_icon, 1500);
setTimeout(add_whatsapp_icon, 2000);
setTimeout(add_whatsapp_icon, 3000);

let check_count = 0;
const early_checker = setInterval(() => {
    add_whatsapp_icon();
    if (++check_count >= 10) clearInterval(early_checker);
}, 1000);

setInterval(add_whatsapp_icon, 5000);

if (typeof frappe !== 'undefined') {
    frappe.after_ajax(() => {
        add_whatsapp_icon();
        setTimeout(add_whatsapp_icon, 100);
        setTimeout(add_whatsapp_icon, 500);
    });

    if (frappe.router) {
        frappe.router.on('change', () => {
            add_whatsapp_icon();
            setTimeout(add_whatsapp_icon, 100);
        });
    }

    const original_page_show = frappe.ui.Page?.prototype?.show;
    if (original_page_show) {
        frappe.ui.Page.prototype.show = function() {
            original_page_show.apply(this, arguments);
            add_whatsapp_icon();
            setTimeout(add_whatsapp_icon, 200);
        };
    }
}

$(document).on('page-change form-load form-refresh grid-row-render desk-render', add_whatsapp_icon);

if (window.MutationObserver) {
    const observer = new MutationObserver(mutations => {
        let should_check = false;
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        const $node = $(node);
                        if ($node.find('header, .navbar, nav, .navbar-right, .navbar-nav').length ||
                            $node.is('header, .navbar, nav, .navbar-right, .navbar-nav')) {
                            should_check = true;
                        }
                    }
                });
            }
        });
        if (should_check) add_whatsapp_icon();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
}

// Whatsapp Icon Injection
function add_whatsapp_icon() {
    if ($('.whatsapp-icon-container').length > 0) return;
    if (typeof $ === 'undefined' || !document.body) return;

    const navbar_selectors = [
        '.navbar-right', '.navbar-nav', 'header .navbar ul',
        '#navbar-breadcrumbs + ul', 'header nav ul', '.navbar ul', 'nav ul'
    ];

    let navbar_exists = navbar_selectors.some(sel => $(sel).length > 0);
    if (!navbar_exists) return;

    const whatsapp_html = `
        <li class="nav-item dropdown dropdown-mobile whatsapp-icon-container" style="margin-left: 12px; margin-right: 16px;">
            <a class="nav-link" href="#" data-toggle="dropdown" title="WhatsApp Messages">
                <span style="position: relative; display: inline-block;">
                    <i class="fa fa-whatsapp" style="font-size: 22px; color: #25D366;"></i>
                    <span class="badge badge-danger whatsapp-count-badge"
                          style="position: absolute; top: -10px; right: -10px; display: none;
                                 background: #dc3545; color: white; border-radius: 50%; width: 20px; height: 20px;
                                 font-size: 11px; line-height: 20px; font-weight: bold; text-align: center;">
                        0
                    </span>
                </span>
            </a>
            <div class="dropdown-menu dropdown-menu-right whatsapp-dropdown shadow-lg border-0"
                 style="min-width: 370px; max-width: 430px; margin-top: 10px; border-radius: 14px; overflow: hidden;">
                <div style="padding: 14px 18px; background: #f8f9fa; border-bottom: 1px solid #eee; font-weight: 600; font-size: 15px;">
                    <i class="fa fa-whatsapp" style="color: #25D366; margin-right: 8px;"></i>
                    WhatsApp Messages
                </div>
                <div class="whatsapp-messages-container" style="max-height: 420px; overflow-y: auto; background: white;">
                    <div class="text-center text-muted py-5">
                        <i class="fa fa-spinner fa-spin fa-2x mb-3"></i>
                        <p class="mb-0">Loading...</p>
                    </div>
                </div>
                <div style="padding: 12px 18px; background: #f8f9fa; border-top: 1px solid #eee; text-align: center;">
                    <a href="/app/whatsapp-live-chat" class="whatsapp-view-all" style="color: #25D366; font-weight: 500; text-decoration: none; font-size: 14px;">
                        View All Chats
                    </a>
                </div>
            </div>
        </li>
    `;

    let inserted = false;
    const targets = ['.navbar-right', '.navbar-nav', 'header nav ul', '.navbar ul', 'nav ul'];
    for (let sel of targets) {
        const $target = $(sel);
        if ($target.length) {
            $target.append(whatsapp_html);
            inserted = true;
            break;
        }
    }
    if (!inserted) {
        $('header nav ul, .navbar ul').first().append(whatsapp_html);
    }

    $('.whatsapp-icon-container .nav-link').off('click.wa').on('click.wa', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const $container = $('.whatsapp-icon-container');
        const $dropdown = $('.whatsapp-dropdown');
        
        // Toggle open state
        $container.toggleClass('open');
        $dropdown.toggleClass('show');
        
        if ($container.hasClass('open')) {
            update_whatsapp_notifications();
        }
        
        handle_whatsapp_dropdown_position();
    });

    update_whatsapp_notifications();
    if (window.whatsapp_update_interval) clearInterval(window.whatsapp_update_interval);
    window.whatsapp_update_interval = setInterval(update_whatsapp_notifications, 30000);

    handle_whatsapp_dropdown_position();
}

// Responsive Dropdown Positioning
function handle_whatsapp_dropdown_position() {
    const $dropdown = $('.whatsapp-icon-container .dropdown-menu');
    if (!$dropdown.length) return;

    if (window.innerWidth >= 992) {
        $dropdown.css({ right: '12px', left: 'auto', top: '100%', transform: 'none' });
    } else {
        $dropdown.css({
            position: 'fixed', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90vw', maxWidth: '420px', maxHeight: '80vh',
            borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
        });
    }
}

$(window).on('resize', frappe.utils.debounce(handle_whatsapp_dropdown_position, 200));
$(document).ready(handle_whatsapp_dropdown_position);

// Notifications Update
function update_whatsapp_notifications() {
    if (typeof frappe === 'undefined') return;

    frappe.call({
        method: "frappe.client.get_count",
        args: { doctype: "Whatsapp Message", filters: { custom_status: "Incoming", custom_read: 0 } },
        callback: r => {
            const count = r.message || 0;
            const $badge = $('.whatsapp-count-badge');
            if (count > 0) $badge.text(count > 99 ? "99+" : count).show();
            else $badge.hide();
        }
    });

    frappe.call({
        method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.api_fetch_message.get_unread_messages",
        callback: r => {
            const messages = r.message || [];
            render_whatsapp_messages(messages);
            // Update timestamps for Live Chat documents when messages are received
            if (messages.length > 0) {
                process_incoming_messages(messages);
            }
        },
        error: () => {
            $('.whatsapp-messages-container').html(`
                <div class="text-center text-muted py-5">
                    <i class="fa fa-exclamation-triangle fa-2x text-danger mb-3"></i>
                    <p>Failed to load messages</p>
                </div>
            `);
        }
    });
}

// Create WhatsApp Live Chat for new contact
function create_whatsapp_live_chat(contact_number) {
    return new Promise((resolve, reject) => {
        // Format contact name as "Unknown-" followed by complete number
        const contact_name = "Unknown-" + contact_number;
        
        frappe.call({
            method: "frappe.client.insert",
            args: {
                doc: {
                    doctype: "Whatsapp Live Chat",
                    contact: contact_number,
                    contact_name: contact_name
                }
            },
            callback: r => {
                if (r.message) {
                    console.log("Created new WhatsApp Live Chat:", r.message.name);
                    resolve(r.message.name);
                } else {
                    reject("Failed to create chat");
                }
            },
            error: err => {
                console.error("Error creating WhatsApp Live Chat:", err);
                reject(err);
            }
        });
    });
}

// Check and create Live Chat if needed
function ensure_live_chat_exists(contact_number) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Whatsapp Live Chat",
                filters: { contact: contact_number },
                fields: ["name"],
                limit: 1
            },
            callback: r => {
                if (r.message && r.message.length > 0) {
                    // Chat exists
                    resolve(r.message[0].name);
                } else {
                    // Create new chat
                    create_whatsapp_live_chat(contact_number)
                        .then(chat_name => resolve(chat_name))
                        .catch(err => reject(err));
                }
            },
            error: err => reject(err)
        });
    });
}

// Render Messages
function render_whatsapp_messages(messages) {
    const container = $('.whatsapp-messages-container');
    if (!messages || messages.length === 0) {
        container.html(`<div class="text-center text-muted py-5">
            <i class="fa fa-whatsapp fa-4x mb-3" style="color:#25D366; opacity:0.3;"></i>
            <p>No unread messages</p>
        </div>`);
        return;
    }

    const grouped = {};
    messages.forEach(msg => {
        const num = msg.from_number || "Unknown";
        if (!grouped[num]) grouped[num] = {
            messages: [], 
            contact_name: msg.contact_name || ("Unknown-" + num),
            live_chat_name: msg.live_chat_name, 
            latest_time: msg.creation
        };
        grouped[num].messages.push(msg);
        if (msg.creation > grouped[num].latest_time) grouped[num].latest_time = msg.creation;
    });

    const sorted = Object.keys(grouped)
        .map(num => ({ from_number: num, data: grouped[num] }))
        .sort((a, b) => new Date(b.data.latest_time) - new Date(a.data.latest_time));

    let html = '';
    sorted.forEach(group => {
        const d = group.data;
        const latest = d.messages.sort((a,b)=> new Date(b.creation)-new Date(a.creation))[0];
        const text = (latest.message||"").substring(0,70) + ((latest.message||"").length>70?"...":"");
        const time = frappe.datetime.comment_when(d.latest_time);
        
        // Generate onclick handler that ensures chat exists
        const onclick_handler = `event.preventDefault(); event.stopPropagation(); handle_chat_click('${group.from_number}', '${d.live_chat_name || ''}');`;

        html += `<a href="#" class="d-block px-4 py-3 text-decoration-none border-bottom position-relative whatsapp-chat-link"
            onclick="${onclick_handler}"
            onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">
            <div class="d-flex align-items-center justify-content-between mb-1">
                <strong style="font-size:14px;">${frappe.utils.escape_html(d.contact_name)}</strong>
                <small class="text-muted">${time}</small>
            </div>
            <div class="text-muted small" style="padding-left:4px;">${frappe.utils.escape_html(text)}</div>
            ${d.messages.length>1?`<span class="badge badge-success position-absolute" style="top:14px; right:16px;">${d.messages.length}</span>`:""}
        </a>`;
    });
    container.html(html);
}

// Handle chat click - ensure Live Chat exists before navigating
window.handle_chat_click = function(contact_number, existing_chat_name) {
    // Close dropdown immediately
    $('.whatsapp-icon-container').removeClass('open');
    $('.whatsapp-dropdown').removeClass('show');
    
    if (existing_chat_name) {
        // Chat already exists, navigate directly
        setTimeout(() => {
            frappe.set_route('whatsapp-live-chat', existing_chat_name);
        }, 100);
    } else {
        // Check if chat exists or create new one
        frappe.show_alert({message: __('Opening chat...'), indicator: 'blue'}, 3);
        
        ensure_live_chat_exists(contact_number)
            .then(chat_name => {
                frappe.set_route('whatsapp-live-chat', chat_name);
            })
            .catch(err => {
                frappe.show_alert({
                    message: __('Failed to open chat. Please try again.'),
                    indicator: 'red'
                }, 5);
                console.error("Error ensuring live chat exists:", err);
            });
    }
};

// Autoclose dropdown
$(document).on('click', '.whatsapp-view-all', function(e) {
    e.preventDefault();
    $('.whatsapp-icon-container').removeClass('open');
    $('.whatsapp-dropdown').removeClass('show');
    
    // Navigate after closing dropdown
    setTimeout(() => {
        frappe.set_route('whatsapp-live-chat');
    }, 100);
});

// Also close dropdown when clicking outside
$(document).on('click', function(e) {
    if (!$(e.target).closest('.whatsapp-icon-container').length) {
        $('.whatsapp-icon-container').removeClass('open');
        $('.whatsapp-dropdown').removeClass('show');
    }
});

if (typeof frappe !== 'undefined' && frappe.router) {
    frappe.router.on('change', () => {
        $('.whatsapp-icon-container').removeClass('open');
        $('.whatsapp-dropdown').removeClass('show');
    });
}

// Update WhatsApp Live Chat timestamp and unread count when new message is received
function update_live_chat_timestamp(contact_number, unread_count) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Whatsapp Live Chat",
                filters: { contact: contact_number }
            },
            callback: r => {
                if (r.message) {
                    const doc = r.message;
                    
                    // Update unread count if field exists, then save
                    if (unread_count !== undefined) {
                        doc.unread_count = unread_count;
                    }
                    
                    // Trigger save to update modified timestamp and unread count
                    frappe.call({
                        method: "frappe.client.save",
                        args: {
                            doc: doc
                        },
                        callback: () => {
                            console.log("Updated timestamp and unread count for chat:", doc.name);
                            resolve(doc.name);
                        },
                        error: err => {
                            console.error("Error updating timestamp:", err);
                            reject(err);
                        }
                    });
                } else {
                    resolve(null);
                }
            },
            error: err => reject(err)
        });
    });
}

// Process incoming messages and update timestamps
function process_incoming_messages(messages) {
    if (!messages || messages.length === 0) return;
    
    // Group messages by contact and count unread messages for each
    const contact_data = {};
    messages.forEach(msg => {
        const contact = msg.from_number;
        if (!contact) return;
        
        if (!contact_data[contact]) {
            contact_data[contact] = {
                latest_time: msg.creation,
                unread_count: 0
            };
        }
        
        if (msg.creation > contact_data[contact].latest_time) {
            contact_data[contact].latest_time = msg.creation;
        }
        
        // Count unread messages
        if (msg.custom_read === 0 || msg.custom_read === "0") {
            contact_data[contact].unread_count++;
        }
    });
    
    // Update timestamp and unread count for each contact's Live Chat
    Object.keys(contact_data).forEach(contact => {
        update_live_chat_timestamp(contact, contact_data[contact].unread_count);
    });
}

// Open Chat Marks Messages
frappe.ui.form.on("Whatsapp Live Chat", "refresh", function(frm) {
    // Mark unread messages read when opening existing chat
    if (!frm.is_new() && frm.doc.contact) {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Whatsapp Message",
                filters: { from_number: frm.doc.contact, custom_status: "Incoming", custom_read: 0 },
                fields: ["name"]
            },
            callback: r => {
                if (r.message && r.message.length) {
                    Promise.all(r.message.map(m =>
                        frappe.call({
                            method: "frappe.client.set_value",
                            args: { doctype: "Whatsapp Message", name: m.name, fieldname: "custom_read", value: 1 }
                        })
                    )).then(() => {
                        // Reset unread count to 0 after marking messages as read
                        if (frm.doc.unread_count && frm.doc.unread_count > 0) {
                            frm.set_value('unread_count', 0);
                            frm.save();
                        }
                        
                        if (typeof update_whatsapp_notifications === "function") {
                            update_whatsapp_notifications(); 
                        }
                    });
                }
            }
        });
    }
});