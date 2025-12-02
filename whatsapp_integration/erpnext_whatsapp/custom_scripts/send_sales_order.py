import frappe
import requests
from datetime import datetime

def send_sales_order_document(docname):
    """
    Main function to send Sales Order via WhatsApp.
    """
    try:
        doc = frappe.get_doc("Sales Order", docname)
    except Exception as e:
        frappe.log_error(f"Sales Order fetch failed: {str(e)}", "WhatsApp Error")
        return

    # WhatsApp credentials
    settings = frappe.get_single("Whatsapp Setting")
    PHONE_NUMBER_ID = settings.get("phone_number_id")
    WHATSAPP_TOKEN = settings.get("access_token")
    API_VERSION = "v24.0"

    if not PHONE_NUMBER_ID or not WHATSAPP_TOKEN:
        frappe.log_error("WhatsApp credentials missing", "WhatsApp Config")
        return

    # Get customer WhatsApp number
    if not doc.customer:
        frappe.log_error(f"No customer selected for Sales Order {doc.name}", "WhatsApp Error")
        return

    customer_doc = frappe.get_doc("Customer", doc.customer)
    to_whatsapp = customer_doc.whatsapp_number

    if not to_whatsapp:
        frappe.log_error(f"Customer {doc.customer} has no WhatsApp number", "WhatsApp Error")
        return

    # Clean number
    to_whatsapp = ''.join(filter(str.isdigit, to_whatsapp))

    # Generate PDF
    try:
        pdf_bytes = frappe.get_print(
            doctype="Sales Order",
            name=doc.name,
            print_format="Sales Order Print",
            as_pdf=True
        )
    except Exception as e:
        frappe.log_error(f"PDF generation failed: {str(e)}", "WhatsApp Error")
        return

    # Save PDF to File doctype for reference
    filename = f"SalesOrder_{doc.name}.pdf"
    try:
        file_doc = frappe.get_doc({
            "doctype": "File",
            "file_name": filename,
            "folder": "Home",
            "is_private": 0,
            "content": pdf_bytes
        })
        file_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        file_url = file_doc.file_url
    except Exception as e:
        frappe.log_error(f"File save failed: {str(e)}", "WhatsApp Error")
        file_url = None

    # Upload PDF to WhatsApp Cloud
    upload_url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/media"
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    files = {
        "file": (filename, pdf_bytes, "application/pdf"),
        "type": (None, "application/pdf"),
        "messaging_product": (None, "whatsapp")
    }

    try:
        upload_resp = requests.post(upload_url, headers=headers, files=files, timeout=30)
        upload_resp.raise_for_status()
        media_id = upload_resp.json()["id"]
    except Exception as e:
        error_msg = str(e)
        if 'upload_resp' in locals():
            error_msg += f"\nResponse: {upload_resp.text}"
        frappe.log_error(error_msg, "WhatsApp Upload Failed")
        
        # Log failed upload to Whatsapp Message
        log_whatsapp_message(
            from_number=to_whatsapp,
            message_type="document",
            message=f"Document: {filename} - Upload failed",
            media_id="",
            customer=doc.customer,
            message_status="failed",
            whatsapp_message_id="",
            file_url=file_url
        )
        return

    # Send WhatsApp message
    msg_url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_whatsapp,
        "type": "document",
        "document": {
            "id": media_id,
            "filename": filename,
            "caption": f"Sales Order from {doc.company}"
        }
    }

    try:
        msg_resp = requests.post(msg_url, json=payload, headers=headers, timeout=30)
        msg_resp.raise_for_status()
        response_data = msg_resp.json()
        
        # Get WhatsApp message ID from response
        whatsapp_msg_id = response_data.get("messages", [{}])[0].get("id", "")
        
        # Log successful message to Whatsapp Message doctype
        log_whatsapp_message(
            from_number=to_whatsapp,
            message_type="document",
            message=f"Document: {filename} – Sales Order from {doc.company}",
            media_id=media_id,
            customer=doc.customer,
            message_status="sent",
            whatsapp_message_id=whatsapp_msg_id,
            file_url=file_url
        )
        
        doc.add_comment("Comment", f"WhatsApp Sales Order sent to {to_whatsapp}")
        
    except Exception as e:
        error_msg = str(e)
        if 'msg_resp' in locals():
            error_msg += f"\nResponse: {msg_resp.text}"
        frappe.log_error(error_msg, "WhatsApp Send Failed")
        
        # Log failed send to Whatsapp Message
        log_whatsapp_message(
            from_number=to_whatsapp,
            message_type="document",
            message=f"Document: {filename} - Send failed",
            media_id=media_id,
            customer=doc.customer,
            message_status="failed",
            whatsapp_message_id="",
            file_url=file_url
        )


def log_whatsapp_message(from_number, message_type, message, media_id, customer, message_status, whatsapp_message_id, file_url=None):
    """
    Create a Whatsapp Message record for outgoing messages
    """
    try:
        # Get current time in HH:MM:SS format
        current_time = datetime.now().strftime("%H:%M:%S")
        
        # Create Whatsapp Message document
        msg_doc = frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": from_number,
            "message_type": message_type,
            "message": message,
            "media_id": media_id,
            "timestamp": current_time,
            "customer": customer,
            "custom_status": "Outgoing",  # Mark as outgoing
            "message_status": message_status,  # sent, delivered, read, failed
            "whatsapp_message_id": whatsapp_message_id or "",
        })
        
        msg_doc.insert(ignore_permissions=True)
        
        # Save the file URL to custom_document field if available
        if file_url:
            frappe.db.set_value("Whatsapp Message", msg_doc.name, "custom_document", file_url)
        
        frappe.db.commit()
        
        # Publish realtime event so the UI updates
        frappe.publish_realtime("whatsapp_new_message", {
            "contact_number": from_number,
            "message_name": msg_doc.name,
            "timestamp": current_time
        }, after_commit=True)
        
    except Exception as e:
        frappe.log_error(f"Failed to log WhatsApp message: {str(e)}", "WhatsApp Message Log Error")


def send_sales_order_background(doc, method):
    """
    Enqueue WhatsApp sending in background
    Hook this to Sales Order on_submit
    """
    if not doc.customer:
        frappe.msgprint("Customer not set. Cannot send WhatsApp message.", indicator="red")
        return

    frappe.enqueue(
        "whatsapp_integration.erpnext_whatsapp.background_jobs.send_sales_order_job.send_sales_order_whatsapp",
        docname=doc.name,
        queue="long",
        timeout=300,
        enqueue_after_commit=True
    )
    frappe.msgprint("Success")


def send_sales_order_whatsapp(docname):
    """
    Background job that actually sends the Sales Order
    """
    try:
        send_sales_order_document(docname)
    except Exception as e:
        frappe.log_error(
            f"Background WhatsApp send failed for {docname}: {str(e)}",
            "WhatsApp Background Job"
        )