import frappe
import requests
import json

@frappe.whitelist()
def mark_whatsapp_messages_read(contact_number):
    """
    Mark all incoming WhatsApp messages from a contact as read.
    This sends blue ticks to the sender on WhatsApp.
    """
    try:
        # Get WhatsApp API credentials from settings
        settings = frappe.get_single("Whatsapp Settings")
        access_token = settings.access_token
        phone_number_id = settings.phone_number_id
        api_version = settings.get("api_version", "v21.0")
        
        if not access_token or not phone_number_id:
            frappe.log_error("WhatsApp credentials not configured", "Mark Read Error")
            return {"success": False, "error": "WhatsApp not configured"}
        
        # Get all incoming messages from this contact that haven't been marked as read
        # Using your existing 'message_id' field
        messages = frappe.db.get_all(
            "Whatsapp Message",
            filters={
                "from_number": contact_number,
                "custom_status": "Incoming"
            },
            fields=["name", "message_id"],
            order_by="creation desc",
            limit=10  # Mark last 10 messages as read
        )
        
        if not messages:
            return {"success": True, "message": "No messages to mark"}
        
        # So we only need to mark the most recent message
        latest_message = messages[0]
        whatsapp_msg_id = latest_message.get("message_id")
        
        if not whatsapp_msg_id:
            frappe.log_error(
                f"No WhatsApp message ID found for {latest_message.name}", 
                "Mark Read Error"
            )
            return {"success": False, "error": "No WhatsApp message ID"}
        
        # Call WhatsApp API to mark as read
        url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": whatsapp_msg_id
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        
        if response.status_code == 200:
            # Successfully marked as read
            frappe.logger().info(f"Marked messages as read for {contact_number}")
            return {
                "success": True,
                "message": "Messages marked as read",
                "count": len(messages)
            }
        else:
            error_msg = response.text
            frappe.log_error(
                f"WhatsApp API Error: {error_msg}", 
                "Mark Read Failed"
            )
            return {
                "success": False,
                "error": f"API Error: {response.status_code}"
            }
            
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Mark Read Exception")
        return {
            "success": False,
            "error": str(e)
        }