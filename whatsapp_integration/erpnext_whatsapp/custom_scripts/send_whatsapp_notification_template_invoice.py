import frappe
import json
import requests
import os
import mimetypes


def _send_invoice_whatsapp_async(sales_invoice):
    """Background job - fetches template, generates PDF and sends WhatsApp"""
    try:
        doc = frappe.get_doc("Sales Invoice", sales_invoice)
        customer = frappe.get_doc("Customer", doc.customer)
        phone = customer.whatsapp_number

        if not phone:
            frappe.log_error(f"No WhatsApp number found for {customer.customer_name}", "Sales Invoice WhatsApp")
            return

        # Load WhatsApp settings
        settings = frappe.get_single("Whatsapp Setting")
        ACCESS_TOKEN = settings.get_password("access_token") or settings.get("access_token")
        PHONE_NUMBER_ID = settings.get("phone_number_id")

        if not ACCESS_TOKEN or not PHONE_NUMBER_ID:
            frappe.log_error("Missing Access Token or Phone Number ID in WhatsApp Settings", "Sales Invoice WhatsApp")
            return

        # Fetch template directly from Whatsapp Message Template doctype
        template = frappe.db.get_value(
            "Whatsapp Message Template",
            {"template_name": "sales_invoice_template"},
            ["template_name", "status", "body_text", "footer_text"],
            as_dict=1
        )

        if not template:
            frappe.log_error("Template 'sales_invoice_template' not found", "Sales Invoice WhatsApp")
            return

        if template.status != "Approved":
            frappe.log_error(f"Template not approved. Status: {template.status}", "Sales Invoice WhatsApp")
            return

        # Clean and format phone number (Uganda 256)
        phone = phone.strip().replace(" ", "").replace("-", "")
        if phone.startswith("+"): phone = phone[1:]
        if phone.startswith("0"): phone = phone[1:]
        if not phone.startswith("256"): phone = "256" + phone

        # Generate PDF (reuse if already exists)
        filename = f"Invoice-{doc.name}.pdf"
        existing = frappe.db.get_value("File", {"file_name": filename, "attached_to_name": doc.name}, "file_url")

        if existing:
            document_url = existing
        else:
            pdf_content = frappe.get_print(
                "Sales Invoice", doc.name,
                print_format="Invoice Printing",
                as_pdf=True,
                letterhead=doc.get("letter_head")
            )
            file_doc = frappe.get_doc({
                "doctype": "File",
                "file_name": filename,
                "folder": "Home",
                "is_private": 0,
                "content": pdf_content,
                "attached_to_doctype": "Sales Invoice",
                "attached_to_name": doc.name
            })
            file_doc.insert(ignore_permissions=True)
            frappe.db.commit()
            document_url = file_doc.file_url

        # Upload PDF to WhatsApp Cloud and get media ID
        file_doc = frappe.get_doc("File", {"file_url": document_url})
        file_path = frappe.get_site_path("public", file_doc.file_url.lstrip("/"))

        if not os.path.exists(file_path):
            frappe.log_error(f"File not found on server: {file_path}", "Sales Invoice WhatsApp")
            return

        mime_type = mimetypes.guess_type(file_doc.file_name)[0] or "application/pdf"

        upload_response = requests.post(
            f"https://graph.facebook.com/v24.0/{PHONE_NUMBER_ID}/media",
            files={"file": (file_doc.file_name, open(file_path, "rb"), mime_type)},
            data={"messaging_product": "whatsapp", "type": mime_type},
            headers={"Authorization": f"Bearer {ACCESS_TOKEN}"},
            timeout=60
        )

        upload_result = upload_response.json()
        media_id = upload_result.get("id")

        if not media_id:
            frappe.log_error(f"Media upload failed: {json.dumps(upload_result, indent=2)}", "Sales Invoice WhatsApp")
            return

        # Build message payload
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "template",
            "template": {
                "name": "sales_invoice_template",
                "language": {"code": "en"},
                "components": [
                    {
                        "type": "header",
                        "parameters": [{"type": "document", "document": {"id": media_id, "filename": file_doc.file_name}}]
                    },
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "parameter_name": "name", "text": customer.customer_name},
                            {"type": "text", "parameter_name": "invoice_number", "text": doc.name}
                        ]
                    }
                ]
            }
        }

        response = requests.post(
            f"https://graph.facebook.com/v24.0/{PHONE_NUMBER_ID}/messages",
            headers={"Authorization": f"Bearer {ACCESS_TOKEN}", "Content-Type": "application/json"},
            json=payload,
            timeout=30
        )

        result = response.json()

        if response.status_code == 200 and result.get("messages"):
            message_id = result["messages"][0]["id"]

            # Build logged message text with resolved parameters
            message_text = template.body_text \
                .replace("{{name}}", customer.customer_name) \
                .replace("{{invoice_number}}", doc.name)

            if template.footer_text:
                message_text += f"\n\n{template.footer_text}"

            # Log to Whatsapp Message doctype
            frappe.get_doc({
                "doctype": "Whatsapp Message",
                "from_number": phone,
                "message_type": "template",
                "custom_status": "Outgoing",
                "message": message_text,
                "message_status": "sent",
                "message_id": message_id,
                "timestamp": frappe.utils.now_datetime().strftime("%H:%M:%S"),
                "customer": doc.customer,
                "custom_document": document_url
            }).insert(ignore_permissions=True)
            frappe.db.commit()

            frappe.log_error(
                f"WhatsApp invoice sent to {customer.customer_name} ({phone}) for {doc.name}",
                "Sales Invoice WhatsApp Success"
            )

        else:
            frappe.log_error(f"Send failed: {json.dumps(result, indent=2)}", "Sales Invoice WhatsApp")

    except Exception as e:
        frappe.log_error(f"Sales Invoice WhatsApp Error for {sales_invoice}: {str(e)}", "Sales Invoice WhatsApp")


@frappe.whitelist()
def send_invoice_notification(sales_invoice):
    """Called from JS button — enqueues background job"""
    frappe.enqueue(
        _send_invoice_whatsapp_async,
        sales_invoice=sales_invoice,
        queue="default",
        timeout=300,
        is_async=True,
        now=False
    )
    return {"success": True}