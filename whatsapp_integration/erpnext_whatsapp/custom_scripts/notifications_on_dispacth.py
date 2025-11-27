"""
WhatsApp Dispatch Notifications
Save this file as: whatsapp_integration/notifications.py
"""

import frappe
import requests
from frappe import _

def send_dispatch_notification(doc, method=None):
    """
    Send WhatsApp notification when order is dispatched
    Called from Workflow Action or Document Event
    
    Usage in hooks.py:
    doc_events = {
        "Sales Order": {
            "on_update": "whatsapp_integration.notifications.send_dispatch_notification"
        }
    }
    """
    
    try:
        # Check if workflow state is "Dispatch" or "Dispatched"
        if not hasattr(doc, 'workflow_state'):
            return
        
        workflow_state = doc.workflow_state
        
        # Only send notification when dispatched
        if workflow_state not in ["Dispatch", "Dispatched", "To Deliver"]:
            return
        
        print(f"\n📦 Dispatch notification triggered for {doc.name}")
        
        # Get customer mobile number
        customer_mobile = get_customer_mobile(doc.customer)
        
        if not customer_mobile:
            frappe.log_error(
                f"No mobile number found for customer {doc.customer}",
                "WhatsApp Dispatch Notification"
            )
            return
        
        # Prepare Message
        message = prepare_dispatch_message(doc)
        
        # Send WhatsApp message
        result = send_whatsapp_message(customer_mobile, message)
        
        if result.get("success"):
            print(f"✅ Dispatch notification sent to {customer_mobile}")
            
            # Log the notification
            log_notification(doc, customer_mobile, message, result.get("message_id"))
        else:
            print(f"Failed to send notification: {result.get('error')}")
        
    except Exception as e:
        frappe.log_error(
            f"Error sending dispatch notification for {doc.name}: {str(e)}\n{frappe.get_traceback()}",
            "WhatsApp Dispatch Notification Error"
        )


def get_customer_mobile(customer_name):
    """Get customer's WhatsApp number"""
    
    try:
        # Get from Customer doctype - whatsapp_number field
        whatsapp_number = frappe.db.get_value("Customer", customer_name, "whatsapp_number")
        
        if whatsapp_number:
            return whatsapp_number
        
        # Fallback to mobile_no if whatsapp_number is not set
        mobile = frappe.db.get_value("Customer", customer_name, "mobile_no")
        
        if mobile:
            return mobile
        
        # Try to get from primary contact as last resort
        contact_name = frappe.db.get_value(
            "Dynamic Link",
            {
                "link_doctype": "Customer",
                "link_name": customer_name,
                "parenttype": "Contact"
            },
            "parent"
        )
        
        if contact_name:
            mobile = frappe.db.get_value("Contact", contact_name, "mobile_no")
            if mobile:
                return mobile
        
        return None
        
    except Exception as e:
        print(f"Error getting WhatsApp number: {e}")
        return None


def prepare_dispatch_message(doc):
    """Prepare WhatsApp message for dispatch notification"""
    
    # Get company name
    company = doc.company
    
    # Format items list (limit to first 5 items)
    items_text = ""
    for idx, item in enumerate(doc.items[:5], 1):
        items_text += f"\n{idx}. {item.item_name} - Qty: {item.qty}"
    
    if len(doc.items) > 5:
        items_text += f"\n... and {len(doc.items) - 5} more items"
    
    # Get delivery date if available
    delivery_info = ""
    if hasattr(doc, 'delivery_date') and doc.delivery_date:
        delivery_info = f"\n Expected Delivery: {frappe.utils.formatdate(doc.delivery_date)}"
    
    # Get tracking number if available
    tracking_info = ""
    if hasattr(doc, 'tracking_number') and doc.tracking_number:
        tracking_info = f"\n🔍 Tracking Number: {doc.tracking_number}"
    
    # Build message
    message = f"""🎉 Great News!

Your order *{doc.name}* has been dispatched!

📦 *Order Details:*{items_text}

💰 Total Amount: {doc.currency} {doc.grand_total}{delivery_info}{tracking_info}

Thank you for shopping with {company}! 

If you have any questions, feel free to reply to this message.

Best regards,
{company} Team"""
    
    return message


def send_whatsapp_message(mobile_number, message_text):
    """Send WhatsApp message using Cloud API"""
    
    try:
        # Get WhatsApp settings
        phone_number_id = frappe.db.get_single_value("Whatsapp Setting", "phone_number_id")
        access_token = frappe.db.get_single_value("Whatsapp Setting", "access_token")
        
        if not phone_number_id or not access_token:
            raise Exception("WhatsApp settings not configured")
        
        # Clean mobile number (remove spaces, dashes, etc.)
        mobile_number = mobile_number.replace(" ", "").replace("-", "").replace("+", "")
        
        # WhatsApp Cloud API endpoint
        url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "messaging_product": "whatsapp",
            "to": mobile_number,
            "type": "text",
            "text": {
                "preview_url": False,
                "body": message_text
            }
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        message_id = result.get('messages', [{}])[0].get('id')
        
        return {
            "success": True,
            "message_id": message_id
        }
        
    except requests.exceptions.RequestException as e:
        error_msg = str(e)
        if hasattr(e, 'response') and e.response is not None:
            error_msg += f"\nResponse: {e.response.text}"
        
        frappe.log_error(error_msg, "WhatsApp Send Error")
        
        return {
            "success": False,
            "error": error_msg
        }
    
    except Exception as e:
        frappe.log_error(str(e), "WhatsApp Send Error")
        return {
            "success": False,
            "error": str(e)
        }


def log_notification(doc, mobile_number, message_text, message_id):
    """Log the notification for tracking"""
    
    try:
        # Create Whatsapp Message record
        from datetime import datetime
        time_str = datetime.now().strftime("%H:%M:%S")
        
        # Get customer
        customer = doc.customer
        
        whatsapp_doc = frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": frappe.db.get_single_value("Whatsapp Setting", "phone_number_id"),
            "message_type": "text",
            "message": f"[Dispatch Notification] {message_text[:200]}...",
            "timestamp": time_str,
            "customer": customer,
            "media_id": message_id
        })
        whatsapp_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
    except Exception as e:
        print(f"Error logging notification: {e}")