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

// Inject responsive styles
function inject_responsive_styles() {
    if ($('#whatsapp-responsive-styles').length) return;
    
    const styles = `
        <style id="whatsapp-responsive-styles">
            /* Desktop styles (default) */
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
            
            /* Tablet styles */
            @media (max-width: 1024px) and (min-width: 769px) {
                .whatsapp-dropdown {
                    min-width: 340px;
                    max-width: 380px;
                }
                
                .whatsapp-messages-container {
                    max-height: 380px;
                }
            }
            
            /* Mobile landscape and small tablets */
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
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: -1;
                }
            }
            
            /* Mobile portrait */
            @media (max-width: 480px) {
                .whatsapp-icon-container {
                    margin-left: 6px;
                    margin-right: 6px;
                }
                
                .whatsapp-icon-container .fa-whatsapp {
                    font-size: 20px !important;
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
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: -1;
                }
            }
            
            /* Extra small devices */
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
            
            /* Animation for dropdown */
            .whatsapp-dropdown {
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.2s ease, visibility 0.2s ease;
            }
            
            .whatsapp-dropdown.show {
                opacity: 1;
                visibility: visible;
            }
            
            /* Smooth scrolling for messages */
            .whatsapp-messages-container {
                scroll-behavior: smooth;
                -webkit-overflow-scrolling: touch;
            }
            
            /* Better touch targets on mobile */
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

// Whatsapp Icon Injection
function add_whatsapp_icon() {
    if ($('.whatsapp-icon-container').length > 0) return;
    if (typeof $ === 'undefined' || !document.body) return;

    inject_responsive_styles();

    const navbar_selectors = [
        '.navbar-right', '.navbar-nav', 'header .navbar ul',
        '#navbar-breadcrumbs + ul', 'header nav ul', '.navbar ul', 'nav ul'
    ];

    let navbar_exists = navbar_selectors.some(sel => $(sel).length > 0);
    if (!navbar_exists) return;

    const whatsapp_html = `
        <li class="nav-item dropdown dropdown-mobile whatsapp-icon-container">
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
            <div class="dropdown-menu dropdown-menu-right whatsapp-dropdown shadow-lg border-0">
                <div style="padding: 14px 18px; background: #f8f9fa; border-bottom: 1px solid #eee; font-weight: 600; font-size: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <span>
                        <i class="fa fa-whatsapp" style="color: #25D366; margin-right: 8px;"></i>
                        WhatsApp Messages
                    </span>
                    <button class="whatsapp-close-btn" style="display: none; background: none; border: none; font-size: 24px; color: #666; cursor: pointer; padding: 0; line-height: 1;">×</button>
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
        
        $container.toggleClass('open');
        $dropdown.toggleClass('show');
        
        if ($container.hasClass('open')) {
            update_whatsapp_notifications();
            handle_whatsapp_dropdown_position();
            
            // On mobile, prevent body scroll when dropdown is open
            if (window.innerWidth <= 768) {
                $('body').css('overflow', 'hidden');
            }
        } else {
            $('body').css('overflow', '');
        }
    });

    // Close button for mobile
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
        // Mobile: Show close button
        $closeBtn.show();
        
        // Ensure mobile styles are applied
        $dropdown.css({
            position: 'fixed',
            left: '50%',
            top: '50%',
            right: 'auto',
            zIndex: '1050'
        });
    } else {
        // Desktop/Tablet: Hide close button, use default positioning
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
    // Close dropdown on orientation change
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
    
    if (clean.length === 12 && clean.startsWith('256')) {
        return `+${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6,9)} ${clean.slice(9)}`;
    } else if (clean.length >= 10) {
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

    const customers = [...new Set(messages.filter(m => m.customer).map(m => m.customer))];
    
    if (customers.length === 0) {
        messages.forEach(msg => {
            msg.display_name = format_phone_display(msg.from_number);
            msg.has_customer = false;
        });
        render_whatsapp_messages(messages);
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
            
            messages.forEach(msg => {
                if (msg.customer && customer_map[msg.customer]) {
                    msg.display_name = customer_map[msg.customer];
                    msg.has_customer = true;
                } else {
                    msg.display_name = format_phone_display(msg.from_number);
                    msg.has_customer = false;
                }
            });
            
            render_whatsapp_messages(messages);
        },
        error: () => {
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

    const sorted = Object.keys(grouped)
        .map(key => ({ key: key, data: grouped[key] }))
        .sort((a, b) => new Date(b.data.latest_time) - new Date(a.data.latest_time));

    let html = '';
    sorted.forEach(group => {
        const d = group.data;
        const latest = d.messages.sort((a, b) => new Date(b.creation) - new Date(a.creation))[0];
        const text = (latest.message || "").substring(0, 70) + ((latest.message || "").length > 70 ? "..." : "");
        const time = frappe.datetime.comment_when(d.latest_time);
        
        const contact_identifier = d.customer || d.from_number;
        const contact_type = d.customer ? 'customer' : 'contact';
        const unknownBadge = latest.is_unknown ? '<i class="fa fa-question-circle" style="color:#ff9800;margin-left:4px;" title="Unknown contact"></i>' : '';

        html += `<a href="#" class="d-block px-4 py-3 text-decoration-none border-bottom position-relative whatsapp-chat-link"
            onclick="handle_chat_click('${contact_identifier}', '${contact_type}', event)"
            style="background: white;">
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

// Handle chat click
window.handle_chat_click = function(contact_identifier, contact_type, event) {
    event.preventDefault();
    event.stopPropagation();
    
    close_whatsapp_dropdown();
    
    sessionStorage.setItem('whatsapp_selected_contact', contact_identifier);
    sessionStorage.setItem('whatsapp_selected_type', contact_type);
    
    frappe.set_route('whatsapp');
};

// Autoclose dropdown
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