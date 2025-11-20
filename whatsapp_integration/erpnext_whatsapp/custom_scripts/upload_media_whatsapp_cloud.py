import frappe
import requests

def send_proforma_whatsapp(doc, method):
    """
    Send Sales Invoice via WhatsApp
    Hook this in hooks.py to Sales Invoice
    """

    # Get WhatsApp credentials
    settings = frappe.get_single("Whatsapp Setting")
    PHONE_NUMBER_ID = settings.get("phone_number_id")
    WHATSAPP_TOKEN = settings.get("access_token")
    API_VERSION = "v24.0"

    if not PHONE_NUMBER_ID or not WHATSAPP_TOKEN:
        frappe.log_error("WhatsApp credentials missing", "WhatsApp Config")
        frappe.msgprint("Configure Whatsapp Setting first.", indicator="red")
        return

    # Fetch WhatsApp number from Customer
    if not doc.customer:
        frappe.msgprint("Select a customer first.", indicator="red")
        return

    customer_doc = frappe.get_doc("Customer", doc.customer)
    raw_number = customer_doc.whatsapp_number

    # Clean phone number (remove +, spaces, hyphens, brackets)
    to_whatsapp = None
    if raw_number:
        to_whatsapp = ''.join(filter(str.isdigit, raw_number))

        # Convert 07XXXXXXXX → 2567XXXXXXXX
        if to_whatsapp.startswith("0") and len(to_whatsapp) == 10:
            to_whatsapp = "256" + to_whatsapp[1:]

        # Convert 7XXXXXXXX → 2567XXXXXXXX
        if len(to_whatsapp) == 9:
            to_whatsapp = "256" + to_whatsapp

    print("=== CUSTOMER WHATSAPP CHECK ===")
    print(f"Raw number: {raw_number}")
    print(f"Cleaned number: {to_whatsapp}")

    if not to_whatsapp:
        frappe.msgprint(f"Customer {doc.customer} has no valid WhatsApp number.", indicator="red")
        return

    print(f"TARGET: {to_whatsapp} for Sales Invoice {doc.name}")

    # Generate PDF
    try:
        pdf_bytes = frappe.get_print(
            doctype="Sales Invoice",
            name=doc.name,
            print_format="Invoice Printing",
            as_pdf=True
        )
        print(f"PDF generated (size: {len(pdf_bytes)} bytes)")
    except Exception as e:
        frappe.log_error(f"PDF Error: {e}", "WhatsApp PDF Generation")
        frappe.msgprint(f"Failed to generate PDF: {str(e)}", indicator="red")
        return

    # Upload PDF to WhatsApp

    upload_url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/media"
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    files = {
        "file": (f"Invoice_{doc.name}.pdf", pdf_bytes, "application/pdf"),
        "type": (None, "application/pdf"),
        "messaging_product": (None, "whatsapp")
    }

    print("📤 Uploading PDF to WhatsApp...")
    try:
        upload_resp = requests.post(upload_url, headers=headers, files=files, timeout=30)
        upload_resp.raise_for_status()
        media_id = upload_resp.json()["id"]
        print(f"PDF uploaded successfully. Media ID: {media_id}")
    except Exception as e:
        error_msg = str(e)
        if 'upload_resp' in locals():
            error_msg += f"\nResponse: {upload_resp.text}"
        frappe.log_error(error_msg, "WhatsApp Upload Failed")
        frappe.msgprint("Failed to upload document to WhatsApp", indicator="red")
        return

    # Send WhatsApp message
    msg_url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/messages"
    caption = f"Sales Invoice from {doc.company}"

    payload = {
        "messaging_product": "whatsapp",
        "to": to_whatsapp,
        "type": "document",
        "document": {
            "id": media_id,
            "filename": f"Invoice_{doc.name}.pdf",
            "caption": caption
        }
    }

    print(f"📨 Sending message to {to_whatsapp}...")
    try:
        msg_resp = requests.post(msg_url, json=payload, headers=headers, timeout=30)
        msg_resp.raise_for_status()
        print(f"SENT SUCCESSFULLY to {to_whatsapp}!")
        doc.add_comment("Comment", f"WhatsApp invoice sent to {to_whatsapp}")
    except Exception as e:
        error_msg = str(e)
        if 'msg_resp' in locals():
            error_msg += f"\nResponse: {msg_resp.text}"
        frappe.log_error(error_msg, "WhatsApp Send Failed")
        frappe.msgprint("Failed to send WhatsApp message", indicator="red")
