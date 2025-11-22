import frappe
import requests

def send_payment_document_file(docname):
    """
    Main function to send Payment Entry via WhatsApp.
    """
    try:
        doc = frappe.get_doc("Payment Entry", docname)
    except Exception as e:
        frappe.log_error(f"Payment Entry fetch failed: {str(e)}", "WhatsApp Error")
        return

    # WhatsApp credentials
    settings = frappe.get_single("Whatsapp Setting")
    PHONE_NUMBER_ID = settings.get("phone_number_id")
    WHATSAPP_TOKEN = settings.get("access_token")
    API_VERSION = "v24.0"

    if not PHONE_NUMBER_ID or not WHATSAPP_TOKEN:
        frappe.log_error("WhatsApp credentials missing", "WhatsApp Config")
        return

    # Get customer/party WhatsApp number
    to_whatsapp = getattr(doc, "party_contact_number", None) or "256757001909"  # fallback for testing
    to_whatsapp = ''.join(filter(str.isdigit, to_whatsapp))

    if not to_whatsapp:
        frappe.log_error(f"Payment Entry {doc.name} has no valid WhatsApp number", "WhatsApp Error")
        return

    # Generate PDF
    try:
        pdf_bytes = frappe.get_print(
            doctype="Payment Entry",
            name=doc.name,
            print_format="Receipt Printing",
            as_pdf=True
        )
    except Exception as e:
        frappe.log_error(f"PDF generation failed: {str(e)}", "WhatsApp Error")
        return

    # Upload PDF to WhatsApp Cloud
    upload_url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/media"
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    files = {
        "file": (f"Payment_{doc.name}.pdf", pdf_bytes, "application/pdf"),
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
        return

    # Send WhatsApp message
    msg_url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_whatsapp,
        "type": "document",
        "document": {
            "id": media_id,
            "filename": f"Payment_{doc.name}.pdf",
            "caption": f"Payment Receipt from {doc.company}"
        }
    }

    try:
        msg_resp = requests.post(msg_url, json=payload, headers=headers, timeout=30)
        msg_resp.raise_for_status()
        doc.add_comment("Comment", f"WhatsApp Payment Entry sent to {to_whatsapp}")
    except Exception as e:
        error_msg = str(e)
        if 'msg_resp' in locals():
            error_msg += f"\nResponse: {msg_resp.text}"
        frappe.log_error(error_msg, "WhatsApp Send Failed")


def send_payment_background(doc, method):
    """
    Enqueue Payment Entry WhatsApp sending in background
    Hook this to Payment Entry on_submit
    """
    if not doc.party_name and not doc.customer:
        frappe.msgprint("No party or customer set. Cannot send WhatsApp message.", indicator="red")
        return

    frappe.enqueue(
        "whatsapp_integration.erpnext_whatsapp.custom_scripts.payment_entry_notificatio.send_payment_background_job",
        docname=doc.name,
        queue="long",
        timeout=300,
        enqueue_after_commit=True
    )


def send_payment_background_job(docname):
    """
    Background job that actually sends the Payment Entry
    """
    try:
        send_payment_document_file(docname)
    except Exception as e:
        frappe.log_error(
            f"Background WhatsApp send failed for Payment Entry {docname}: {str(e)}",
            "WhatsApp Background Job"
        )
