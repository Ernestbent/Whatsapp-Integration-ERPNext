import frappe
import requests
from datetime import datetime


def send_proforma_document(docname):
    """
    Main function to send Sales Invoice / Proforma PDF via WhatsApp.
    """
    try:
        doc = frappe.get_doc("Sales Invoice", docname)
    except Exception as e:
        frappe.log_error(f"Sales Invoice fetch failed: {str(e)}", "WhatsApp Error")
        return

    # WhatsApp credentials
    settings = frappe.get_single("Whatsapp Setting")
    PHONE_NUMBER_ID = settings.get("phone_number_id")
    WHATSAPP_TOKEN = settings.get("access_token")
    API_VERSION = "v24.0"

    if not PHONE_NUMBER_ID or not WHATSAPP_TOKEN:
        frappe.log_error("WhatsApp credentials missing in Whatsapp Setting", "WhatsApp Config")
        return

    # Get customer WhatsApp number
    if not doc.customer:
        frappe.log_error(f"No customer selected for Sales Invoice {doc.name}", "WhatsApp Error")
        return

    customer_doc = frappe.get_doc("Customer", doc.customer)
    raw_whatsapp = customer_doc.whatsapp_number

    if not raw_whatsapp:
        frappe.log_error(f"Customer {doc.customer} has no WhatsApp number", "WhatsApp Error")
        return

    # Clean and format WhatsApp number for Uganda (256)
    raw_number = ''.join(filter(str.isdigit, raw_whatsapp))

    if raw_number.startswith("0") and len(raw_number) >= 10:
        to_whatsapp = "256" + raw_number[1:]
    elif raw_number.startswith("256"):
        to_whatsapp = raw_number
    elif len(raw_number) == 9:
        to_whatsapp = "256" + raw_number
    else:
        to_whatsapp = "256" + raw_number.lstrip("0")

    # Final validation: must be 12 digits, start with 256
    if not (len(to_whatsapp) == 12 and to_whatsapp.startswith("256") and to_whatsapp.isdigit()):
        frappe.log_error(
            f"Invalid WhatsApp number after formatting: {to_whatsapp} "
            f"(original: {raw_whatsapp})",
            "WhatsApp Invalid Number"
        )
        return

    frappe.log(f"Formatted WhatsApp number: {to_whatsapp}")

    # Generate PDF
    try:
        pdf_bytes = frappe.get_print(
            doctype="Sales Invoice",
            name=doc.name,
            print_format="Invoice Printing",
            as_pdf=True
        )
    except Exception as e:
        frappe.log_error(f"PDF generation failed: {str(e)}", "WhatsApp Error")
        return

    # Save PDF to File doctype for reference
    filename = f"Invoice_{doc.name}.pdf"
    file_url = None
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

    # Upload PDF to WhatsApp Cloud
    upload_url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/media"
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    files = {
        "file": (filename, pdf_bytes, "application/pdf"),
        "type": (None, "document"),  # Correct type for document
        "messaging_product": (None, "whatsapp")
    }

    media_id = None
    try:
        upload_resp = requests.post(upload_url, headers=headers, files=files, timeout=60)
        upload_resp.raise_for_status()
        media_id = upload_resp.json().get("id")
        if not media_id:
            raise Exception("No media ID returned from WhatsApp")
    except Exception as e:
        error_msg = f"WhatsApp media upload failed: {str(e)}"
        if 'upload_resp' in locals():
            error_msg += f"\nResponse: {upload_resp.text}"
        frappe.log_error(error_msg, "WhatsApp Upload Failed")

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

    # Send WhatsApp message with document
    msg_url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_whatsapp,
        "type": "document",
        "document": {
            "id": media_id,
            "filename": filename,
            "caption": f"Sales Invoice / Proforma\nInvoice No: {doc.name}\nFrom: {doc.company}"
        }
    }

    try:
        msg_resp = requests.post(msg_url, json=payload, headers=headers, timeout=60)
        msg_resp.raise_for_status()
        response_data = msg_resp.json()
        whatsapp_msg_id = response_data.get("messages", [{}])[0].get("id", "")

        # Success: Log and add comment
        log_whatsapp_message(
            from_number=to_whatsapp,
            message_type="document",
            message=f"Document: {filename} – Sent successfully",
            media_id=media_id,
            customer=doc.customer,
            message_status="sent",
            whatsapp_message_id=whatsapp_msg_id,
            file_url=file_url
        )

        doc.add_comment("Comment", f"WhatsApp Invoice sent successfully to {to_whatsapp}")

    except Exception as e:
        error_msg = f"WhatsApp send failed: {str(e)}"
        if 'msg_resp' in locals():
            error_msg += f"\nResponse: {msg_resp.text}"
        frappe.log_error(error_msg, "WhatsApp Send Failed")

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
    Log outgoing WhatsApp message to Whatsapp Message doctype
    """
    try:
        current_time = datetime.now().strftime("%H:%M:%S")

        msg_doc = frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": from_number,
            "message_type": message_type,
            "message": message,
            "media_id": media_id,
            "timestamp": current_time,
            "customer": customer,
            "custom_status": "Outgoing",
            "message_status": message_status,
            "whatsapp_message_id": whatsapp_message_id or "",
        })
        msg_doc.insert(ignore_permissions=True)

        if file_url:
            frappe.db.set_value("Whatsapp Message", msg_doc.name, "custom_document", file_url)

        frappe.db.commit()

        frappe.publish_realtime("whatsapp_new_message", {
            "contact_number": from_number,
            "message_name": msg_doc.name,
            "timestamp": current_time
        }, after_commit=True)

    except Exception as e:
        frappe.log_error(f"Failed to log WhatsApp message: {str(e)}", "WhatsApp Message Log Error")


# Background job hooks
def send_proforma_background(doc, method):
    """
    Hook: on_submit of Sales Invoice → enqueue WhatsApp send
    """
    if not doc.customer:
        frappe.msgprint("Customer not set. Cannot send WhatsApp message.", indicator="red")
        return

    frappe.enqueue(
        "whatsapp_integration.erpnext_whatsapp.custom_scripts.upload_media_whatsapp_cloud.send_proforma_background_job",
        docname=doc.name,
        queue="long",
        timeout=600,
        enqueue_after_commit=True
    )


def send_proforma_background_job(docname):
    """
    Background job wrapper
    """
    try:
        send_proforma_document(docname)
    except Exception as e:
        frappe.log_error(
            f"Background WhatsApp send failed for {docname}: {str(e)}",
            "WhatsApp Background Job"
        )