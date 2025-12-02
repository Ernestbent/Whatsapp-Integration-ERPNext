import frappe

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
