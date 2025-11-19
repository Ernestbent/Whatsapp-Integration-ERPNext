import frappe
import requests

def send_payment_document(doc, method):
    """
    Send Payment Entry Notification via WhatsApp
    Hook this in hooks.py to Payment Entry on_submit event
    """
    # Get credentials from whatsapp settings
    settings = frappe.get_single("Whatsapp Setting")
    PHONE_NUMBER_ID = settings.get("phone_number_id")
    WHATSAPP_TOKEN = settings.get("access_token")
    API_VERSION = "v24.0"

    if not PHONE_NUMBER_ID or not WHATSAPP_TOKEN:
        print("ERROR: WhatsApp credentials missing in 'Whatsapp Setting'")
        frappe.log_error("WhatsApp credentials missing", "WhatsApp Config")
        frappe.msgprint("Configure Whatsapp Setting first.", indicator="red")
        return

    # Hard Coded Mobile Number for Testing
    to_whatsapp = "256757001909"
    print(f"TARGET: {to_whatsapp} for Delivery Note {doc.name}")

    # Generate PDF of the Sales Invoice
    try:
        pdf_bytes = frappe.get_print(
            doctype="Payment Entry",
            name=doc.name,
            print_format="Receipt Printing", # Specify the custom print format
            as_pdf=True
        )
        print(f" PDF generated using 'Delivery Note Printing' format (size: {len(pdf_bytes)} bytes)")
    except Exception as e:
        print(f"PDF FAILED: {str(e)}")
        frappe.log_error(f"PDF Error: {e}", "WhatsApp PDF Generation")
        frappe.msgprint(f"Failed to generate PDF: {str(e)}", indicator="red")
        return

    # Upload PDF to Whatsapp Cloud API (media upload)
    upload_url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/media"
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    files = {
        "file": (f"Invoice_{doc.name}.pdf", pdf_bytes, "application/pdf"),
        "type": (None, "application/pdf"),
        "messaging_product": (None, "whatsapp")
    }

    print(f"📤 Uploading PDF to WhatsApp...")
    try:
        upload_resp = requests.post(upload_url, headers=headers, files=files, timeout=30)
        upload_resp.raise_for_status()
        media_id = upload_resp.json()["id"]
        print(f"UPLOADED: Media ID = {media_id}")
    except Exception as e:
        error_msg = str(e)
        if 'upload_resp' in locals():
            error_msg += f"\nResponse: {upload_resp.text}"
        print(f"UPLOAD FAILED: {error_msg}")
        frappe.log_error(error_msg, "WhatsApp Upload Failed")
        frappe.msgprint("Failed to upload document to WhatsApp", indicator="red")
        return

    # Send the document via whatsapp message
    msg_url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/messages"
    
    # Ultra Simple message
    caption = f"""
{doc.company}"""    
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
        # frappe.msgprint(f"Invoice sent to {to_whatsapp}", indicator="green")
        
        # Add comment to track
        doc.add_comment("Comment", f"WhatsApp invoice sent to {to_whatsapp}")
    except Exception as e:
        error_msg = str(e)
        if 'msg_resp' in locals():
            error_msg += f"\nResponse: {msg_resp.text}"
        print(f"SEND FAILED: {error_msg}")
        frappe.log_error(error_msg, "WhatsApp Send Failed")
        frappe.msgprint("Failed to send WhatsApp message", indicator="red")