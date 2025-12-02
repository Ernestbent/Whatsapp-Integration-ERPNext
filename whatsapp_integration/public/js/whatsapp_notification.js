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

function add_whatsapp_icon() {
    if ($('.whatsapp-icon-container').length > 0) return;
    if (typeof $ === 'undefined' || !document.body) return;

    const navbar_selectors = [
        '.navbar-right', '.navbar-nav', 'header .navbar ul',
        '#navbar-breadcrumbs + ul', 'header nav ul', '.navbar ul', 'nav ul'
    ];
    let navbar_exists = navbar_selectors.some(sel => $(sel).length > 0);
    if (!navbar_exists) return;

    console.log("Adding WhatsApp icon to navbar");

    const whatsapp_html = `
        <li class="nav-item dropdown dropdown-mobile whatsapp-icon-container">
            <a class="nav-link" href="#" data-toggle="dropdown" title="WhatsApp Messages">
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
                <div style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0; font-weight: 600; font-size: 14px;">
                    <i class="fa fa-whatsapp" style="color: #25D366; margin-right: 5px;"></i>
                    WhatsApp Messages
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

    const possible_locations = [
        '.navbar-right', '.navbar-nav', 'header .navbar ul',
        '#navbar-breadcrumbs + ul', '.dropdown-help', 'header nav ul', '.navbar ul', 'nav ul'
    ];

    let inserted = false;
    for (let selector of possible_locations) {
        const target = $(selector).first();
        if (target.length) {
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
        $('header nav ul, .navbar ul, nav ul').first().append(whatsapp_html);
    }

    $('.whatsapp-icon-container .nav-link').on('click', function(e) {
        e.preventDefault();
        $('.whatsapp-icon-container').toggleClass('open');
        update_whatsapp_notifications();
    });

    update_whatsapp_notifications();
    if (window.whatsapp_update_interval) clearInterval(window.whatsapp_update_interval);
    window.whatsapp_update_interval = setInterval(update_whatsapp_notifications, 30000);
}

function update_whatsapp_notifications() {
    if (typeof frappe === 'undefined') return;

    // Update badge
    frappe.call({
        method: "frappe.client.get_count",
        args: {
            doctype: "Whatsapp Message",
            filters: { custom_status: "Incoming", custom_read: 0 }
        },
        callback: r => {
            const count = r.message || 0;
            const badge = $('.whatsapp-count-badge');
            if (count > 0) {
                badge.text(count > 99 ? "99+" : count).show();
            } else {
                badge.hide();
            }
        }
    });

    // Load messages
    frappe.call({
        method: "whatsapp_integration.erpnext_whatsapp.custom_scripts.api_fetch_message.get_unread_messages",
        callback: r => render_whatsapp_messages(r.message || []),
        error: () => {
            $('.whatsapp-messages-container').html(`
                <div class="text-center text-muted" style="padding: 40px 20px;">
                    <i class="fa fa-exclamation-triangle" style="font-size: 24px; color: #DC3545;"></i>
                    <p>Error loading messages</p>
                </div>
            `);
        }
    });
}

// FIXED: NOW SHOWS LATEST MESSAGE AS PREVIEW
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

    const grouped = {};
    messages.forEach(msg => {
        const num = msg.from_number || "Unknown";
        if (!grouped[num]) {
            grouped[num] = {
                messages: [],
                contact_name: msg.contact_name || num,
                live_chat_name: msg.live_chat_name,
                latest_time: msg.creation
            };
        }
        grouped[num].messages.push(msg);
        // Update latest_time if this message is newer
        if (msg.creation > grouped[num].latest_time) {
            grouped[num].latest_time = msg.creation;
        }
    });

    const sorted = Object.keys(grouped)
        .map(num => ({ from_number: num, data: grouped[num] }))
        .sort((a, b) => new Date(b.data.latest_time) - new Date(a.data.latest_time));

    let html = '<div style="padding: 8px 0;">';
    sorted.forEach(group => {
        const d = group.data;
        const count = d.messages.length;
        
        // FIXED: Sort messages by creation date and get the LATEST one
        const sorted_messages = d.messages.sort((a, b) => new Date(b.creation) - new Date(a.creation));
        const latest = sorted_messages[0]; // Now gets the most recent message
        
        const text = (latest.message || "").substring(0, 70) + ((latest.message || "").length > 70 ? "..." : "");
        const time = frappe.datetime.comment_when(d.latest_time);

        // SMART URL THAT CREATES CHAT IF MISSING
        const smart_url = d.live_chat_name
            ? `/app/whatsapp-live-chat/${d.live_chat_name}`
            : `/app/whatsapp-live-chat/new?contact=${encodeURIComponent(group.from_number)}`;

        html += `
            <a href="${smart_url}"
               class="whatsapp-message-item"
               onclick="mark_all_whatsapp_read_for_number('${group.from_number}');"
               style="display: block; padding: 12px 16px; text-decoration: none; color: inherit;
                      border-bottom: 1px solid #f0f0f0; transition: background-color 0.2s;"
               onmouseover="this.style.backgroundColor='#f5f5f5'"
               onmouseout="this.style.backgroundColor='white'">
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <i class="fa fa-whatsapp" style="color: #25D366; margin-right: 8px; font-size: 16px;"></i>
                    <span style="font-weight: 600; font-size: 13px; flex: 1;">${frappe.utils.escape_html(d.contact_name)}</span>
                    ${count > 1 ? `<span style="background-color: #25D366; color: white; border-radius: 10px; padding: 2px 8px; font-size: 11px; margin-right: 8px; font-weight: 600;">${count}</span>` : ''}
                    <span style="font-size: 11px; color: #999;">${time}</span>
                </div>
                <div style="padding-left: 24px; font-size: 12px; color: #666; line-height: 1.4;">
                    ${frappe.utils.escape_html(text)}
                </div>
            </a>
        `;
    });
    html += '</div>';
    container.html(html);
}

// AUTO-FILL CONTACT WHEN OPENING FROM BUBBLE
frappe.ui.form.on("Whatsapp Live Chat", "refresh", function(frm) {
    if (frm.is_new() && frappe.route_options?.contact) {
        const num = frappe.route_options.contact;
        frm.set_value("contact", num);
        frm.set_value("contact_name", "WhatsApp " + num.slice(-10));
        delete frappe.route_options.contact;
        frm.dirty();
    }
});

// Your existing mark read functions (unchanged)
function mark_whatsapp_read(message_name) {
    if (typeof frappe === 'undefined') return;
    frappe.call({
        method: "frappe.client.set_value",
        args: { doctype: "Whatsapp Message", name: message_name, fieldname: "custom_read", value: 1 },
        callback: () => setTimeout(update_whatsapp_notifications, 100)
    });
}

function mark_all_whatsapp_read_for_number(from_number) {
    if (typeof frappe === 'undefined') return;
    frappe.call({
        method: "whatsapp_integration.whatsapp_integration.custom_scripts.mark_read.mark_all_read_by_number",
        args: { from_number: from_number },
        callback: () => setTimeout(update_whatsapp_notifications, 100),
        error: () => {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Whatsapp Message",
                    filters: { from_number: from_number, custom_status: "Incoming", custom_read: 0 },
                    fields: ["name"]
                },
                callback: r => {
                    if (r.message) {
                        Promise.all(r.message.map(m => 
                            frappe.call({
                                method: "frappe.client.set_value",
                                args: { doctype: "Whatsapp Message", name: m.name, fieldname: "custom_read", value: 1 }
                            })
                        )).then(() => setTimeout(update_whatsapp_notifications, 100));
                    }
                }
            });
        }
    });
}