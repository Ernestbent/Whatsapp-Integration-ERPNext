// wa.utils — formatting and rendering helpers with no shared mutable state
frappe.provide("wa.utils");

// Backward-compatible aliases; delivery-state rendering lives in wa_ticks.js.
wa.utils.get_whatsapp_ticks = function (status, is_read, message_status) {
    return wa.ticks && typeof wa.ticks.render === "function"
        ? wa.ticks.render(status, message_status)
        : "";
};

wa.utils.get_pending_tick = function () {
    return wa.ticks && typeof wa.ticks.pending === "function" ? wa.ticks.pending() : "";
};

// jQuery selector for a bubble that is still using a temp id, before the server confirms it
wa.utils.get_temp_message_selector = function (tempId) {
    return `.wa-message[data-temp-id="${tempId}"]`;
};

// 24-hour "HH:MM" from the backend into "H:MM AM/PM"
wa.utils.format_timestamp = function (timestamp) {
    if (!timestamp) return "";
    const parts = timestamp.split(":");
    if (parts.length < 2) return timestamp;
    let hours = parseInt(parts[0]);
    const minutes = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
};

// Date separator label: Today / Yesterday / DD/MM/YYYY
wa.utils.format_date_display = function (date_str) {
    if (!date_str) return "";
    const date = new Date(date_str);
    const now = new Date();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (messageDate.getTime() === today.getTime()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.getTime() === yesterday.getTime()) return "Yesterday";
    return `${day}/${month}/${year}`;
};

// Relative sidebar time: now / 5m / 3h / 2d / DD/MM
wa.utils.format_time_ago = function (date_str) {
    if (!date_str) return "";
    const date = new Date(date_str);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
};

// Groups a raw phone number into a readable +CC XXX XXX XXX shape
wa.utils.format_phone_display = function (phone_number) {
    if (!phone_number) return "Unknown";
    const clean = phone_number.replace(/\D/g, "");
    if (clean.length === 12 && clean.startsWith("256")) {
        return `+${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
    } else if (clean.length >= 10) {
        const last10 = clean.slice(-10);
        return `+${clean.slice(0, -10)} ${last10.slice(0, 3)} ${last10.slice(3, 6)} ${last10.slice(6)}`;
    }
    return `+${clean}`;
};

// Strips everything except digits, used as the cache key for a contact
wa.utils.normalize_phone_number = function (phone_number) {
    return (phone_number || "").toString().replace(/\D/g, "");
};

// Truncates a message body for the sidebar preview line
wa.utils.get_preview_text = function (messageText, fallback = "No message") {
    const text = (messageText || "").trim();
    return text ? text.substring(0, 45) + (text.length > 45 ? "..." : "") : fallback;
};

// Consistent WhatsApp-style preview for the last message in a sidebar conversation.
wa.utils.get_sidebar_preview = function ({
    message_text = "",
    message_type = "",
    file_url = "",
    template_type = ""
} = {}) {
    let type = String(message_type || "").toLowerCase();
    const fileUrl = String(file_url || "");
    const cleanFileUrl = fileUrl.split("?")[0];
    let filename = cleanFileUrl.split("/").pop() || "";
    try {
        filename = decodeURIComponent(filename);
    } catch (error) {
        // Keep the original filename if it was not URL encoded correctly.
    }

    if (type.startsWith("image/")) type = "image";
    if (type.startsWith("video/")) type = "video";
    if (type.startsWith("audio/")) type = "audio";

    const extension = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "";
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
    const videoExtensions = ["mp4", "mov", "avi", "mkv", "webm"];
    const audioExtensions = ["mp3", "ogg", "wav", "m4a", "aac", "opus"];

    if (template_type === "carousel") return "🛍️ Product carousel";
    if (type === "image" || imageExtensions.includes(extension)) return "📷 Photo";
    if (type === "video" || videoExtensions.includes(extension)) return "🎥 Video";
    if (type === "audio" || audioExtensions.includes(extension)) return "🎤 Audio";
    if (type === "sticker") return "Sticker";
    if (type === "contacts") return "👤 Contact";
    if (type === "location") return "📍 Location";
    if (type === "document" || (fileUrl && filename && filename !== "Attachment")) {
        return `📄 ${filename || "Document"}`;
    }
    if (fileUrl) return "📎 Attachment";

    return wa.utils.get_preview_text(message_text, "No message");
};

// Picks the best name to show: cached recipient name, then customer, then formatted phone
wa.utils.get_display_name = function (contactNumber, customerName = null, userFirstName = null) {
    const normalized = wa.utils.normalize_phone_number(contactNumber);
    return (
        userFirstName ||
        wa.state.recipient_name_cache[normalized] ||
        customerName ||
        wa.state.customer_name_cache[contactNumber] ||
        wa.utils.format_phone_display(contactNumber)
    );
};

// Human file size, e.g. 210 KB, for attachment previews
wa.utils.formatFileSize = function (bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

// Escapes message text, auto-links URLs, and preserves line breaks
wa.utils.render_message_text = function (text, extraClass = "wa-message-text", inlineStyle = "") {
    const content = String(text || "");
    const parts = content.split(/(https?:\/\/[^\s<]+)/gi);
    const safeHtml = parts
        .map((part) => {
            if (!part) return "";

            if (/^https?:\/\//i.test(part)) {
                const match = part.match(/^(.*?)([),.;!?]+)?$/);
                const rawUrl = match && match[1] ? match[1] : part;
                const trailing = match && match[2] ? match[2] : "";
                const safeUrl = frappe.utils.escape_html(rawUrl);
                const safeTrailing = frappe.utils.escape_html(trailing);

                return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="wa-message-link">${safeUrl}</a>${safeTrailing}`;
            }

            return frappe.utils.escape_html(part);
        })
        .join("");

    const styleAttr = inlineStyle ? ` style="${inlineStyle}"` : "";
    return `<div class="${extraClass}"${styleAttr}>${safeHtml.replace(/\n/g, "<br>")}</div>`;
};
