// wa.templates — one template bubble: optional HEADER + BODY + optional footer
frappe.provide("wa.templates");

wa.templates.get_header_type = function (message, fileUrl) {
    const configured = String(message.custom_template_header_type || "").trim().toLowerCase();
    const aliases = { documentation: "document", doc: "document", photo: "image" };
    if (configured && configured !== "none") return aliases[configured] || configured;
    if (!fileUrl) return "none";

    const cleanUrl = String(fileUrl).split(/[?#]/)[0].toLowerCase();
    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(cleanUrl)) return "image";
    if (/\.(mp4|mov|m4v|webm|avi)$/.test(cleanUrl)) return "video";
    return "document";
};

wa.templates.render_document_header = function (fileUrl, headerLabel = "", fileSizeBytes = null) {
    const filename = wa.documents.get_filename(fileUrl, headerLabel);
    const extensionMatch = filename.match(/\.([a-z0-9]{1,8})$/i);
    const extension = extensionMatch ? extensionMatch[1] : "";
    const label = wa.documents.tag_label(extension);
    const color = wa.documents.tag_colors[label] || "#54656f";
    const sizeText = fileSizeBytes ? `${wa.utils.formatFileSize(fileSizeBytes)} · ` : "";
    const safeUrl = frappe.utils.escape_html(fileUrl);
    const safeName = frappe.utils.escape_html(filename);

    return `<a class="wa-template-header wa-template-header-doc" href="${safeUrl}" target="_blank" rel="noopener noreferrer" download="${safeName}" aria-label="Open ${safeName}">
        <div class="wa-doc-icon-shape" aria-hidden="true">
            <div class="wa-doc-icon-fold"></div>
            <div class="wa-doc-icon-tag" style="background:${color};">${frappe.utils.escape_html(label)}</div>
        </div>
        <div class="wa-doc-card-info">
            <div class="wa-doc-card-name" title="${safeName}">${safeName}</div>
            <div class="wa-doc-card-meta">${frappe.utils.escape_html(`${sizeText}${extension ? extension.toUpperCase() : "FILE"}`)}</div>
        </div>
        <span class="wa-doc-download-circle" aria-hidden="true">&#8595;</span>
    </a>`;
};

wa.templates.render_image_header = function (fileUrl) {
    const safeUrl = frappe.utils.escape_html(fileUrl);
    const fallback = "this.onerror=null;this.parentElement.classList.add('wa-template-header-broken');this.remove();";
    return `<div class="wa-template-header wa-template-header-image wa-template-lightbox" data-src="${safeUrl}" data-media-type="image" role="button" tabindex="0" aria-label="Open template image">
        <img src="${safeUrl}" alt="Template image" onerror="${fallback}" />
        <span class="wa-template-header-fallback-text">Image unavailable</span>
    </div>`;
};

wa.templates.render_video_header = function (fileUrl) {
    const safeUrl = frappe.utils.escape_html(fileUrl);
    return `<div class="wa-template-header wa-template-header-video wa-template-lightbox" data-src="${safeUrl}" data-media-type="video" role="button" tabindex="0" aria-label="Play template video">
        <video preload="metadata" muted><source src="${safeUrl}" type="video/mp4"></video>
        <span class="wa-template-header-play" aria-hidden="true">&#9654;</span>
    </div>`;
};

wa.templates.render = function (message) {
    const headerFile = message.custom_template_header_file || message.custom_document || "";
    const headerType = wa.templates.get_header_type(message, headerFile);
    let headerHtml = "";

    if (headerType === "document" && headerFile) {
        headerHtml = wa.templates.render_document_header(
            headerFile,
            message.custom_template_header_label || "",
            message.template_header_file_size || message.file_size || null
        );
    } else if (headerType === "image" && headerFile) {
        headerHtml = wa.templates.render_image_header(headerFile);
    } else if (headerType === "video" && headerFile) {
        headerHtml = wa.templates.render_video_header(headerFile);
    }

    const footer = String(message.custom_template_footer || "").trim();
    let body = String(message.message || "");
    if (footer && body.endsWith(`\n\n${footer}`)) {
        body = body.slice(0, -(`\n\n${footer}`).length);
    }

    const bodyHtml = body ? wa.utils.render_message_text(body, "wa-template-body") : "";
    const footerHtml = footer
        ? `<div class="wa-template-footer">${frappe.utils.escape_html(footer)}</div>`
        : "";

    return `${headerHtml}${bodyHtml}${footerHtml}` || wa.utils.render_message_text("Template message");
};

wa.templates.bind_events = function () {
    $(document)
        .off("click.waTemplates", ".wa-template-lightbox")
        .on("click.waTemplates", ".wa-template-lightbox", function () {
            window.open_lightbox($(this).attr("data-src"), $(this).attr("data-media-type"));
        })
        .off("keydown.waTemplates", ".wa-template-lightbox")
        .on("keydown.waTemplates", ".wa-template-lightbox", function (event) {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            $(this).trigger("click");
        });
};
