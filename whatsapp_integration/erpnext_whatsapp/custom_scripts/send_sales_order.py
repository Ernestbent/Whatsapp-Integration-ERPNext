import frappe
import requests

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

    # Upload PDF to WhatsApp Cloud
    upload_url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/media"
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    files = {
        "file": (f"SalesOrder_{doc.name}.pdf", pdf_bytes, "application/pdf"),
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
            "filename": f"SalesOrder_{doc.name}.pdf",
            "caption": f"Sales Order from {doc.company}"
        }
    }

    try:
        msg_resp = requests.post(msg_url, json=payload, headers=headers, timeout=30)
        msg_resp.raise_for_status()
        doc.add_comment("Comment", f"WhatsApp Sales Order sent to {to_whatsapp}")
    except Exception as e:
        error_msg = str(e)
        if 'msg_resp' in locals():
            error_msg += f"\nResponse: {msg_resp.text}"
        frappe.log_error(error_msg, "WhatsApp Send Failed")


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
