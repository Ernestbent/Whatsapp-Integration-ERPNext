import frappe


CHAT_ROLES = ("CRM", "System Manager")


def _ensure_chat_access():
    """Keep permission-bypassing chat queries limited to page users."""
    frappe.only_for(CHAT_ROLES)


def _attach_file_sizes(messages):
    """Attach File.file_size to document rows without adding another custom field."""
    file_urls = list({
        file_url
        for row in messages
        for file_url in (row.get("custom_document"), row.get("custom_template_header_file"))
        if file_url
    })
    if not file_urls:
        return messages

    files = frappe.get_all(
        "File",
        filters={"file_url": ["in", file_urls]},
        fields=["file_url", "file_size"],
        limit_page_length=0,
    )
    size_by_url = {row.file_url: row.file_size for row in files}
    for message in messages:
        message.file_size = size_by_url.get(message.custom_document)
        message.template_header_file_size = size_by_url.get(message.custom_template_header_file)
    return messages


@frappe.whitelist()
def get_conversations():
    """Return message rows used to build the conversation sidebar."""
    _ensure_chat_access()
    return frappe.get_all(
        "Whatsapp Message",
        fields=[
            "name",
            "customer",
            "customer.customer_name as customer_name",
            "custom_user",
            "custom_user.first_name as user_first_name",
            "from_number",
            "message",
            "message_type",
            "custom_document",
            "custom_template_type",
            "creation",
            "custom_status",
            "custom_read",
            "message_status",
        ],
        order_by="creation desc",
        limit_page_length=0,
    )


@frappe.whitelist()
def get_chat_history(contact):
    """Return the complete message history for one sidebar contact."""
    _ensure_chat_access()
    contact = str(contact or "").strip()
    if not contact:
        return []

    messages = frappe.get_all(
        "Whatsapp Message",
        fields=[
            "name",
            "message",
            "from_number",
            "creation",
            "custom_status",
            "custom_document",
            "custom_read",
            "message_id",
            "message_type",
            "timestamp",
            "message_status",
            "customer",
            "custom_reaction",
            "custom_reaction_from",
            "custom_reactions",
            "custom_reply_to_name",
            "custom_reply_to_sender",
            "custom_reply_to_text",
            "custom_template_type",
            "custom_template_data",
            "custom_template_header_type",
            "custom_template_header_file",
            "custom_template_footer",
        ],
        filters={"from_number": contact},
        order_by="creation asc",
        limit_page_length=0,
    )
    return _attach_file_sizes(messages)


@frappe.whitelist()
def get_chat_statuses(contact):
    """Return recent delivery states for the open conversation."""
    _ensure_chat_access()
    contact = str(contact or "").strip()
    if not contact:
        return []

    return frappe.get_all(
        "Whatsapp Message",
        fields=["name", "message_id", "message_status", "custom_status", "timestamp"],
        filters={"from_number": contact},
        order_by="creation desc",
        limit_page_length=100,
    )

@frappe.whitelist()
def get_unread_messages(limit=5):
    """Return last unread WhatsApp messages with link to live chat"""
    messages = frappe.db.sql("""
        SELECT 
            wm.name,
            wm.message,
            wm.from_number,
            wm.creation,
            wm.timestamp,
            wlc.name as live_chat_name,
            wlc.contact_name
        FROM `tabWhatsapp Message` wm
        LEFT JOIN `tabWhatsapp Live Chat` wlc ON wm.from_number = wlc.contact
        WHERE wm.custom_status = 'Incoming'
        AND wm.custom_read = 0
        ORDER BY wm.timestamp DESC
        LIMIT %s
    """, (limit,), as_dict=True)
    return messages

@frappe.whitelist()
def mark_message_read(message_name):
    """Mark single message as read"""
    frappe.db.sql("""
        UPDATE `tabWhatsapp Message`
        SET custom_read = 1
        WHERE name = %s
    """, (message_name,))
    frappe.db.commit()
    return {"success": True}

@frappe.whitelist()
def mark_all_read_by_number(from_number):
    """Mark all unread messages from a number as read"""
    _ensure_chat_access()
    frappe.db.sql("""
        UPDATE `tabWhatsapp Message`
        SET custom_read = 1
        WHERE from_number = %s
        AND custom_status = 'Incoming'
        AND custom_read = 0
    """, (from_number,))
    frappe.db.commit()
    return {"success": True, "message": f"All messages from {from_number} marked as read"}

@frappe.whitelist()
def get_chat_messages(contact):
    """Return all messages for a contact to populate chat area"""
    messages = frappe.db.sql("""
        SELECT name, message, from_number, creation
        FROM `tabWhatsapp Message`
        WHERE from_number = %s
        ORDER BY creation ASC
    """, (contact,), as_dict=True)

    html = '<div style="padding: 10px;">'
    for msg in messages:
        align = 'right' if msg.from_number != contact else 'left'
        html += f'''
        <div style="text-align:{align}; margin-bottom: 8px;">
            <span style="display:inline-block; padding: 6px 12px; 
                         background-color: #f1f0f0; border-radius: 10px; max-width:80%;">
                {frappe.utils.escape_html(msg.message)}
            </span>
            <div style="font-size:10px; color:#999;">{frappe.datetime.comment_when(msg.creation)}</div>
        </div>
        '''
    html += '</div>'
    return html


@frappe.whitelist()
def get_recipient_name_map():
    """
    Return phone -> contact_name map from Customer Receipients child table.
    Uses get_all to avoid client-side permission issues on child doctype.
    """
    _ensure_chat_access()
    rows = frappe.get_all(
        "Customer Receipients",
        fields=["contact_name", "phone_number", "parent"],
        filters={"phone_number": ["!=", ""]},
        limit_page_length=0,
    )

    mapping = {}
    for row in rows or []:
        phone = "".join(ch for ch in (row.get("phone_number") or "") if ch.isdigit())
        if not phone:
            continue
        if phone not in mapping:
            mapping[phone] = row.get("contact_name") or row.get("parent")

    return mapping
