const WHATSAPP_ICON_URL = "/assets/whatsapp_integration/img/whatsapp-icon.svg";

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

            // When navigating to WhatsApp page, auto-open the selected contact
            const route = frappe.get_route();
            if (route && route[0] === 'whatsapp') {
                setTimeout(() => auto_open_whatsapp_contact(), 800);
                setTimeout(() => auto_open_whatsapp_contact(), 1500);
                setTimeout(() => auto_open_whatsapp_contact(), 2500);
                setTimeout(() => auto_open_whatsapp_contact(), 3500); // Extra attempt for slow loads
            }
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
                        if ($node.find('header, .navbar, nav, .navbar-collapse, .navbar-nav').length ||
                            $node.is('header, .navbar, nav, .navbar-collapse, .navbar-nav')) {
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

// Improved auto-open function with better matching
function auto_open_whatsapp_contact() {
    const contact = sessionStorage.getItem('whatsapp_selected_contact');
    if (!contact) return;

    console.log('Attempting to open contact:', contact);

    // Clean the contact number for comparison (remove non-digits)
    const cleanContact = contact.replace(/\D/g, '');
    
    // Try multiple selectors and matching strategies
    let $target = null;
    
    // Strategy 1: Exact match on data-contact
    $target = $(`.wa-chat-item[data-contact="${contact}"]`);
    if ($target.length) {
        console.log('Found by exact data-contact match');
    }
    
    // Strategy 2: Match by data-contact with cleaned number
    if (!$target || !$target.length) {
        $('.wa-chat-item').each(function() {
            const dataContact = $(this).data('contact');
            if (dataContact) {
                const cleanDataContact = dataContact.replace(/\D/g, '');
                if (cleanDataContact === cleanContact) {
                    $target = $(this);
                    console.log('Found by cleaned number match');
                    return false;
                }
            }
        });
    }
    
    // Strategy 3: Match by text content (display name)
    if (!$target || !$target.length) {
        $('.wa-chat-item').each(function() {
            const displayName = $(this).find('.wa-chat-name').text();
            // Check if display name contains the phone number or is similar
            if (displayName.includes(cleanContact) || cleanContact.includes(displayName.replace(/\D/g, ''))) {
                $target = $(this);
                console.log('Found by display name match');
                return false;
            }
        });
    }
    
    // Strategy 4: Match by phone number in any attribute or text
    if (!$target || !$target.length) {
        $('.wa-chat-item').each(function() {
            const html = $(this).html();
            if (html && html.includes(cleanContact)) {
                $target = $(this);
                console.log('Found by HTML content match');
                return false;
            }
        });
    }

    if ($target && $target.length) {
        console.log('Successfully found chat item, clicking...');
        
        // Clear sessionStorage so it doesn't re-open on next visit
        sessionStorage.removeItem('whatsapp_selected_contact');
        
        // Scroll into view in sidebar
        $target[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Trigger click to open chat
        $target[0].click();
        
        // Add visual feedback
        $target.css('background', '#e9edef');
        setTimeout(() => {
            $target.css('background', '');
        }, 500);
        
        return true;
    } else {
        console.log('Could not find chat item for contact:', contact);
        
        // If not found, try again after a delay (for dynamic content)
        setTimeout(() => {
            const retryContact = sessionStorage.getItem('whatsapp_selected_contact');
            if (retryContact === contact) {
                console.log('Retrying to find chat item...');
                auto_open_whatsapp_contact();
            }
        }, 1000);
        
        return false;
    }
}

// Inject responsive styles
function inject_responsive_styles() {
    if ($('#whatsapp-responsive-styles').length) return;

    const styles = `
        <style id="whatsapp-responsive-styles">
            .whatsapp-icon-container {
                margin-left: 12px;
                margin-right: 16px;
            }

            .whatsapp-dropdown {
                min-width: 370px;
                max-width: 430px;
                margin-top: 10px;
                border-radius: 14px;
                overflow: hidden;
                position: absolute;
                right: 0;
                left: auto;
                transform: none;
            }

            .whatsapp-messages-container {
                max-height: 420px;
                overflow-y: auto;
                background: white;
            }

            .whatsapp-chat-link {
                transition: background 0.2s ease;
            }

            .whatsapp-chat-link:hover {
                background: #f0fdf4 !important;
            }

            .whatsapp-icon-wrap {
                --whatsapp-icon-size: 22px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: var(--whatsapp-icon-size);
                height: var(--whatsapp-icon-size);
                vertical-align: middle;
            }

            .whatsapp-svg-icon {
                display: inline-block;
                width: 100%;
                height: 100%;
                object-fit: contain;
            }

            .whatsapp-icon-fallback {
                display: none;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background: #25D366;
                color: #fff;
                font-size: 9px;
                font-weight: 700;
                line-height: 1;
            }

            @media (max-width: 1024px) and (min-width: 769px) {
                .whatsapp-dropdown {
                    min-width: 340px;
                    max-width: 380px;
                }
                .whatsapp-messages-container {
                    max-height: 380px;
                }
            }

            @media (max-width: 768px) and (min-width: 481px) {
                .whatsapp-icon-container {
                    margin-left: 8px;
                    margin-right: 8px;
                }
                .whatsapp-dropdown {
                    position: fixed !important;
                    left: 50% !important;
                    top: 50% !important;
                    transform: translate(-50%, -50%) !important;
                    right: auto !important;
                    width: 85vw !important;
                    max-width: 420px !important;
                    max-height: 75vh !important;
                    border-radius: 16px !important;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3) !important;
                    z-index: 1050 !important;
                }
                .whatsapp-messages-container {
                    max-height: calc(75vh - 120px) !important;
                }
                .whatsapp-dropdown::before {
                    content: '';
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    z-index: -1;
                }
            }

            @media (max-width: 480px) {
                .whatsapp-icon-container {
                    margin-left: 6px;
                    margin-right: 6px;
                }
                .whatsapp-icon-container .whatsapp-icon-wrap {
                    --whatsapp-icon-size: 20px !important;
                }
                .whatsapp-count-badge {
                    top: -8px !important;
                    right: -8px !important;
                    width: 18px !important;
                    height: 18px !important;
                    font-size: 10px !important;
                    line-height: 18px !important;
                }
                .whatsapp-dropdown {
                    position: fixed !important;
                    left: 50% !important;
                    top: 50% !important;
                    transform: translate(-50%, -50%) !important;
                    right: auto !important;
                    width: 92vw !important;
                    max-width: 95vw !important;
                    max-height: 85vh !important;
                    border-radius: 16px !important;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.4) !important;
                    z-index: 1050 !important;
                    margin: 0 !important;
                }
                .whatsapp-dropdown > div:first-child {
                    padding: 12px 14px !important;
                    font-size: 14px !important;
                }
                .whatsapp-messages-container {
                    max-height: calc(85vh - 110px) !important;
                }
                .whatsapp-chat-link {
                    padding: 12px 14px !important;
                }
                .whatsapp-chat-link strong {
                    font-size: 13px !important;
                }
                .whatsapp-chat-link .small {
                    font-size: 12px !important;
                }
                .whatsapp-dropdown > div:last-child {
                    padding: 10px 14px !important;
                }
                .whatsapp-view-all {
                    font-size: 13px !important;
                }
                .whatsapp-dropdown::before {
                    content: '';
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.6);
                    z-index: -1;
                }
            }

            @media (max-width: 360px) {
                .whatsapp-dropdown {
                    width: 96vw !important;
                    max-height: 90vh !important;
                }
                .whatsapp-messages-container {
                    max-height: calc(90vh - 100px) !important;
                }
                .whatsapp-chat-link {
                    padding: 10px 12px !important;
                }
            }

            .whatsapp-dropdown {
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.2s ease, visibility 0.2s ease;
            }
            .whatsapp-dropdown.show {
                opacity: 1;
                visibility: visible;
            }

            .whatsapp-messages-container {
                scroll-behavior: smooth;
                -webkit-overflow-scrolling: touch;
            }

            @media (max-width: 768px) {
                .whatsapp-chat-link {
                    min-height: 60px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
            }
        </style>
    `;

    $('head').append(styles);
}

function whatsapp_icon_markup(size = 22, class_name = "", style = "") {
    return `
        <span class="whatsapp-icon-wrap ${class_name}" style="--whatsapp-icon-size: ${size}px; ${style}">
            <span class="whatsapp-icon-fallback">WA</span>
            <img class="whatsapp-svg-icon" src="${WHATSAPP_ICON_URL}" alt="" aria-hidden="true"
                 onerror="this.style.display='none'; this.previousElementSibling.style.display='inline-flex';">
        </span>
    `;
}

// WhatsApp Icon Injection
function add_whatsapp_icon() {
    // Wait until frappe.user_roles is populated
    if (!frappe.user_roles || frappe.user_roles.length === 0) {
        setTimeout(add_whatsapp_icon, 500);
        return;
    }

    // Role check
    const allowed_roles = ['Whatsapp User'];
    const has_access = allowed_roles.some(role => frappe.user_roles.includes(role));
    if (!has_access) return;

    if ($('.whatsapp-icon-container').length > 0) return;
    if (typeof $ === 'undefined' || !document.body) return;

    inject_responsive_styles();

    // Check navbar exists
    const navbar_selectors = [
        '.navbar-collapse .navbar-nav',
        '.navbar-right', '.navbar-nav', 'header .navbar ul',
        '#navbar-breadcrumbs + ul', 'header nav ul', '.navbar ul', 'nav ul'
    ];

    let navbar_exists = navbar_selectors.some(sel => $(sel).length > 0);
    if (!navbar_exists) return;

    const whatsapp_html = `
        <li class="nav-item dropdown dropdown-mobile whatsapp-icon-container">
            <a class="nav-link" href="#" data-toggle="dropdown" title="WhatsApp Messages">
                <span style="position: relative; display: inline-block;">
                    ${whatsapp_icon_markup(22)}
                    <span class="badge badge-danger whatsapp-count-badge"
                          style="position: absolute; top: -10px; right: -10px; display: none;
                                 background: #dc3545; color: white; border-radius: 50%; width: 20px; height: 20px;
                                 font-size: 11px; line-height: 20px; font-weight: bold; text-align: center;">
                        0
                    </span>
                </span>
            </a>
            <div class="dropdown-menu dropdown-menu-right whatsapp-dropdown shadow-lg border-0">
                <div style="padding: 14px 18px; background: #f8f9fa; border-bottom: 1px solid #eee; font-weight: 600; font-size: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <span>
                        ${whatsapp_icon_markup(18, "", "margin-right: 8px;")}
                        WhatsApp Messages
                    </span>
                    <button class="whatsapp-close-btn" style="display: none; background: none; border: none; font-size: 24px; color: #666; cursor: pointer; padding: 0; line-height: 1;">&times;</button>
                </div>
                <div class="whatsapp-messages-container">
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

    // Insert into correct navbar ul
    let inserted = false;
    const targets = [
        '.navbar-collapse .navbar-nav',
        '.navbar-right', '.navbar-nav',
        'header nav ul', '.navbar ul', 'nav ul'
    ];
    for (let sel of targets) {
        const $target = $(sel);
        if ($target.length) {
            $target.prepend(whatsapp_html);
            inserted = true;
            break;
        }
    }
    if (!inserted) {
        $('header nav ul, .navbar ul').first().prepend(whatsapp_html);
    }

    $('.whatsapp-icon-container .nav-link').off('click.wa').on('click.wa', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const $container = $('.whatsapp-icon-container');
        const $dropdown = $('.whatsapp-dropdown');

        $container.toggleClass('open');
        $dropdown.toggleClass('show');

        if ($container.hasClass('open')) {
            update_whatsapp_notifications();
            handle_whatsapp_dropdown_position();
            if (window.innerWidth <= 768) {
                $('body').css('overflow', 'hidden');
            }
        } else {
            $('body').css('overflow', '');
        }
    });

    $('.whatsapp-close-btn').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        close_whatsapp_dropdown();
    });

    update_whatsapp_notifications();
    if (window.whatsapp_update_interval) clearInterval(window.whatsapp_update_interval);
    window.whatsapp_update_interval = setInterval(update_whatsapp_notifications, 30000);

    handle_whatsapp_dropdown_position();
}

// Responsive Dropdown Positioning
function handle_whatsapp_dropdown_position() {
    const $dropdown = $('.whatsapp-dropdown');
    const $closeBtn = $('.whatsapp-close-btn');

    if (!$dropdown.length) return;

    if (window.innerWidth <= 768) {
        $closeBtn.show();
        $dropdown.css({
            position: 'fixed',
            left: '50%',
            top: '50%',
            right: 'auto',
            zIndex: '1050'
        });
    } else {
        $closeBtn.hide();
        $dropdown.css({
            position: 'absolute',
            right: '0',
            left: 'auto',
            top: '100%',
            zIndex: '1000'
        });
    }
}

function close_whatsapp_dropdown() {
    $('.whatsapp-icon-container').removeClass('open');
    $('.whatsapp-dropdown').removeClass('show');
    $('body').css('overflow', '');
}

$(window).on('resize', frappe.utils.debounce(() => {
    handle_whatsapp_dropdown_position();
    if ($('.whatsapp-dropdown').hasClass('show')) {
        close_whatsapp_dropdown();
    }
}, 200));

$(document).ready(handle_whatsapp_dropdown_position);

// Notifications Update
function update_whatsapp_notifications() {
    if (typeof frappe === 'undefined') return;

    frappe.call({
        method: "frappe.client.get_count",
        args: {
            doctype: "Whatsapp Message",
            filters: {
                custom_status: "Incoming",
                custom_read: 0,
                message_status: "received"
            }
        },
        callback: r => {
            const count = r.message || 0;
            const $badge = $('.whatsapp-count-badge');
            if (count > 0) $badge.text(count > 99 ? "99+" : count).show();
            else $badge.hide();
        }
    });

    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Whatsapp Message",
            filters: {
                custom_status: "Incoming",
                custom_read: 0,
                message_status: "received"
            },
            fields: ["name", "from_number", "customer", "customer.customer_name as customer_name", "custom_user", "custom_user.first_name as user_first_name", "message", "creation", "timestamp", "custom_status", "message_status"],
            order_by: "creation desc",
            limit_page_length: 100
        },
        callback: r => {
            const messages = (r.message || []).filter(message =>
                message.custom_status === "Incoming" && message.message_status === "received"
            );
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

    if (clean.length === 12 && clean.startsWith('256')) {
        return `+${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6,9)} ${clean.slice(9)}`;
    } else if (clean.length >= 10) {
        const last10 = clean.slice(-10);
        return `+${clean.slice(0,-10)} ${last10.slice(0,3)} ${last10.slice(3,6)} ${last10.slice(6)}`;
    }
    return `+${clean}`;
}

// Enrich messages with customer/user names and render
function enrich_and_render_messages(messages) {
    if (!messages || messages.length === 0) {
        render_whatsapp_messages([]);
        return;
    }

    const apply_display_names = (customer_map, user_map = {}) => {
        messages.forEach(msg => {
            const user_name = msg.user_first_name || user_map[msg.custom_user];
            if (user_name) {
                msg.display_name = user_name;
                msg.has_customer = false;
            } else if (msg.customer && customer_map[msg.customer]) {
                msg.display_name = customer_map[msg.customer];
                msg.has_customer = true;
            } else if (msg.customer_name) {
                msg.display_name = msg.customer_name;
                msg.has_customer = true;
            } else {
                msg.display_name = format_phone_display(msg.from_number);
                msg.has_customer = false;
            }
        });
        render_whatsapp_messages(messages);
    };

    const customers = [...new Set(messages.filter(m => m.customer).map(m => m.customer))];
    const users = [...new Set(messages.filter(m => m.custom_user && !m.user_first_name).map(m => m.custom_user))];

    const load_customers = callback => {
        if (customers.length === 0) {
            callback({});
            return;
        }

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
                callback(customer_map);
            },
            error: () => callback({})
        });
    };

    const load_users = callback => {
        if (users.length === 0) {
            callback({});
            return;
        }

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "User",
                filters: [["name", "in", users]],
                fields: ["name", "first_name", "full_name"]
            },
            callback: r => {
                const user_map = {};
                (r.message || []).forEach(u => {
                    user_map[u.name] = u.first_name || u.full_name || u.name;
                });
                callback(user_map);
            },
            error: () => callback({})
        });
    };

    load_customers(customer_map => {
        load_users(user_map => {
            apply_display_names(customer_map, user_map);
        });
    });
}

// Render Messages - Group by from_number (matches WhatsApp page data-contact attribute)
function render_whatsapp_messages(messages) {
    const container = $('.whatsapp-messages-container');
    if (!messages || messages.length === 0) {
        container.html(`<div class="text-center text-muted py-5">
            ${whatsapp_icon_markup(64, "mb-3", "opacity: 0.3;")}
            <p>No unread messages</p>
        </div>`);
        return;
    }

    // Group by from_number — this is the key that matches data-contact on the WhatsApp page
    const grouped = {};
    messages.forEach(msg => {
        const key = msg.from_number || "Unknown";
        if (!grouped[key]) {
            grouped[key] = {
                messages: [],
                display_name: msg.display_name || format_phone_display(msg.from_number),
                from_number: msg.from_number,
                latest_time: msg.creation
            };
        }
        grouped[key].messages.push(msg);
        if (msg.creation > grouped[key].latest_time) {
            grouped[key].latest_time = msg.creation;
        }
    });

    const sorted = Object.keys(grouped)
        .map(key => ({ key: key, data: grouped[key] }))
        .sort((a, b) => new Date(b.data.latest_time) - new Date(a.data.latest_time));

    let html = '';
    sorted.forEach(group => {
        const d = group.data;
        const latest = d.messages.sort((a, b) => new Date(b.creation) - new Date(a.creation))[0];
        const text = (latest.message || "").substring(0, 70) + ((latest.message || "").length > 70 ? "..." : "");
        const time = frappe.datetime.comment_when(d.latest_time);
        const unread_count = d.messages.length;

        html += `<a href="#" class="d-block px-4 py-3 text-decoration-none border-bottom position-relative whatsapp-chat-link"
            onclick="handle_chat_click('${frappe.utils.escape_html(d.from_number)}', event)"
            style="background: white;">
            <div class="d-flex align-items-center justify-content-between mb-1">
                <strong style="font-size:14px;">${frappe.utils.escape_html(d.display_name)}</strong>
                <small class="text-muted" style="font-size:11px;">${time}</small>
            </div>
            <div class="d-flex align-items-center justify-content-between">
                <div class="text-muted small" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${frappe.utils.escape_html(text)}</div>
                <span style="background:#25D366; color:white; border-radius:12px; padding:2px 7px; font-size:12px; font-weight:600; min-width:20px; text-align:center; margin-left:8px; flex-shrink:0;">${unread_count}</span>
            </div>
        </a>`;
    });
    container.html(html);
}

// Handle chat click with improved storage
window.handle_chat_click = function(from_number, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    close_whatsapp_dropdown();

    // Store the raw from_number as is
    sessionStorage.setItem('whatsapp_selected_contact', from_number);
    console.log('Stored contact:', from_number);

    const current_route = frappe.get_route();
    if (current_route && current_route[0] === 'whatsapp') {
        // Already on WhatsApp page — directly trigger open
        setTimeout(() => auto_open_whatsapp_contact(), 100);
    } else {
        // Navigate — route change listener will fire auto_open_whatsapp_contact
        frappe.set_route('whatsapp');
    }
};

// Autoclose dropdown on View All click
$(document).on('click', '.whatsapp-view-all', function(e) {
    e.preventDefault();
    close_whatsapp_dropdown();
    setTimeout(() => {
        frappe.set_route('whatsapp');
    }, 100);
});

// Close dropdown when clicking outside
$(document).on('click', function(e) {
    if (!$(e.target).closest('.whatsapp-icon-container').length) {
        close_whatsapp_dropdown();
    }
});

// Close dropdown on route change
if (typeof frappe !== 'undefined' && frappe.router) {
    frappe.router.on('change', () => {
        close_whatsapp_dropdown();
    });
}

// Handle escape key
$(document).on('keydown', function(e) {
    if (e.key === 'Escape' && $('.whatsapp-dropdown').hasClass('show')) {
        close_whatsapp_dropdown();
    }
});
