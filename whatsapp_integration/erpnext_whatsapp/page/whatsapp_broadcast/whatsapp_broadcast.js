frappe.pages['whatsapp_broadcast'].on_page_load = function(wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Broadcast Message',
        single_column: true
    });
    page.wrapper.find('.page-head').hide();
    page.main.addClass('wb-page-main');

    page.main.html(`
        <style>
            .wb-page-main { padding: 0 !important; }
            .wb-shell {
                --wb-bg: #f0f2f5; --wb-panel: #fff; --wb-alt: #f7f8fa; --wb-line: #e2e5e8;
                --wb-text: #111b21; --wb-muted: #667781; --wb-teal: #075e54;
                --wb-green: #25d366; --wb-green-dark: #128c7e; --wb-bubble: #dcf8c6;
                min-height: calc(100vh - 112px); background: var(--wb-bg); color: var(--wb-text);
                font-family: "Inter", "Segoe UI", sans-serif;
            }
            .wb-shell * { box-sizing: border-box; }
            .wb-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 19px 30px; border-radius: 10px; background: var(--wb-teal); color: #fff; }
            .wb-header h1 { margin: 0; color: #fff !important; font-size: 20px; font-weight: 650; letter-spacing: .2px; }
            .wb-site-tag { color: #cfe9e4; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
            .wb-console { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 1px; background: var(--wb-line); }
            .wb-audience, .wb-compose { background: var(--wb-panel); padding: 24px; }
            .wb-section-title { margin: 0 0 18px; color: var(--wb-muted); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
            .wb-field { margin-bottom: 15px; }
            .wb-field label { display: block; margin-bottom: 6px; color: var(--wb-muted); font-size: 12px; font-weight: 500; }
            .wb-input, .wb-select { width: 100%; min-height: 38px; padding: 9px 10px; border: 1px solid var(--wb-line); border-radius: 5px; outline: none; background: var(--wb-alt); color: var(--wb-text); font-size: 13px; }
            .wb-input:focus, .wb-select:focus { border-color: var(--wb-green-dark); box-shadow: 0 0 0 2px rgba(18, 140, 126, .12); }
            .wb-inline { display: flex; gap: 7px; }
            .wb-inline .wb-input { min-width: 0; }
            .wb-btn { min-height: 36px; padding: 8px 12px; border: 1px solid transparent; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 650; transition: background .15s ease, border-color .15s ease; }
            .wb-btn-send { padding-inline: 20px; background: var(--wb-green); color: #062c1c; }
            .wb-btn-send:hover { background: #1fbd5a; }
            .wb-btn-secondary { border-color: var(--wb-line); background: var(--wb-alt); color: #1f3932; }
            .wb-btn-secondary:hover { border-color: #b9c6c2; background: #eef1f2; }
            .wb-btn-danger { border-color: #f2d3d3; background: #fff4f4; color: #a12626; }
            .wb-icon-btn { width: 38px; flex: 0 0 38px; padding: 0; font-size: 18px; }
            .wb-audience-total { margin: 20px 0; padding-top: 18px; border-top: 1px solid var(--wb-line); }
            .wb-audience-total strong { display: block; color: var(--wb-green-dark); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 34px; font-weight: 500; line-height: 1; }
            .wb-audience-total span { display: block; margin-top: 5px; color: var(--wb-muted); font-size: 12px; }
            .wb-list-head { display: flex; align-items: center; justify-content: space-between; margin: 16px 0 7px; color: var(--wb-muted); font-size: 11px; }
            .wb-recipients { max-height: 270px; overflow: auto; border: 1px solid var(--wb-line); border-radius: 5px; background: var(--wb-alt); }
            .wb-chip { display: flex; gap: 9px; align-items: flex-start; margin: 0; padding: 9px 10px; border-bottom: 1px solid var(--wb-line); color: var(--wb-text); font-size: 12px; cursor: pointer; }
            .wb-chip:last-child { border-bottom: 0; }
            .wb-chip:hover { background: #eef7f3; }
            .wb-chip input { margin-top: 3px; accent-color: var(--wb-green-dark); }
            .wb-chip span { min-width: 0; overflow: hidden; }
            .wb-chip strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
            .wb-chip small { display: block; color: var(--wb-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
            .wb-chip .wb-customer-meta { margin-top: 2px; color: #7d8b92; font-family: "Inter", "Segoe UI", sans-serif; font-size: 10px; }
            .wb-audience-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 8px; }
            .wb-compose-grid { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(260px, .8fr); gap: 24px; }
            .wb-upload-row { display: flex; align-items: center; gap: 10px; }
            .wb-file-name { min-width: 0; overflow: hidden; color: var(--wb-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
            .wb-media-picker { display: flex; align-items: center; gap: 9px; min-height: 74px; padding: 10px; overflow-x: auto; border: 1px solid var(--wb-line); border-radius: 10px; background: #fff; }
            .wb-media-items { display: flex; align-items: center; gap: 9px; }
            .wb-media-tile, .wb-add-media { position: relative; width: 58px; height: 58px; flex: 0 0 58px; overflow: hidden; border: 1px solid #c8d0d3; border-radius: 9px; background: #fff; }
            .wb-media-tile.is-first { border: 2px solid var(--wb-green); }
            .wb-media-tile img { width: 100%; height: 100%; object-fit: cover; }
            .wb-media-tile.wb-item-tile { width: 172px; height: 64px; flex-basis: 172px; display: grid; grid-template-columns: 62px minmax(0, 1fr); overflow: hidden; }
            .wb-media-tile.wb-item-tile img { width: 62px; height: 62px; border-right: 1px solid var(--wb-line); }
            .wb-item-tile-copy { min-width: 0; padding: 9px 22px 7px 8px; }
            .wb-item-tile-copy strong, .wb-item-tile-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .wb-item-tile-copy strong { font-size: 11px; font-weight: 650; }
            .wb-item-tile-copy small { margin-top: 5px; color: var(--wb-green-dark); font-size: 10px; }
            .wb-remove-media { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; padding: 0; border: 0; border-radius: 50%; background: rgba(8, 13, 13, .8); color: #fff; font-size: 13px; line-height: 18px; cursor: pointer; }
            .wb-add-media { display: grid; place-items: center; color: var(--wb-teal); font-size: 28px; font-weight: 300; cursor: pointer; }
            .wb-add-media:hover { border-color: var(--wb-green-dark); background: #eef7f3; }
            .wb-attachment-meta { display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; color: var(--wb-muted); font-size: 10px; }
            .wb-attachment-meta .wb-carousel-warning { color: #9a7100; }
            .wb-file-upload { margin-top: 8px; }
            .wb-carousel-tools { display: none; margin-bottom: 15px; padding: 12px; border: 1px solid #b9ddd2; border-radius: 8px; background: #f1faf7; }
            .wb-carousel-tools.is-visible { display: block; }
            .wb-carousel-tools .wb-inline { align-items: center; }
            .wb-carousel-tools .wb-select { flex: 1; }
            .wb-carousel-help { margin: 7px 0 0; color: var(--wb-muted); font-size: 10px; }
            .wb-preview { min-height: 224px; padding: 18px 14px; border: 1px solid var(--wb-line); border-radius: 14px; background: #e5ddd5; }
            .wb-preview-media { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; width: 90%; margin: 0 0 5px auto; }
            .wb-preview-media:empty { display: none; }
            .wb-preview-media img { width: 100%; height: 92px; object-fit: cover; border-radius: 6px; }
            .wb-preview-media img:only-child { grid-column: 1 / -1; height: 150px; }
            .wb-preview-media.is-carousel { display: flex; width: 100%; margin-left: 0; overflow-x: auto; gap: 7px; }
            .wb-preview-card { width: 142px; flex: 0 0 142px; overflow: hidden; border-radius: 7px; background: #fff; }
            .wb-preview-card img { width: 100%; height: 92px; border-radius: 0; object-fit: cover; }
            .wb-preview-card-copy { padding: 7px; }
            .wb-preview-card-copy strong, .wb-preview-card-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .wb-preview-card-copy strong { font-size: 10px; }
            .wb-preview-card-copy small { margin-top: 4px; color: var(--wb-muted); font-size: 9px; }
            .wb-preview-card-action { padding: 6px; border-top: 1px solid var(--wb-line); color: var(--wb-green-dark); font-size: 9px; font-weight: 650; text-align: center; }
            .wb-preview.is-carousel-preview { display: flex; flex-direction: column; }
            .wb-preview.is-carousel-preview .wb-preview-label { order: 0; }
            .wb-preview.is-carousel-preview .wb-bubble { order: 1; width: 100%; max-width: 100%; margin: 0; padding-bottom: 10px; border-radius: 8px 8px 0 0; }
            .wb-preview.is-carousel-preview .wb-bubble::after { display: none; }
            .wb-preview.is-carousel-preview .wb-preview-media { order: 2; padding: 0 8px 14px; border-radius: 0 0 8px 8px; background: var(--wb-bubble); }
            .wb-preview-label { margin-bottom: 13px; color: var(--wb-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; text-align: center; }
            .wb-bubble { position: relative; max-width: 90%; margin-left: auto; padding: 10px 12px 20px; border-radius: 8px 8px 2px 8px; background: var(--wb-bubble); color: var(--wb-text); font-size: 13px; line-height: 1.45; white-space: normal; }
            .wb-bubble::after { content: "now  ✓✓"; position: absolute; right: 9px; bottom: 5px; color: #5c8a3f; font-size: 9px; }
            .wb-preview-note { margin: 8px 0 0; color: var(--wb-muted); font-size: 11px; }
            .wb-send-row { display: flex; align-items: center; gap: 13px; margin-top: 21px; padding-top: 18px; border-top: 1px solid var(--wb-line); }
            .wb-send-note, .wb-stat { color: var(--wb-muted); font-size: 12px; }
            .wb-stat { margin-top: 8px; }
            .wb-history-section { padding: 20px 30px 28px; border-top: 1px solid var(--wb-line); background: var(--wb-alt); }
            .wb-history-wrap { overflow-x: auto; }
            .wb-history { width: 100%; border-collapse: collapse; background: transparent; font-size: 12px; }
            .wb-history th { padding: 7px 10px; border-bottom: 1px solid var(--wb-line); color: var(--wb-muted); font-size: 10px; font-weight: 600; letter-spacing: .03em; text-align: left; text-transform: uppercase; }
            .wb-history td { padding: 10px; border-bottom: 1px solid var(--wb-line); vertical-align: middle; }
            .wb-history td:not(:first-child) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
            .wb-history a { color: var(--wb-teal); font-weight: 650; }
            .wb-status { display: inline-block; padding: 3px 8px; border-radius: 3px; background: rgba(185,137,0,.14); color: #8b6800; font-family: "Inter", "Segoe UI", sans-serif; font-size: 10px; text-transform: lowercase; }
            .wb-status-completed, .wb-status-sent { background: rgba(37,211,102,.16); color: #087b57; }
            .wb-status-failed { background: rgba(208,50,50,.12); color: #a12626; }
            .wb-empty { padding: 22px 10px !important; color: var(--wb-muted); text-align: center; }
            @media (max-width: 900px) { .wb-console, .wb-compose-grid { grid-template-columns: 1fr; } .wb-recipients { max-height: 220px; } }
            @media (max-width: 520px) { .wb-header, .wb-audience, .wb-compose, .wb-history-section { padding-left: 16px; padding-right: 16px; } .wb-site-tag { display: none; } .wb-send-row { align-items: stretch; flex-direction: column; } }
        </style>

        <div class="wb-shell">
            <header class="wb-header">
                <h1>Broadcast Message</h1>
                <span class="wb-site-tag">whatsapp_integration / approved templates</span>
            </header>

            <div class="wb-console">
                <aside class="wb-audience">
                    <h2 class="wb-section-title">Recipient filters</h2>
                    <div class="wb-field">
                        <label for="wb-region">Region</label>
                        <select class="wb-select wb-audience-filter" id="wb-region"><option value="">All regions</option></select>
                    </div>
                    <div class="wb-field">
                        <label for="wb-district">District</label>
                        <select class="wb-select wb-audience-filter" id="wb-district"><option value="">All districts</option></select>
                    </div>
                    <div class="wb-field">
                        <label for="wb-location">Location</label>
                        <input class="wb-input wb-audience-filter" id="wb-location" placeholder="e.g. Kawempe, Ntinda" />
                    </div>
                    <div class="wb-field">
                        <label for="wb-sales-person">Sales person</label>
                        <select class="wb-select wb-audience-filter" id="wb-sales-person"><option value="">All sales persons</option></select>
                    </div>
                    <div class="wb-audience-total">
                        <strong id="wb-match-count">0</strong>
                        <span>enabled customers match these filters</span>
                    </div>
                    <h2 class="wb-section-title">Saved audience</h2>
                    <div class="wb-field">
                        <label for="wb-group">Saved group</label>
                        <select class="wb-select" id="wb-group"></select>
                    </div>
                    <div class="wb-inline">
                        <input class="wb-input" id="wb-new-group" placeholder="New group name" aria-label="New group name" />
                        <button class="wb-btn wb-btn-secondary wb-icon-btn" id="wb-create-group" title="Create group" aria-label="Create group">+</button>
                        <button class="wb-btn wb-btn-danger wb-icon-btn" id="wb-delete-group" title="Delete selected group" aria-label="Delete selected group">&times;</button>
                    </div>
                    <div class="wb-field">
                        <label for="wb-customer-search">Find customer</label>
                        <input class="wb-input" id="wb-customer-search" placeholder="Name or WhatsApp number" />
                    </div>
                    <div class="wb-list-head"><span>Eligible customers</span><span id="wb-selected-count">0 selected</span></div>
                    <div class="wb-recipients" id="wb-recipients"></div>
                    <div class="wb-audience-actions">
                        <button class="wb-btn wb-btn-secondary" id="wb-select-all">Select visible</button>
                        <button class="wb-btn wb-btn-secondary" id="wb-save-members">Save audience</button>
                    </div>
                </aside>

                <main class="wb-compose">
                    <h2 class="wb-section-title">Compose and preview</h2>
                    <div class="wb-compose-grid">
                        <div>
                            <div class="wb-field">
                                <label for="wb-template">Approved template</label>
                                <select class="wb-select" id="wb-template"></select>
                            </div>
                            <div class="wb-field">
                                <label for="wb-name">Campaign name</label>
                                <input class="wb-input" id="wb-name" placeholder="Weekend promotion" />
                            </div>
                            <div class="wb-carousel-tools" id="wb-carousel-tools">
                                <label for="wb-price-list">Carousel products and prices</label>
                                <div class="wb-inline">
                                    <select class="wb-select" id="wb-price-list"><option value="">Loading price lists...</option></select>
                                    <button class="wb-btn wb-btn-secondary" id="wb-fetch-items" type="button">Fetch Items &amp; Prices</button>
                                </div>
                                <p class="wb-carousel-help">Select exactly 10 Items because this approved template has 10 cards. Each card uses Item.image and the active selling rate from the chosen Item Price list.</p>
                            </div>
                            <div class="wb-field">
                                <label id="wb-media-label">Product photos</label>
                                <div class="wb-media-picker">
                                    <div class="wb-media-items" id="wb-media-items"></div>
                                    <button class="wb-add-media" id="wb-upload" type="button" title="Add product photos" aria-label="Add product photos">+</button>
                                </div>
                                <div class="wb-attachment-meta">
                                    <span id="wb-file-name">No photos selected</span>
                                    <span id="wb-media-limit">0 / 10</span>
                                </div>
                                <div class="wb-file-upload" id="wb-file-upload">
                                    <button class="wb-btn wb-btn-secondary" id="wb-upload-file" type="button">Upload document or video</button>
                                </div>
                            </div>
                            <div class="wb-send-row">
                                <button class="wb-btn wb-btn-send" id="wb-send">Send to 0 customers</button>
                                <button class="wb-btn wb-btn-secondary" id="wb-open-chat">Open chats</button>
                            </div>
                            <div class="wb-send-note">Queued as background jobs and sent gradually.</div>
                            <div class="wb-stat" id="wb-stat"></div>
                        </div>
                        <div>
                            <div class="wb-preview">
                                <div class="wb-preview-label">message preview — sample customer</div>
                                <div class="wb-preview-media" id="wb-preview-media"></div>
                                <div class="wb-bubble" id="wb-preview-text">Select a template to preview.</div>
                            </div>
                            <p class="wb-preview-note">Template variables are personalized separately for each recipient.</p>
                        </div>
                    </div>
                </main>
            </div>

            <section class="wb-history-section">
                <h2 class="wb-section-title">Send queue</h2>
                <div class="wb-history-wrap">
                    <table class="wb-history">
                        <thead><tr><th>Campaign</th><th>Template</th><th>Recipients</th><th>Sent</th><th>Failed</th><th>Status</th><th>Created</th></tr></thead>
                        <tbody id="wb-history"></tbody>
                    </table>
                </div>
            </section>
        </div>
    `);

    const GROUPS_KEY = 'wa_broadcast_groups';

    let customers = [];
    let groups = [];
    let history = [];
    let templates = [];
    let imageAttachments = [];
    let carouselItems = [];
    let defaultSellingPriceList = '';
    let standaloneAttachment = null;
    let attachmentUrl = '';
    let attachmentName = '';

    function setStat(text, color) {
        const $stat = $('#wb-stat');
        $stat.text(text || '');
        $stat.css('color', color || '#60786b');
    }

    function isCarouselTemplate() {
        const template = getSelectedTemplate();
        return Boolean(template && (template.template_name || '').toLowerCase() === 'product_carousel');
    }

    function renderAttachments() {
        const $items = $('#wb-media-items');
        const carouselMode = isCarouselTemplate();

        if (carouselMode) {
            $items.html(carouselItems.map((item, index) => `
                <div class="wb-media-tile wb-item-tile ${index === 0 ? 'is-first' : ''}" title="${frappe.utils.escape_html(item.item_code)}">
                    <img src="${frappe.utils.escape_html(item.image)}" alt="${frappe.utils.escape_html(item.item_name)}" />
                    <div class="wb-item-tile-copy">
                        <strong>${frappe.utils.escape_html(item.item_name)}</strong>
                        <small>${frappe.utils.escape_html(`${item.currency || ''} ${item.price_text || ''}`.trim())}</small>
                    </div>
                    <button class="wb-remove-media" type="button" data-index="${index}" title="Remove product" aria-label="Remove product">&times;</button>
                </div>
            `).join(''));

            $('#wb-preview-media')
                .addClass('is-carousel')
                .html(carouselItems.map(item => `
                    <div class="wb-preview-card">
                        <img src="${frappe.utils.escape_html(item.image)}" alt="${frappe.utils.escape_html(item.item_name)}" />
                        <div class="wb-preview-card-copy">
                            <strong>${frappe.utils.escape_html(item.item_name)}</strong>
                            <small>${frappe.utils.escape_html(`${item.currency || ''} ${item.price_text || ''}`.trim())}</small>
                        </div>
                        <div class="wb-preview-card-action">View Product</div>
                    </div>
                `).join(''));
            $('#wb-upload').hide();
            $('#wb-file-upload').hide();
            $('#wb-media-label').text('Carousel cards');
            $('#wb-media-limit').text(`${carouselItems.length} / 10`);
            $('#wb-file-name')
                .text(carouselItems.length ? `${carouselItems.length} products ready` : 'No products selected')
                .toggleClass('wb-carousel-warning', carouselItems.length === 1);
            attachmentUrl = '';
            attachmentName = '';
            return;
        }

        $items.html(imageAttachments.map((file, index) => `
            <div class="wb-media-tile ${index === 0 ? 'is-first' : ''}" title="${frappe.utils.escape_html(file.file_name)}">
                <img src="${frappe.utils.escape_html(file.file_url)}" alt="${frappe.utils.escape_html(file.file_name)}" />
                <button class="wb-remove-media" type="button" data-index="${index}" title="Remove photo" aria-label="Remove photo">&times;</button>
            </div>
        `).join(''));

        $('#wb-preview-media')
            .removeClass('is-carousel')
            .html(imageAttachments.slice(0, 4).map(file =>
                `<img src="${frappe.utils.escape_html(file.file_url)}" alt="${frappe.utils.escape_html(file.file_name)}" />`
            ).join(''));
        $('#wb-upload').toggle(imageAttachments.length < 10);
        $('#wb-file-upload').show();
        $('#wb-media-label').text('Product photos');
        $('#wb-media-limit').text(`${imageAttachments.length} / 10`);

        if (imageAttachments.length) {
            standaloneAttachment = null;
            attachmentUrl = imageAttachments[0].file_url;
            attachmentName = imageAttachments[0].file_name;
            const suffix = imageAttachments.length === 1 ? '1 photo selected' : `${imageAttachments.length} photos staged`;
            $('#wb-file-name')
                .text(suffix)
                .toggleClass('wb-carousel-warning', imageAttachments.length > 1);
        } else if (standaloneAttachment) {
            attachmentUrl = standaloneAttachment.file_url;
            attachmentName = standaloneAttachment.file_name;
            $('#wb-file-name').text(attachmentName).removeClass('wb-carousel-warning');
        } else {
            attachmentUrl = '';
            attachmentName = '';
            $('#wb-file-name').text('No photos selected').removeClass('wb-carousel-warning');
        }
    }

    function safeParse(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
        catch (e) { return fallback; }
    }

    function saveGroups() { localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); }
    function getSelectedGroup() {
        const groupId = $('#wb-group').val();
        return groups.find(g => g.id === groupId) || null;
    }

    function getSelectedTemplate() {
        const templateName = $('#wb-template').val();
        return templates.find(t => t.template_name === templateName) || null;
    }

    function normalizePhone(phone) {
        let normalized = (phone || '').toString().replace(/\D/g, '');
        if (normalized.startsWith('00')) normalized = normalized.slice(2);

        // Preserve supported international numbers instead of treating every
        // non-256 number as a Ugandan local number.
        if (/^(256\d{9}|91\d{10})$/.test(normalized)) return normalized;

        if (/^0\d{9}$/.test(normalized)) normalized = `256${normalized.slice(1)}`;
        else if (/^\d{9}$/.test(normalized)) normalized = `256${normalized}`;
        return normalized;
    }

    function hasUsableWhatsAppNumber(phone) {
        return /^(256\d{9}|91\d{10})$/.test(normalizePhone(phone));
    }

    function normalizeFilterValue(value) {
        return (value || '').toString().trim().toLowerCase();
    }

    function getFilteredCustomers() {
        const region = normalizeFilterValue($('#wb-region').val());
        const district = normalizeFilterValue($('#wb-district').val());
        const location = normalizeFilterValue($('#wb-location').val());
        const salesPerson = normalizeFilterValue($('#wb-sales-person').val());
        const query = normalizeFilterValue($('#wb-customer-search').val());

        return customers.filter(row => {
            const rowSalesPeople = (row.sales_people || []).map(normalizeFilterValue);
            const searchable = `${row.customer_name || ''} ${row.name || ''} ${row.whatsapp_number || ''}`.toLowerCase();
            return (!region || normalizeFilterValue(row.region) === region)
                && (!district || normalizeFilterValue(row.district) === district)
                && (!location || normalizeFilterValue(row.location).includes(location))
                && (!salesPerson || rowSalesPeople.includes(salesPerson))
                && (!query || searchable.includes(query));
        });
    }

    function hasActiveAudienceFilters() {
        return ['#wb-region', '#wb-district', '#wb-location', '#wb-sales-person', '#wb-customer-search']
            .some(selector => normalizeFilterValue($(selector).val()));
    }

    function setFilterOptions(selector, emptyLabel, values) {
        const $select = $(selector);
        const selected = $select.val();
        const uniqueValues = [...new Set(values.filter(Boolean).map(value => value.toString().trim()))]
            .sort((a, b) => a.localeCompare(b));
        $select.html([
            `<option value="">${emptyLabel}</option>`,
            ...uniqueValues.map(value => `<option value="${frappe.utils.escape_html(value)}">${frappe.utils.escape_html(value)}</option>`)
        ].join(''));
        if (selected && uniqueValues.includes(selected)) $select.val(selected);
    }

    function populateFilterOptions() {
        const selectedRegion = normalizeFilterValue($('#wb-region').val());
        setFilterOptions('#wb-region', 'All regions', customers.map(row => row.region));
        setFilterOptions(
            '#wb-district',
            'All districts',
            customers
                .filter(row => !selectedRegion || normalizeFilterValue(row.region) === selectedRegion)
                .map(row => row.district)
        );
        setFilterOptions(
            '#wb-sales-person',
            'All sales persons',
            customers.flatMap(row => row.sales_people || [])
        );
    }

    function updateAudienceSummary() {
        const selectedGroup = getSelectedGroup();
        const memberNames = new Set((selectedGroup && selectedGroup.members) || []);
        const recipientPhones = new Set(customers
            .filter(row => memberNames.has(row.name) && hasUsableWhatsAppNumber(row.whatsapp_number))
            .map(row => normalizePhone(row.whatsapp_number)));
        const recipientCount = recipientPhones.size;
        const checkedCount = $('.wb-customer:checked').length;
        $('#wb-match-count').text(getFilteredCustomers().length);
        $('#wb-selected-count').text(`${checkedCount} selected`);
        $('#wb-send').text(`Send to ${recipientCount} customer${recipientCount === 1 ? '' : 's'}`);
    }

    function renderGroupOptions() {
        const $group = $('#wb-group');
        if (!groups.length) {
            $group.html('<option value="">No groups yet</option>');
            return;
        }
        const selected = $group.val();
        $group.html(groups.map(g => `<option value="${frappe.utils.escape_html(g.id)}">${frappe.utils.escape_html(g.name)} (${(g.members || []).length})</option>`).join(''));
        if (selected && groups.some(g => g.id === selected)) $group.val(selected); else $group.val(groups[0].id);
        updateAudienceSummary();
    }

    function renderTemplateOptions() {
        const $tpl = $('#wb-template');
        if (!templates.length) {
            $tpl.html('<option value="">No approved templates found</option>');
            return;
        }
        $tpl.html(templates.map(t => `<option value="${frappe.utils.escape_html(t.template_name)}">${frappe.utils.escape_html(t.template_name)} (${frappe.utils.escape_html(t.language || 'en_US')})</option>`).join(''));
        updateTemplatePreview();
    }

    function renderHistory() {
        const $box = $('#wb-history');
        if (!history.length) {
            $box.html('<tr><td class="wb-empty" colspan="7">No broadcasts tracked yet.</td></tr>');
            return;
        }

        $box.html(history.map(item => {
            const campaign = frappe.utils.escape_html(item.broadcast_name || 'Broadcast');
            const templateName = frappe.utils.escape_html(item.name1 || '-');
            const status = frappe.utils.escape_html(item.send_status || 'Draft');
            const statusClass = (item.send_status || 'draft').toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const formLink = frappe.utils.get_form_link(
                'BroadCast Message', item.name, true, campaign
            );
            return `<tr>
                <td>${formLink}</td>
                <td>${templateName}</td>
                <td>${item.recipient_count || 0}</td>
                <td>${item.sent_count || 0}</td>
                <td>${item.failed_count || 0}</td>
                <td><span class="wb-status wb-status-${statusClass}">${status}</span></td>
                <td>${frappe.datetime.str_to_user(item.creation)}</td>
            </tr>`;
        }).join(''));
    }

    function renderCustomersForGroup() {
        const selectedGroup = getSelectedGroup();
        const members = new Set((selectedGroup && selectedGroup.members) || []);
        const $box = $('#wb-recipients');

        const visibleCustomers = getFilteredCustomers()
            .map(row => ({ row, index: customers.indexOf(row) }));

        if (!visibleCustomers.length) {
            $box.html('<div class="wb-stat">No customers found.</div>');
            updateAudienceSummary();
            return;
        }

        const html = visibleCustomers.map(({ row, index }) => {
            const name = frappe.utils.escape_html(row.customer_name || row.name);
            const contact = row.whatsapp_number || '';
            const hasUsableNumber = hasUsableWhatsAppNumber(contact);
            const checked = members.has(row.name) && hasUsableNumber ? 'checked' : '';
            const disabled = hasUsableNumber ? '' : 'disabled';
            const waLine = hasUsableNumber
                ? `<small>${frappe.utils.escape_html(contact)}</small>`
                : `<small class="no-wa">${contact ? 'Invalid WhatsApp number' : 'No WhatsApp number'}</small>`;
            const customerMeta = [row.region, row.district, row.location, ...(row.sales_people || [])]
                .filter(Boolean)
                .map(value => frappe.utils.escape_html(value))
                .join(' · ');
            const metaLine = customerMeta ? `<small class="wb-customer-meta">${customerMeta}</small>` : '';
            return `<label class="wb-chip"><input type="checkbox" class="wb-customer" data-index="${index}" ${checked} ${disabled} /> <span><strong>${name}</strong>${waLine}${metaLine}</span></label>`;
        }).join('');

        $box.html(html);
        updateAudienceSummary();
    }

    function loadTemplates() {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Whatsapp Message Template',
                fields: ['name', 'template_name', 'language', 'status', 'format', 'body_text', 'media_example'],
                filters: [['status', 'in', ['Approved', 'APPROVED']]],
                order_by: 'modified desc',
                limit_page_length: 500
            },
            callback: function(r) {
                templates = (r.message || []).filter(t => t.template_name);
                renderTemplateOptions();
            }
        });
    }

    function loadCarouselSettings() {
        frappe.call({
            method: 'whatsapp_integration.erpnext_whatsapp.doctype.broadcast_message.broadcast_message.get_carousel_settings',
            callback: function(r) {
                const settings = r.message || {};
                defaultSellingPriceList = settings.default_price_list || 'Standard Selling';
                const priceLists = settings.price_lists || [];
                const options = priceLists.map(row =>
                    `<option value="${frappe.utils.escape_html(row.name)}">${frappe.utils.escape_html(row.name)}${row.currency ? ` (${frappe.utils.escape_html(row.currency)})` : ''}</option>`
                );
                if (!priceLists.some(row => row.name === defaultSellingPriceList)) {
                    options.unshift(`<option value="${frappe.utils.escape_html(defaultSellingPriceList)}">${frappe.utils.escape_html(defaultSellingPriceList)}</option>`);
                }
                $('#wb-price-list').html(options.join('')).val(defaultSellingPriceList);
            }
        });
    }

    function fetchCarouselItems(itemCodes, onComplete) {
        const uniqueCodes = [...new Set(itemCodes || [])];
        if (uniqueCodes.length > 10) {
            setStat('A carousel can contain a maximum of 10 products.', '#b63b3b');
            return;
        }

        frappe.call({
            method: 'whatsapp_integration.erpnext_whatsapp.doctype.broadcast_message.broadcast_message.get_carousel_items',
            args: {
                item_codes: uniqueCodes,
                price_list: $('#wb-price-list').val() || defaultSellingPriceList
            },
            freeze: true,
            freeze_message: __('Loading Item images and selling prices...'),
            callback: function(r) {
                const result = r.message || {};
                carouselItems = result.items || [];
                if (result.price_list) $('#wb-price-list').val(result.price_list);
                renderAttachments();

                const skipped = result.skipped || [];
                if (skipped.length) {
                    const details = skipped.map(row => `${row.item_code}: ${row.reason}`).join('; ');
                    setStat(`Skipped products that are not ready: ${details}`, '#9a7100');
                } else {
                    setStat(
                        `${carouselItems.length} product${carouselItems.length === 1 ? '' : 's'} loaded with images and ${result.price_list || 'selling'} prices.`,
                        '#166b48'
                    );
                }
                if (onComplete) onComplete();
            }
        });
    }

    function loadCustomers() {
        frappe.call({
            method: 'whatsapp_integration.erpnext_whatsapp.doctype.broadcast_message.broadcast_message.get_eligible_customers',
            callback: function(r) {
                customers = (r.message && r.message.customers) || [];
                customers.forEach(row => { row.sales_people = []; });
                populateFilterOptions();
                renderCustomersForGroup();
                setStat(`${customers.length} enabled customers loaded.`, '#667781');

                const customerNames = customers.map(row => row.name);
                if (!customerNames.length) return;

                frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'Sales Team',
                        parent: 'Customer',
                        fields: ['parent', 'sales_person'],
                        filters: [
                            ['parenttype', '=', 'Customer']
                        ],
                        limit_page_length: 0
                    },
                    callback: function(salesResponse) {
                        const salesPeopleByCustomer = new Map();
                        (salesResponse.message || []).forEach(row => {
                            if (!row.parent || !row.sales_person) return;
                            if (!salesPeopleByCustomer.has(row.parent)) salesPeopleByCustomer.set(row.parent, []);
                            const values = salesPeopleByCustomer.get(row.parent);
                            if (!values.includes(row.sales_person)) values.push(row.sales_person);
                        });
                        customers.forEach(row => { row.sales_people = salesPeopleByCustomer.get(row.name) || []; });
                        populateFilterOptions();
                        renderCustomersForGroup();
                    }
                });
            }
        });
    }

    function loadHistory() {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'BroadCast Message',
                fields: [
                    'name', 'broadcast_name', 'name1', 'send_status', 'recipient_count',
                    'sent_count', 'failed_count', 'skipped_count', 'creation'
                ],
                order_by: 'creation desc',
                limit_page_length: 50
            },
            callback: function(r) {
                history = r.message || [];
                renderHistory();
            }
        });
    }

    function bootstrapGroups() {
        groups = safeParse(GROUPS_KEY, []);
        if (!groups.length) {
            const ts = Date.now();
            groups = [
                { id: `grp-${ts}-1`, name: 'Group 1', members: [] },
                { id: `grp-${ts}-2`, name: 'Group 2', members: [] },
                { id: `grp-${ts}-3`, name: 'Group 3', members: [] }
            ];
            saveGroups();
        }

        renderGroupOptions();
    }

    function updateTemplatePreview() {
        const tpl = getSelectedTemplate();
        const carouselMode = isCarouselTemplate();
        const preview = (tpl && tpl.body_text)
            ? tpl.body_text.replace(/\{\{customer_name\}\}/g, 'Customer Name')
            : 'Select a template to preview.';
        $('#wb-preview-text').html(frappe.utils.escape_html(preview).replace(/\n/g, '<br>'));
        $('#wb-carousel-tools').toggleClass('is-visible', carouselMode);
        $('.wb-preview').toggleClass('is-carousel-preview', carouselMode);
        renderAttachments();
    }

    $('#wb-group').on('change', function() {
        renderCustomersForGroup();
    });

    $('#wb-customer-search').on('input', function() {
        renderCustomersForGroup();
    });

    $('#wb-region').on('change', function() {
        populateFilterOptions();
        renderCustomersForGroup();
    });

    $('#wb-district, #wb-sales-person').on('change', function() {
        renderCustomersForGroup();
    });

    $('#wb-location').on('input', function() {
        renderCustomersForGroup();
    });

    $('#wb-recipients').on('change', '.wb-customer', function() {
        $('#wb-selected-count').text(`${$('.wb-customer:checked').length} selected`);
    });

    $('#wb-template').on('change', function() {
        updateTemplatePreview();
    });

    $('#wb-fetch-items').on('click', function() {
        if (!isCarouselTemplate()) {
            setStat('Select the approved product_carousel template first.', '#b63b3b');
            return;
        }

        const picker = new frappe.ui.form.MultiSelectDialog({
            doctype: 'Item',
            target: page,
            setters: {
                item_group: null,
                brand: null
            },
            add_filters_group: true,
            get_query() {
                return { filters: { disabled: 0, image: ['is', 'set'] } };
            },
            primary_action_label: __('Load Items & Prices'),
            action(selections) {
                const selectedCodes = [...new Set([
                    ...carouselItems.map(item => item.item_code),
                    ...(selections || [])
                ])];
                if (!selectedCodes.length) {
                    setStat('Select at least one Item.', '#b63b3b');
                    return;
                }
                fetchCarouselItems(selectedCodes, () => picker.dialog.hide());
            }
        });
    });

    $('#wb-price-list').on('change', function() {
        if (carouselItems.length) {
            fetchCarouselItems(carouselItems.map(item => item.item_code));
        }
    });

    $('#wb-upload').on('click', function() {
        new frappe.ui.FileUploader({
            allow_multiple: true,
            allow_web_link: false,
            folder: 'Home/Attachments',
            restrictions: {
                allowed_file_types: ['image/*'],
                max_number_of_files: 10 - imageAttachments.length
            },
            on_success(fileDoc) {
                if (imageAttachments.length >= 10) {
                    setStat('A carousel can contain a maximum of 10 photos.', '#b63b3b');
                    return;
                }
                if (!imageAttachments.some(file => file.file_url === fileDoc.file_url)) {
                    imageAttachments.push({ file_url: fileDoc.file_url, file_name: fileDoc.file_name });
                }
                renderAttachments();
                setStat(
                    imageAttachments.length > 1
                        ? `${imageAttachments.length} photos staged. An approved carousel template is required to send them together.`
                        : `Photo '${fileDoc.file_name}' uploaded.`,
                    imageAttachments.length > 1 ? '#9a7100' : '#166b48'
                );
            }
        });
    });

    $('#wb-media-items').on('click', '.wb-remove-media', function() {
        const index = parseInt($(this).attr('data-index'), 10);
        if (!Number.isNaN(index)) {
            if (isCarouselTemplate()) carouselItems.splice(index, 1);
            else imageAttachments.splice(index, 1);
        }
        renderAttachments();
        if (isCarouselTemplate()) {
            setStat(carouselItems.length ? `${carouselItems.length} product(s) ready.` : 'Carousel selection cleared.', '#667781');
        } else {
            setStat(imageAttachments.length ? `${imageAttachments.length} photo(s) staged.` : 'Photo selection cleared.', '#667781');
        }
    });

    $('#wb-upload-file').on('click', function() {
        new frappe.ui.FileUploader({
            allow_multiple: false,
            allow_web_link: false,
            folder: 'Home/Attachments',
            restrictions: {
                allowed_file_types: ['video/*', '.pdf', '.xlsx', '.xls', '.csv']
            },
            on_success(fileDoc) {
                imageAttachments = [];
                standaloneAttachment = { file_url: fileDoc.file_url, file_name: fileDoc.file_name };
                renderAttachments();
                setStat(`Attachment '${fileDoc.file_name}' uploaded.`, '#166b48');
            }
        });
    });

    $('#wb-select-all').on('click', function() {
        $('.wb-customer').each(function() {
            if (!$(this).is(':disabled')) $(this).prop('checked', true);
        });
        $('#wb-selected-count').text(`${$('.wb-customer:checked').length} selected`);
    });

    $('#wb-save-members').on('click', function() {
        const selectedGroup = getSelectedGroup();
        if (!selectedGroup) {
            setStat('Create/select a group first.', '#b63b3b');
            return;
        }

        const selectedCustomerNames = [];
        $('.wb-customer:checked').each(function() {
            const idx = parseInt($(this).attr('data-index'), 10);
            if (!Number.isNaN(idx) && customers[idx]) selectedCustomerNames.push(customers[idx].name);
        });

        if (hasActiveAudienceFilters()) {
            const visibleNames = new Set($('.wb-customer').map(function() {
                const idx = parseInt($(this).attr('data-index'), 10);
                return !Number.isNaN(idx) && customers[idx] ? customers[idx].name : null;
            }).get().filter(Boolean));
            selectedGroup.members = (selectedGroup.members || [])
                .filter(name => !visibleNames.has(name))
                .concat(selectedCustomerNames);
        } else {
            selectedGroup.members = selectedCustomerNames;
        }
        saveGroups();
        renderGroupOptions();
        renderCustomersForGroup();
        setStat(`Saved ${selectedGroup.members.length} customers in ${selectedGroup.name}.`, '#166b48');
    });

    $('#wb-create-group').on('click', function() {
        const name = ($('#wb-new-group').val() || '').trim();
        if (!name) {
            setStat('Enter group name first.', '#b63b3b');
            return;
        }

        groups.push({ id: `grp-${Date.now()}`, name, members: [] });
        saveGroups();
        renderGroupOptions();
        $('#wb-group').val(groups[groups.length - 1].id).trigger('change');
        $('#wb-new-group').val('');
        setStat(`Group '${name}' created.`, '#166b48');
    });

    $('#wb-delete-group').on('click', function() {
        const selectedGroup = getSelectedGroup();
        if (!selectedGroup) {
            setStat('No group selected.', '#b63b3b');
            return;
        }

        if (groups.length <= 1) {
            setStat('Keep at least one group.', '#b63b3b');
            return;
        }

        groups = groups.filter(g => g.id !== selectedGroup.id);
        saveGroups();
        renderGroupOptions();
        renderCustomersForGroup();
        setStat(`Deleted '${selectedGroup.name}'.`, '#166b48');
    });

    $('#wb-send').on('click', function() {
        const selectedGroup = getSelectedGroup();
        const selectedTemplate = getSelectedTemplate();
        const carouselMode = isCarouselTemplate();

        if (!selectedGroup) {
            setStat('Select a group first.', '#b63b3b');
            return;
        }
        if (!selectedTemplate) {
            setStat('Select an approved template first.', '#b63b3b');
            return;
        }

        if (carouselMode && carouselItems.length !== 10) {
            setStat('The approved product_carousel template requires exactly 10 Items.', '#b63b3b');
            return;
        }

        if (!carouselMode && imageAttachments.length > 1) {
            setStat('Multiple photos are staged, but sending them requires an approved carousel template. Keep one photo for this standard template.', '#b63b3b');
            return;
        }

        if (!carouselMode && imageAttachments.length === 1 && (selectedTemplate.format || '').toLowerCase() !== 'image') {
            setStat('Select an approved image template before sending a product photo.', '#b63b3b');
            return;
        }

        const needsAttachment = ['documentation', 'image', 'video'].includes(
            (selectedTemplate.format || '').toLowerCase()
        );
        if (!carouselMode && needsAttachment && !attachmentUrl) {
            setStat('Upload the template attachment before sending.', '#b63b3b');
            return;
        }

        const selectedNames = selectedGroup.members || [];
        const selectedCustomers = customers.filter(c => selectedNames.includes(c.name));

        const selectedRecipients = selectedCustomers
            .map(c => ({
                contact: normalizePhone(c.whatsapp_number),
                customer_name: c.customer_name || c.name,
                customer: c.name
            }))
            .filter(r => /^256\d{9}$/.test(r.contact));

        if (!selectedRecipients.length) {
            setStat(`Group '${selectedGroup.name}' has no customers with WhatsApp numbers.`, '#b63b3b');
            return;
        }

        const campaignName = ($('#wb-name').val() || `Template: ${selectedTemplate.template_name}`).trim();

        frappe.confirm(
            __(
                'Send template {0} with attachment {1} to {2} customer(s)? WhatsApp messages cannot be recalled.',
                [
                    selectedTemplate.template_name,
                    carouselMode ? `${carouselItems.length} product cards` : (attachmentName || '-'),
                    selectedRecipients.length
                ]
            ),
            function() {
                setStat('Creating and queueing the broadcast...', '#60786b');
                frappe.call({
                    method: 'whatsapp_integration.erpnext_whatsapp.doctype.broadcast_message.broadcast_message.create_and_enqueue_broadcast',
                    args: {
                        campaign_name: campaignName,
                        template_name: selectedTemplate.template_name,
                        customer_names: selectedRecipients.map(recipient => recipient.customer),
                        document_url: carouselMode ? null : attachmentUrl,
                        carousel_item_codes: carouselMode ? carouselItems.map(item => item.item_code) : [],
                        price_list: carouselMode ? ($('#wb-price-list').val() || defaultSellingPriceList) : null
                    },
                    freeze: true,
                    freeze_message: __('Queueing real WhatsApp broadcast...'),
                    callback: function(r) {
                        if (!r.message) return;
                        const excluded = r.message.excluded_count || 0;
                        const detail = excluded ? ` (${excluded} excluded)` : '';
                        setStat(
                            `Broadcast '${campaignName}' queued to ${r.message.recipient_count} recipients${detail}.`,
                            '#166b48'
                        );
                        frappe.show_alert({
                            message: `Real WhatsApp broadcast queued for ${r.message.recipient_count} recipients`,
                            indicator: 'green'
                        }, 8);
                        loadHistory();
                    }
                });
            }
        );
    });

    $('#wb-open-chat').on('click', function() {
        frappe.set_route('whatsapp');
    });

    bootstrapGroups();
    loadTemplates();
    loadCarouselSettings();
    loadCustomers();
    loadHistory();
    renderCustomersForGroup();
    updateTemplatePreview();
    renderAttachments();
};
