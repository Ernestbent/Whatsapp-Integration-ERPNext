import frappe
import requests

def send_sales_order_document(doc, method):
    """
    Send Sales Order via WhatsApp
    Hook this in hooks.py to Sales Order
    """
    
    # Get WhatsApp credentials
    settings = frappe.get_single("Whatsapp Setting")
    PHONE_NUMBER_ID = settings.get("phone_number_id")
    WHATSAPP_TOKEN = settings.get("access_token")
    API_VERSION = "v24.0"

    print("=== WhatsApp Settings ===")
    print(f"PHONE_NUMBER_ID: {PHONE_NUMBER_ID}")
    print(f"ACCESS_TOKEN length: {len(WHATSAPP_TOKEN) if WHATSAPP_TOKEN else 'None'}")

    if not PHONE_NUMBER_ID or not WHATSAPP_TOKEN:
        frappe.log_error("WhatsApp credentials missing", "WhatsApp Config")
        frappe.msgprint("Configure WhatsApp Setting first.", indicator="red")
        return

    # Get Customer WhatsApp number
    if not doc.customer:
        frappe.msgprint("No customer selected for this Sales Order", indicator="red")
        return

    customer_doc = frappe.get_doc("Customer", doc.customer)
    to_whatsapp = customer_doc.whatsapp_number

    # Clean number: remove +, spaces, dashes
    if to_whatsapp:
        to_whatsapp = ''.join(filter(str.isdigit, to_whatsapp))

    print("=== Customer Data ===")
    print(f"Customer: {doc.customer}")
    print(f"Fetched WhatsApp number: {customer_doc.whatsapp_number}")
    print(f"Cleaned WhatsApp number: {to_whatsapp}")

    if not to_whatsapp:
        frappe.msgprint(f"Customer {doc.customer} has no WhatsApp number set", indicator="red")
        return

    print(f"TARGET: {to_whatsapp} for Sales Order {doc.name}")

    # Generate PDF
    try:
        pdf_bytes = frappe.get_print(
            doctype="Sales Order",
            name=doc.name,
            print_format="Sales Order Print",
            as_pdf=True
        )
        print(f"PDF generated (size: {len(pdf_bytes)} bytes)")
    except Exception as e:
        frappe.log_error(f"PDF Error: {e}", "WhatsApp PDF Generation")
        frappe.msgprint(f"Failed to generate PDF: {str(e)}", indicator="red")
        return

    # Upload PDF to WhatsApp Cloud
    upload_url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/media"
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    files = {
        "file": (f"SalesOrder_{doc.name}.pdf", pdf_bytes, "application/pdf"),
        "type": (None, "application/pdf"),
        "messaging_product": (None, "whatsapp")
    }

    print("Uploading PDF to WhatsApp...")
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
    payload = {
        "messaging_product": "whatsapp",
        "to": to_whatsapp,
        "type": "document",
        "document": {
            "id": media_id,
            "filename": f"SalesOrder_{doc.name}.pdf",
            "caption": f"Sales Order from {doc.company}"
        }
    }

    print("Sending WhatsApp message...")
    print(f"Payload: {payload}")

    try:
        msg_resp = requests.post(msg_url, json=payload, headers=headers, timeout=30)
        msg_resp.raise_for_status()
        print(f"SENT SUCCESSFULLY to {to_whatsapp}!")
        doc.add_comment("Comment", f"WhatsApp Sales Order sent to {to_whatsapp}")
    except Exception as e:
        error_msg = str(e)
        if 'msg_resp' in locals():
            error_msg += f"\nResponse: {msg_resp.text}"
        frappe.log_error(error_msg, "WhatsApp Send Failed")
        frappe.msgprint("Failed to send WhatsApp message", indicator="red")
