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
                    <a href="/app/whatsapp" class="whatsapp-view-all" style="color: #25D366; font-weight: 500; text-decoration: none; font-size: 14px;">
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

// Notifications Update - Fetch from Whatsapp Message doctype
function update_whatsapp_notifications() {
    if (typeof frappe === 'undefined') return;

    // Get count of unread incoming messages
    frappe.call({
        method: "frappe.client.get_count",
        args: { 
            doctype: "Whatsapp Message", 
            filters: { 
                custom_status: "Incoming", 
                custom_read: 0 
            } 
        },
        callback: r => {
            const count = r.message || 0;
            const $badge = $('.whatsapp-count-badge');
            if (count > 0) $badge.text(count > 99 ? "99+" : count).show();
            else $badge.hide();
        }
    });

    // Get unread messages grouped by contact
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Whatsapp Message",
            filters: { 
                custom_status: "Incoming", 
                custom_read: 0 
            },
            fields: ["name", "from_number", "customer", "message", "creation", "timestamp"],
            order_by: "creation desc",
            limit_page_length: 100
        },
        callback: r => {
            const messages = r.message || [];
            enrich_and_render_messages(messages);
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

// Format phone number for display
function format_phone_display(phone_number) {
    if (!phone_number) return "Unknown";
    const clean = phone_number.replace(/\D/g, '');
    
    // Format based on length
    if (clean.length === 12 && clean.startsWith('256')) {
        // Uganda format: 256 XXX XXX XXX
        return `+${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6,9)} ${clean.slice(9)}`;
    } else if (clean.length >= 10) {
        // Generic format: last 10 digits grouped
        const last10 = clean.slice(-10);
        return `+${clean.slice(0,-10)} ${last10.slice(0,3)} ${last10.slice(3,6)} ${last10.slice(6)}`;
    }
    return `+${clean}`;
}

// Enrich messages with customer names and render
function enrich_and_render_messages(messages) {
    if (!messages || messages.length === 0) {
        render_whatsapp_messages([]);
        return;
    }

    // Get unique customers
    const customers = [...new Set(messages.filter(m => m.customer).map(m => m.customer))];
    
    if (customers.length === 0) {
        // No customers, just show phone numbers
        messages.forEach(msg => {
            msg.display_name = format_phone_display(msg.from_number);
            msg.has_customer = false;
        });
        render_whatsapp_messages(messages);
        return;
    }

    // Fetch customer names
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Customer",
            filters: [["name", "in", customers]],
            fields: ["name", "customer_name"]
        },
        callback: r => {
            const customer_map = {};
            (r.message || []).forEach(c => {
                customer_map[c.name] = c.customer_name;
            });
            
            // Add display names to messages
            messages.forEach(msg => {
                if (msg.customer && customer_map[msg.customer]) {
                    // Has linked customer - show customer name
                    msg.display_name = customer_map[msg.customer];
                    msg.has_customer = true;
                } else {
                    // No customer - show formatted phone number
                    msg.display_name = format_phone_display(msg.from_number);
                    msg.has_customer = false;
                }
            });
            
            render_whatsapp_messages(messages);
        },
        error: () => {
            // If customer fetch fails, use phone numbers
            messages.forEach(msg => {
                msg.display_name = format_phone_display(msg.from_number);
                msg.has_customer = false;
            });
            render_whatsapp_messages(messages);
        }
    });
}

// Render Messages - Group by contact
function render_whatsapp_messages(messages) {
    const container = $('.whatsapp-messages-container');
    if (!messages || messages.length === 0) {
        container.html(`<div class="text-center text-muted py-5">
            <i class="fa fa-whatsapp fa-4x mb-3" style="color:#25D366; opacity:0.3;"></i>
            <p>No unread messages</p>
        </div>`);
        return;
    }

    // Group messages by contact
    const grouped = {};
    messages.forEach(msg => {
        const key = msg.customer || msg.from_number || "Unknown";
        if (!grouped[key]) {
            grouped[key] = {
                messages: [],
                display_name: msg.display_name || msg.customer || msg.from_number || "Unknown",
                from_number: msg.from_number,
                customer: msg.customer,
                latest_time: msg.creation
            };
        }
        grouped[key].messages.push(msg);
        if (msg.creation > grouped[key].latest_time) {
            grouped[key].latest_time = msg.creation;
        }
    });

    // Sort by latest message time
    const sorted = Object.keys(grouped)
        .map(key => ({ key: key, data: grouped[key] }))
        .sort((a, b) => new Date(b.data.latest_time) - new Date(a.data.latest_time));

    let html = '';
    sorted.forEach(group => {
        const d = group.data;
        const latest = d.messages.sort((a, b) => new Date(b.creation) - new Date(a.creation))[0];
        const text = (latest.message || "").substring(0, 70) + ((latest.message || "").length > 70 ? "..." : "");
        const time = frappe.datetime.comment_when(d.latest_time);
        
        // Use customer or from_number for navigation
        const contact_identifier = d.customer || d.from_number;
        const contact_type = d.customer ? 'customer' : 'contact';
        
        // Add visual indicator for unknown contacts
        const unknownBadge = latest.is_unknown ? '<i class="fa fa-question-circle" style="color:#ff9800;margin-left:4px;" title="Unknown contact"></i>' : '';

        html += `<a href="#" class="d-block px-4 py-3 text-decoration-none border-bottom position-relative whatsapp-chat-link"
            onclick="handle_chat_click('${contact_identifier}', '${contact_type}', event)"
            onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">
            <div class="d-flex align-items-center justify-content-between mb-1">
                <strong style="font-size:14px;">${frappe.utils.escape_html(d.display_name)}${unknownBadge}</strong>
                <small class="text-muted">${time}</small>
            </div>
            <div class="text-muted small" style="padding-left:4px;">${frappe.utils.escape_html(text)}</div>
            ${d.messages.length > 1 ? `<span class="badge badge-success position-absolute" style="top:14px; right:16px;">${d.messages.length}</span>` : ""}
        </a>`;
    });
    container.html(html);
}

// Handle chat click - Navigate to WhatsApp page with contact pre-selected
window.handle_chat_click = function(contact_identifier, contact_type, event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Close dropdown immediately
    $('.whatsapp-icon-container').removeClass('open');
    $('.whatsapp-dropdown').removeClass('show');
    
    // Navigate to WhatsApp page with the contact/customer selected
    // Store the selected contact in sessionStorage for the page to pick up
    sessionStorage.setItem('whatsapp_selected_contact', contact_identifier);
    sessionStorage.setItem('whatsapp_selected_type', contact_type);
    
    frappe.set_route('whatsapp');
};

// Autoclose dropdown
$(document).on('click', '.whatsapp-view-all', function(e) {
    e.preventDefault();
    $('.whatsapp-icon-container').removeClass('open');
    $('.whatsapp-dropdown').removeClass('show');
    
    // Navigate after closing dropdown
    setTimeout(() => {
        frappe.set_route('whatsapp');
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