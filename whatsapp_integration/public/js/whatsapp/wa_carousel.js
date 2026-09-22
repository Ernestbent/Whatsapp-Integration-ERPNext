// wa.carousel — product carousel bubble
//
// Backend requirement: when you send a carousel template, store what you sent
// so the page can redraw it. Add two fields to Whatsapp Message:
//   custom_template_type  (Data)       — "carousel" for these messages
//   custom_template_data  (Long Text)  — JSON: {intro, cards:[{name, price,
//     image_url, view_url, order_reply_text}, ...]}
// and include both in wa_messages.js's load_messages field list.
// "View product" opens view_url directly. "Order now" is a quick-reply button
// in the approved template, so on click here it just sends order_reply_text
// as a normal outgoing text via wa.input.send_message_text — that mirrors
// what the customer's tap would trigger from their side.
frappe.provide("wa.carousel");

// Renders one carousel bubble. Returns "" if this message isn't a carousel.
wa.carousel.render = function (msg) {
    if (msg.custom_template_type !== "carousel" || !msg.custom_template_data) return "";

    let data;
    try {
        data = JSON.parse(msg.custom_template_data);
    } catch (e) {
        return wa.utils.render_message_text("Product carousel");
    }

    const cards = data.cards || [];
    const introHtml = data.intro ? wa.utils.render_message_text(data.intro, "wa-carousel-intro") : "";

    const cardsHtml = cards
        .map((card, i) => {
            const safeName = frappe.utils.escape_html(card.name || "");
            const safePrice = frappe.utils.escape_html(card.price || "");
            const safeImg = frappe.utils.escape_html(card.image_url || "");
            const safeViewUrl = frappe.utils.escape_html(card.view_url || "#");
            const safeReply = frappe.utils.escape_html(card.order_reply_text || card.name || "");
            return `<div class="wa-carousel-card" data-card-index="${i}">
                <div class="wa-carousel-img${safeImg ? " has-image" : ` placeholder tone-${(i % 4) + 1}`}"${safeImg ? ` style="background-image:url('${safeImg}');"` : ""}>
                    ${safeImg ? "" : "<span>Product image</span>"}
                </div>
                <div class="wa-carousel-body">
                    <div class="wa-carousel-name">${safeName}</div>
                    <div class="wa-carousel-price">${safePrice}</div>
                </div>
                <a class="wa-carousel-btn" href="${safeViewUrl}" target="_blank" rel="noopener noreferrer">View product</a>
                <div class="wa-carousel-btn wa-carousel-order" data-reply-text="${safeReply}">Order now</div>
            </div>`;
        })
        .join("");

    return `<div class="wa-carousel-wrap">
        ${introHtml}
        <button class="wa-carousel-arrow left" type="button">&#8249;</button>
        <button class="wa-carousel-arrow right" type="button">&#8250;</button>
        <div class="wa-carousel-strip">${cardsHtml}</div>
        <div class="wa-carousel-count">Card 1 of ${cards.length}</div>
    </div>`;
};

wa.carousel.bind_events = function () {
    const updateCount = ($strip) => {
        const total = $strip.children(".wa-carousel-card").length;
        if (!total) return;
        const cardWidth = $strip.children(".wa-carousel-card").first().outerWidth(true) || 168;
        const current = Math.min(total, Math.max(1, Math.round($strip.scrollLeft() / cardWidth) + 1));
        $strip.siblings(".wa-carousel-count").text(`Card ${current} of ${total}`);
    };

    $(document).on("click", ".wa-carousel-arrow", function () {
        const $strip = $(this).siblings(".wa-carousel-strip");
        const delta = $(this).hasClass("left") ? -172 : 172;
        $strip.animate({ scrollLeft: $strip.scrollLeft() + delta }, 200, () => updateCount($strip));
    });

    $(document).on("scroll", ".wa-carousel-strip", function () {
        updateCount($(this));
    });

    // "Order now" sends the card's reply text as a normal outgoing message
    $(document).on("click", ".wa-carousel-order", function () {
        const text = $(this).attr("data-reply-text");
        if (!text || !wa.state.active_contact) return;
        wa.input.send_message_text(text);
    });
};
