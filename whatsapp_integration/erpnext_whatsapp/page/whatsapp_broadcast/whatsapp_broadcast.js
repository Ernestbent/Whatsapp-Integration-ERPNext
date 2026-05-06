frappe.pages['whatsapp_broadcast'].on_page_load = function(wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Whatsapp BroadCast',
        single_column: true
    });

    page.main.html(`
        <style>
            .wb-shell { min-height: calc(100vh - 120px); background: radial-gradient(circle at top left, #e6fff4 0%, #edf4ff 45%, #fff8ed 100%); padding: 24px; }
            .wb-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 16px; }
            .wb-stack { display: grid; gap: 16px; }
            .wb-card { background: #fff; border: 1px solid #deebe4; border-radius: 16px; box-shadow: 0 14px 32px rgba(7, 54, 38, 0.08); padding: 18px; }
            .wb-title { margin: 0; font-size: 24px; color: #13422f; }
            .wb-sub { margin: 6px 0 0; color: #5f776a; }
            .wb-field { margin-top: 14px; }
            .wb-field label { display: block; margin-bottom: 6px; font-weight: 600; color: #294739; }
            .wb-input, .wb-select { width: 100%; border: 1px solid #ccddd4; border-radius: 10px; padding: 10px 12px; background: #fbfefd; }
            .wb-recipients { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin-top: 10px; max-height: 260px; overflow: auto; border: 1px dashed #cde0d6; border-radius: 10px; padding: 10px; background: #fcfffd; }
            .wb-chip { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; color: #264535; }
            .wb-chip small { color: #5f776a; }
            .wb-chip .no-wa { color: #af2f2f; }
            .wb-preview { border: 1px solid #d9e6df; border-radius: 12px; background: #f8fcfa; padding: 10px; }
            .wb-preview-img { max-width: 100%; border-radius: 10px; display: none; margin-bottom: 8px; }
            .wb-preview-gallery { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 8px; }
            .wb-preview-gallery img { width: 100%; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid #d5e3dc; }
            .wb-bubble { margin-left: auto; max-width: 85%; background: #d9fdd3; border-radius: 10px 10px 2px 10px; padding: 10px; color: #163d2d; }
            .wb-actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
            .wb-btn { border: none; border-radius: 10px; padding: 10px 14px; cursor: pointer; font-weight: 700; }
            .wb-btn-send { background: #167a4f; color: #fff; }
            .wb-btn-secondary { background: #e8f3ed; color: #164732; }
            .wb-btn-danger { background: #ffe9e9; color: #8a1d1d; }
            .wb-stat { font-size: 13px; color: #60786b; margin-top: 8px; }
            .wb-history { display: grid; gap: 8px; max-height: 300px; overflow: auto; margin-top: 8px; }
            .wb-history-item { border: 1px solid #e2ece7; border-radius: 10px; padding: 10px; background: #fbfefd; }
            .wb-history-name { font-weight: 700; color: #184332; }
            .wb-history-meta { font-size: 12px; color: #5f776a; margin-top: 3px; }
            .wb-history-msg { margin-top: 6px; color: #2b493b; font-size: 13px; }
            @media (max-width: 900px) { .wb-grid { grid-template-columns: 1fr; } }
        </style>

        <div class="wb-shell">
            <div class="wb-grid">
                <div class="wb-stack">
                    <div class="wb-card">
                        <h2 class="wb-title">Template Broadcast Composer</h2>
                        <p class="wb-sub">Template-only sending. Pick approved template, target group, and track history.</p>

                        <div class="wb-field">
                            <label for="wb-group">Target Group</label>
                            <select class="wb-select" id="wb-group"></select>
                        </div>

                        <div class="wb-field">
                            <label for="wb-template">Approved Template</label>
                            <select class="wb-select" id="wb-template"></select>
                        </div>

                        <div class="wb-field">
                            <label for="wb-name">Campaign Name</label>
                            <input class="wb-input" id="wb-name" placeholder="Weekend Promo" />
                        </div>

                        <div class="wb-field">
                            <label for="wb-image">Images (optional preview only)</label>
                            <input type="file" id="wb-image" accept="image/*" multiple />
                        </div>

                        <div class="wb-actions">
                            <button class="wb-btn wb-btn-send" id="wb-send">Send Template To Group</button>
                            <button class="wb-btn wb-btn-secondary" id="wb-open-chat">Open Whatsapp Chats</button>
                        </div>
                        <div class="wb-stat" id="wb-stat"></div>
                    </div>

                    <div class="wb-card">
                        <h3 style="margin-top:0;color:#1f4937;">Group Manager</h3>
                        <div class="wb-field">
                            <label for="wb-new-group">New Group Name</label>
                            <input class="wb-input" id="wb-new-group" placeholder="Group 4 - East Region" />
                        </div>
                        <div class="wb-actions">
                            <button class="wb-btn wb-btn-secondary" id="wb-create-group">Create Group</button>
                            <button class="wb-btn wb-btn-danger" id="wb-delete-group">Delete Selected Group</button>
                        </div>
                        <div class="wb-field">
                            <label>All Customers (add accordingly to selected group)</label>
                            <div class="wb-recipients" id="wb-recipients"></div>
                        </div>
                        <div class="wb-actions">
                            <button class="wb-btn wb-btn-secondary" id="wb-select-all">Select All With WhatsApp</button>
                            <button class="wb-btn wb-btn-secondary" id="wb-save-members">Save Group Members</button>
                        </div>
                    </div>
                </div>

                <div class="wb-stack">
                    <div class="wb-card">
                        <h3 style="margin-top:0;color:#1f4937;">Template Preview</h3>
                        <div class="wb-preview">
                            <img id="wb-preview-img" class="wb-preview-img" alt="preview" />
                            <div id="wb-preview-gallery" class="wb-preview-gallery"></div>
                            <div class="wb-bubble" id="wb-preview-text">Select a template to preview.</div>
                        </div>
                        <p class="wb-stat">Template body is shown as preview. Real params are not expanded in this simulator.</p>
                    </div>

                    <div class="wb-card">
                        <h3 style="margin-top:0;color:#1f4937;">Broadcast Tracking</h3>
                        <div class="wb-history" id="wb-history"></div>
                    </div>
                </div>
            </div>
        </div>
    `);

    const SIM_QUEUE_KEY = 'wa_sim_broadcast_queue';
    const GROUPS_KEY = 'wa_broadcast_groups';
    const HISTORY_KEY = 'wa_broadcast_history';

    let customers = [];
    let groups = [];
    let history = [];
    let templates = [];
    let imageDataUrls = [];

    function setStat(text, color) {
        const $stat = $('#wb-stat');
        $stat.text(text || '');
        $stat.css('color', color || '#60786b');
    }

    function safeParse(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
        catch (e) { return fallback; }
    }

    function saveGroups() { localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); }
    function saveHistory() { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100))); }

    function getSelectedGroup() {
        const groupId = $('#wb-group').val();
        return groups.find(g => g.id === groupId) || null;
    }

    function getSelectedTemplate() {
        const templateName = $('#wb-template').val();
        return templates.find(t => t.template_name === templateName) || null;
    }

    function normalizePhone(phone) {
        return (phone || '').toString().replace(/\D/g, '');
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
            $box.html('<div class="wb-stat">No broadcasts tracked yet.</div>');
            return;
        }

        $box.html(history.map(item => {
            const campaign = frappe.utils.escape_html(item.campaign_name || 'Broadcast');
            const groupName = frappe.utils.escape_html(item.group_name || 'Unknown Group');
            const templateName = frappe.utils.escape_html(item.template_name || '-');
            const msg = frappe.utils.escape_html((item.preview_text || '').slice(0, 120));
            return `<div class="wb-history-item">
                <div class="wb-history-name">${campaign}</div>
                <div class="wb-history-meta">Group: ${groupName} | Template: ${templateName} | Recipients: ${item.recipient_count} | ${frappe.datetime.str_to_user(item.iso_timestamp)}</div>
                <div class="wb-history-msg">${msg || '(Template broadcast)'}</div>
            </div>`;
        }).join(''));
    }

    function renderCustomersForGroup() {
        const selectedGroup = getSelectedGroup();
        const members = new Set((selectedGroup && selectedGroup.members) || []);
        const $box = $('#wb-recipients');

        if (!customers.length) {
            $box.html('<div class="wb-stat">No customers found.</div>');
            return;
        }

        const html = customers.map((row, idx) => {
            const name = frappe.utils.escape_html(row.customer_name || row.name);
            const contact = normalizePhone(row.whatsapp_number || '');
            const checked = members.has(row.name) ? 'checked' : '';
            const disabled = contact ? '' : 'disabled';
            const waLine = contact ? `<small>${frappe.utils.escape_html(row.whatsapp_number)}</small>` : '<small class="no-wa">No WhatsApp number</small>';
            return `<label class="wb-chip"><input type="checkbox" class="wb-customer" data-index="${idx}" ${checked} ${disabled} /> <span><strong>${name}</strong><br>${waLine}</span></label>`;
        }).join('');

        $box.html(html);
    }

    function queueBroadcastJob(payload) {
        let queue = [];
        try { queue = JSON.parse(localStorage.getItem(SIM_QUEUE_KEY) || '[]'); }
        catch (e) { queue = []; }
        queue.push(payload);
        localStorage.setItem(SIM_QUEUE_KEY, JSON.stringify(queue));
    }

    function loadTemplates() {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Whatsapp Message Template',
                fields: ['name', 'template_name', 'language', 'status', 'body_text'],
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

    function loadCustomers() {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Customer',
                fields: ['name', 'customer_name', 'whatsapp_number'],
                order_by: 'modified desc',
                limit_page_length: 1000
            },
            callback: function(r) {
                customers = r.message || [];
                renderCustomersForGroup();
                const withWa = customers.filter(c => normalizePhone(c.whatsapp_number)).length;
                setStat(`${customers.length} customers loaded (${withWa} with WhatsApp numbers).`, '#60786b');
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

        history = safeParse(HISTORY_KEY, []);
        renderGroupOptions();
        renderHistory();
    }

    function updateTemplatePreview() {
        const tpl = getSelectedTemplate();
        const preview = (tpl && tpl.body_text) ? tpl.body_text : 'Select a template to preview.';
        $('#wb-preview-text').html(frappe.utils.escape_html(preview).replace(/\n/g, '<br>'));
    }

    function renderImagePreview() {
        const $single = $('#wb-preview-img');
        const $gallery = $('#wb-preview-gallery');

        if (!imageDataUrls.length) {
            $single.hide().attr('src', '');
            $gallery.html('');
            return;
        }

        if (imageDataUrls.length === 1) {
            $single.attr('src', imageDataUrls[0]).show();
            $gallery.html('');
            return;
        }

        $single.hide().attr('src', '');
        $gallery.html(imageDataUrls.map((url, idx) => `<img src="${url}" alt="Preview ${idx + 1}" />`).join(''));
    }

    $('#wb-group').on('change', function() {
        renderCustomersForGroup();
    });

    $('#wb-template').on('change', function() {
        updateTemplatePreview();
    });

    $('#wb-image').on('change', function(e) {
        const files = Array.from(e.target.files || []);
        if (!files.length) {
            imageDataUrls = [];
            renderImagePreview();
            return;
        }

        const readers = files.map((file) => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function(ev) {
                resolve(ev.target.result || '');
            };
            reader.onerror = function() {
                resolve('');
            };
            reader.readAsDataURL(file);
        }));

        Promise.all(readers).then((results) => {
            imageDataUrls = results.filter(Boolean);
            renderImagePreview();
        });
    });

    $('#wb-select-all').on('click', function() {
        $('.wb-customer').each(function() {
            if (!$(this).is(':disabled')) $(this).prop('checked', true);
        });
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

        selectedGroup.members = selectedCustomerNames;
        saveGroups();
        renderGroupOptions();
        setStat(`Saved ${selectedCustomerNames.length} customers in ${selectedGroup.name}.`, '#166b48');
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

        if (!selectedGroup) {
            setStat('Select a group first.', '#b63b3b');
            return;
        }
        if (!selectedTemplate) {
            setStat('Select an approved template first.', '#b63b3b');
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
            .filter(r => r.contact);

        if (!selectedRecipients.length) {
            setStat(`Group '${selectedGroup.name}' has no customers with WhatsApp numbers.`, '#b63b3b');
            return;
        }

        const now = new Date();
        const campaignName = ($('#wb-name').val() || `Template: ${selectedTemplate.template_name}`).trim();
        const previewText = selectedTemplate.body_text || `Template ${selectedTemplate.template_name}`;

        const payload = {
            id: `sim-${Date.now()}`,
            campaign_name: campaignName,
            group_id: selectedGroup.id,
            group_name: selectedGroup.name,
            template_name: selectedTemplate.template_name,
            message: `[Template] ${selectedTemplate.template_name}: ${previewText}`,
            preview_text: previewText,
            image_data_urls: imageDataUrls,
            image_data_url: imageDataUrls[0] || '',
            recipients: selectedRecipients,
            recipient_count: selectedRecipients.length,
            time: now.toTimeString().slice(0, 5),
            iso_timestamp: now.toISOString()
        };

        queueBroadcastJob(payload);

        history.unshift({
            id: payload.id,
            campaign_name: payload.campaign_name,
            group_name: payload.group_name,
            template_name: payload.template_name,
            recipient_count: payload.recipient_count,
            preview_text: payload.preview_text,
            iso_timestamp: payload.iso_timestamp
        });

        saveHistory();
        renderHistory();

        setStat(`Template '${payload.template_name}' queued to ${selectedRecipients.length} recipients in ${selectedGroup.name}.`, '#166b48');
        frappe.show_alert({ message: `Template broadcast queued for ${selectedRecipients.length} recipients`, indicator: 'green' }, 4);
    });

    $('#wb-open-chat').on('click', function() {
        frappe.set_route('whatsapp');
    });

    bootstrapGroups();
    loadTemplates();
    loadCustomers();
    renderCustomersForGroup();
    updateTemplatePreview();
};
