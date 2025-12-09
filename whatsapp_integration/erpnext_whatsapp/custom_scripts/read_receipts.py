import frappe
import requests
from frappe import _

@frappe.whitelist()
def mark_whatsapp_message_read(message_id):
    """
    Marks a WhatsApp Cloud API message as READ.
    This sends a read receipt to the customer via WhatsApp API.
    
    Args:
        message_id (str): The WhatsApp message ID from the API
        
    Returns:
        dict: Success status and response data
    """
    if not message_id:
        return {"ok": False, "error": "No message_id provided"}
    
    # Load WhatsApp API credentials from System Settings
    try:
        access_token = frappe.db.get_single_value("Whatsapp Setting", "access_token")
        phone_number_id = frappe.db.get_single_value("Whatsapp Setting", "phone_number_id")
        
        if not access_token or not phone_number_id:
            frappe.log_error(
                "WhatsApp credentials missing",
                "mark_whatsapp_message_read: Missing access_token or phone_number_id"
            )
            return {"ok": False, "error": "WhatsApp credentials not configured"}
            
    except Exception as e:
        frappe.log_error("Error fetching WhatsApp setting", str(e))
        return {"ok": False, "error": "Failed to fetch WhatsApp settings"}
    
    # API configuration
    api_version = "v21.0"
    url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
    
    payload = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id
    }
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Log successful read receipt
        frappe.logger().info(f"Read receipt sent for message: {message_id}")
        
        return {
            "ok": True,
            "response": response.json(),
            "message": "Read receipt sent successfully"
        }
        
    except requests.exceptions.HTTPError as e:
        error_msg = f"HTTP Error {response.status_code}: {response.text}"
        frappe.log_error(f"Mark Read Failed for {message_id}", error_msg)
        return {
            "ok": False,
            "error": error_msg,
            "status_code": response.status_code
        }
        
    except requests.exceptions.Timeout:
        error_msg = "Request timeout while sending read receipt"
        frappe.log_error(f"Mark Read Timeout for {message_id}", error_msg)
        return {"ok": False, "error": error_msg}
        
    except requests.exceptions.RequestException as e:
        error_msg = f"Network error: {str(e)}"
        frappe.log_error(f"Mark Read Network Error for {message_id}", error_msg)
        return {"ok": False, "error": error_msg}
        
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        frappe.log_error(f"Mark Read Unexpected Error for {message_id}", error_msg)
        return {"ok": False, "error": error_msg}


@frappe.whitelist()
def mark_multiple_messages_read(message_ids):
    """
    Marks multiple WhatsApp messages as read.
    Useful for bulk operations when opening a conversation.
    
    Args:
        message_ids (list or str): List of message IDs or JSON string
        
    Returns:
        dict: Summary of results
    """
    import json
    
    # Handle JSON string input
    if isinstance(message_ids, str):
        try:
            message_ids = json.loads(message_ids)
        except json.JSONDecodeError:
            return {"ok": False, "error": "Invalid JSON format for message_ids"}
    
    if not isinstance(message_ids, list):
        return {"ok": False, "error": "message_ids must be a list"}
    
    results = {
        "total": len(message_ids),
        "success": 0,
        "failed": 0,
        "errors": []
    }
    
    for msg_id in message_ids:
        result = mark_whatsapp_message_read(msg_id)
        if result.get("ok"):
            results["success"] += 1
        else:
            results["failed"] += 1
            results["errors"].append({
                "message_id": msg_id,
                "error": result.get("error")
            })
    
    results["ok"] = results["failed"] == 0
    return results