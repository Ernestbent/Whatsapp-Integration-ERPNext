import frappe
from whatsapp_integration.erpnext_whatsapp.whatsapp_utils import send_text_message, send_location_message

def send_order_confirmation(doc, method):
    """
    Send WhatsApp message when Sales Order is submitted
    """
    try:
        # Hardcoded phone number for testing
        phone = "256757001909"
        
        # Compose message
        message = f"""
Hello 👋!

Your order {doc.name} has been confirmed.

Order Details:
- Customer: {doc.customer}
- Total Amount: {doc.currency} {doc.grand_total:,.2f}
- Delivery Date: {doc.delivery_date or 'TBD'}

Thank you for your business!
        """.strip()
        
        # Send message
        result = send_text_message(phone, message)
        
        if result.get("success"):
            frappe.msgprint(f"WhatsApp notification sent! Message ")
            doc.add_comment("Comment", f"WhatsApp notification sent: {result.get('message_id')}")
        else:
            frappe.msgprint(f"Failed to send WhatsApp: {result.get('error')}", indicator="red")
            
    except Exception as e:
        frappe.log_error(f"WhatsApp notification error: {str(e)}", "WhatsApp Event")
        frappe.msgprint(f"Error: {str(e)}", indicator="red")


def send_invoice_notification(doc, method):
    """
    Send WhatsApp message when Sales Invoice is submitted
    """
    try:
        phone = "256757001909"
        
        message = f"""
Hello 👋!,

Invoice {doc.name} has been generated.

Customer: {doc.customer}
Amount Due: {doc.currency} {doc.outstanding_amount:,.2f}
Due Date: {doc.due_date}

Please make payment at your earliest convenience.

Thank you!
        """.strip()
        
        result = send_text_message(phone, message)
        
        if result.get("success"):
            frappe.msgprint("WhatsApp invoice notification sent!")
            doc.add_comment("Comment", f"WhatsApp invoice sent: {result.get('message_id')}")
            
    except Exception as e:
        frappe.log_error(f"WhatsApp invoice notification error: {str(e)}", "WhatsApp Event")


def send_delivery_notification(doc, method):
    """
    Send WhatsApp message when Delivery Note is submitted
    """
    try:
        phone = "256757001909"
        
        message = f"""
Hello 👋,

Your order has been dispatched!

Delivery Note: {doc.name}
Customer: {doc.customer}
Items: {len(doc.items)} item(s)

Your delivery is on the way.

Thank you for choosing us!
        """.strip()
        
        result = send_text_message(phone, message)
        
        if result.get("success"):
            frappe.msgprint("WhatsApp delivery notification sent!")
            doc.add_comment("Comment", f"WhatsApp delivery sent: {result.get('message_id')}")
            
    except Exception as e:
        frappe.log_error(f"WhatsApp delivery notification error: {str(e)}", "WhatsApp Event")


def send_delivery_location(doc, method):
    """
    Send WhatsApp location message when Delivery Note is submitted
    """
    try:
        phone = "256757001909"

        # Example location details
        latitude = 0.367648
        longitude = 32.5661245
        name = "Autozone Professional Ltd"
        address = "Opposite, Mbogo Junior College, Mbogo Rd, Kampala"

        result = send_location_message(phone, latitude, longitude, name, address)

        if result.get("success"):
            frappe.msgprint("📍 WhatsApp location message sent!")
            doc.add_comment("Comment", f"WhatsApp location sent: {result.get('message_id')}")
        else:
            frappe.msgprint(f"Failed to send location: {result.get('error')}", indicator="red")

    except Exception as e:
        frappe.log_error(f"WhatsApp location notification error: {str(e)}", "WhatsApp Event")
        frappe.msgprint(f"Error: {str(e)}", indicator="red")

def send_payment_notification(doc, method):
    """
    Send WhatsApp message when Payment Entry is submitted
    """
    try:
        # Hardcoded phone number for testing
        phone = "256757001909"
        
        # Compose message
        message = f"""
Hello 👋,

Your payment has been received/processed.

Payment Entry: {doc.name}
Customer: {doc.party_name or doc.customer or 'N/A'}
Payment Type: {doc.payment_type}
# Paid From: {doc.paid_from}
# Paid To: {doc.paid_to}
Amount: {doc.paid_amount} 
Payment Date: {doc.posting_date}

Thank you for your prompt payment!
        """.strip()
        
        # Send WhatsApp message
        result = send_text_message(phone, message)
        
        if result.get("success"):
            frappe.msgprint("Payment notification sent!")
            doc.add_comment("Comment", f"WhatsApp payment sent: {result.get('message_id')}")
        else:
            frappe.msgprint(f"Failed to send WhatsApp payment notification: {result.get('error')}", indicator="red")
            
    except Exception as e:
        frappe.log_error(f"WhatsApp payment notification error: {str(e)}", "WhatsApp Event")
        frappe.msgprint(f"Error sending WhatsApp payment notification: {str(e)}", indicator="red")

