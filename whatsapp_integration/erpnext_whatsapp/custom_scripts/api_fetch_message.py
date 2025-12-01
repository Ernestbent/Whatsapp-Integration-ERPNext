import frappe

@frappe.whitelist()
def get_unread_messages():
    """Get unread WhatsApp messages with live chat links"""
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
        LIMIT 5
    """, as_dict=True)
    return messages

@frappe.whitelist()
def mark_message_read(message_name):
    """Mark message as read WITHOUT updating modified timestamp - COMPLETELY SILENT"""
    # we Use raw SQL to update ONLY the custom_read field without triggering modified
    frappe.db.sql("""
        UPDATE `tabWhatsapp Message`
        SET custom_read = 1
        WHERE name = %s
    """, (message_name,))
    frappe.db.commit()
    return {"success": True}

@frappe.whitelist()
def mark_all_read_by_number(from_number):
    """Mark ALL messages from a specific number as read - BULK UPDATE"""
    frappe.db.sql("""
        UPDATE `tabWhatsapp Message`
        SET custom_read = 1
        WHERE from_number = %s
        AND custom_status = 'Incoming'
        AND custom_read = 0
    """, (from_number,))
    
    frappe.db.commit()
    
    return {
        "success": True, 
        "message": f"All messages from {from_number} marked as read"
    }