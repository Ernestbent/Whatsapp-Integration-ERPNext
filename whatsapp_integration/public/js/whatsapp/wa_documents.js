// wa.documents — document and PDF bubbles styled after WhatsApp's document card
frappe.provide("wa.documents");

wa.documents.tag_colors = {
    PDF: "#dc2626",
    DOC: "#2563eb",
    XLS: "#15803d",
    PPT: "#ea580c",
    ZIP: "#78716c",
    RAR: "#78716c",
    TXT: "#54656f"
};

wa.documents.tag_label = function (extension) {
    const upper = String(extension || "").toUpperCase();
    if (upper === "DOCX") return "DOC";
    if (upper === "XLSX") return "XLS";
    if (upper === "PPTX") return "PPT";
    return upper.slice(0, 4) || "FILE";
};

wa.documents.get_filename = function (fileUrl, messageText = "") {
    const cleanUrl = String(fileUrl || "").split(/[?#]/)[0];
    let urlFilename = cleanUrl.split("/").pop() || "";

    try {
        urlFilename = decodeURIComponent(urlFilename);
    } catch (error) {
        // Keep the encoded filename when the URL contains malformed escapes.
    }

    const textFilename = String(messageText || "")
        .replace(/^(Document|PDF):\s*/i, "")
        .split(" – ")[0]
        .trim();
    const urlLooksLikeFile = /\.[a-z0-9]{1,8}$/i.test(urlFilename);
    const textLooksLikeFile = /\.[a-z0-9]{1,8}$/i.test(textFilename);

    return (urlLooksLikeFile ? urlFilename : "") || (textLooksLikeFile ? textFilename : "") || urlFilename || "Document";
};

wa.documents.render = function (fileUrl, messageText = "", fileSizeBytes = null, caption = null) {
    const url = String(fileUrl || "").trim();
    if (!url || url === "Attachment") {
        return wa.utils.render_message_text(messageText || "Document");
    }

    const filename = wa.documents.get_filename(url, messageText);
    const extensionMatch = filename.match(/\.([a-z0-9]{1,8})$/i);
    const extension = extensionMatch ? extensionMatch[1] : "";
    const label = wa.documents.tag_label(extension);
    const color = wa.documents.tag_colors[label] || "#54656f";
    const safeUrl = frappe.utils.escape_html(url);
    const safeName = frappe.utils.escape_html(filename);
    const safeLabel = frappe.utils.escape_html(label);
    const sizeText = fileSizeBytes ? `${wa.utils.formatFileSize(fileSizeBytes)} · ` : "";
    const metaText = `${sizeText}${extension ? extension.toUpperCase() : "FILE"}`;

    let resolvedCaption = caption;
    if (resolvedCaption == null) {
        const candidate = String(messageText || "").trim();
        const normalizedCandidate = candidate.replace(/^(Document|PDF):\s*/i, "").split(" – ")[0].trim();
        resolvedCaption = candidate && normalizedCandidate !== filename ? candidate : "";
    }

    const captionHtml = resolvedCaption
        ? wa.utils.render_message_text(resolvedCaption, "wa-doc-caption")
        : "";

    return `<div class="wa-doc-card">
        <a class="wa-doc-card-inner" href="${safeUrl}" target="_blank" rel="noopener noreferrer" download="${safeName}" aria-label="Open ${safeName}">
            <div class="wa-doc-icon-shape" aria-hidden="true">
                <div class="wa-doc-icon-fold"></div>
                <div class="wa-doc-icon-tag" style="background:${color};">${safeLabel}</div>
            </div>
            <div class="wa-doc-card-info">
                <div class="wa-doc-card-name" title="${safeName}">${safeName}</div>
                <div class="wa-doc-card-meta">${frappe.utils.escape_html(metaText)}</div>
            </div>
            <span class="wa-doc-download-circle" aria-hidden="true">&#8595;</span>
        </a>
        ${captionHtml}
    </div>`;
};
