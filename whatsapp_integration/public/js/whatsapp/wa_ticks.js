// wa.ticks — consistent delivery-state icons for outgoing messages
frappe.provide("wa.ticks");

wa.ticks.single = function (label = "Sent") {
    return `<svg class="wa-tick wa-tick-sent" viewBox="0 0 16 15" role="img" aria-label="${label}" title="${label}">
        <path fill="currentColor" d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
    </svg>`;
};

wa.ticks.double = function (status) {
    const normalized = (status || "delivered").toLowerCase();
    const isRead = normalized === "read";
    const cssClass = isRead ? "wa-tick-read" : "wa-tick-delivered";
    const label = isRead ? "Read" : "Delivered";
    return `<svg class="wa-tick ${cssClass}" viewBox="0 0 16 15" role="img" aria-label="${label}" title="${label}">
        <path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
    </svg>`;
};

wa.ticks.pending = function () {
    return `<svg class="wa-tick wa-tick-pending" viewBox="0 0 16 15" role="img" aria-label="Sending" title="Sending">
        <circle cx="8" cy="7.5" r="5.25" fill="none" stroke="currentColor" stroke-width="1.4"/>
        <path d="M8 4.7v2.95l2.05 1.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
};

wa.ticks.failed = function () {
    return `<svg class="wa-tick wa-tick-failed" viewBox="0 0 16 16" role="img" aria-label="Failed" title="Failed">
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5.5 5.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
};

wa.ticks.render = function (direction, messageStatus) {
    if ((direction || "").toLowerCase() === "incoming") return "";

    switch ((messageStatus || "sent").toLowerCase()) {
        case "pending":
        case "queued":
        case "sending":
            return wa.ticks.pending();
        case "delivered":
            return wa.ticks.double("delivered");
        case "read":
            return wa.ticks.double("read");
        case "failed":
        case "error":
            return wa.ticks.failed();
        case "accepted":
        case "sent":
        default:
            return wa.ticks.single("Sent");
    }
};
