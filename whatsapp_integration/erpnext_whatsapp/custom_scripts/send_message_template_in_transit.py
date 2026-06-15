import frappe
import json
import requests
import re
import os


## ERROR LOGGER
def _log_whatsapp_error(title, message, payload=None, response=None, exc=None):
    safe_title = (title or "WhatsApp Error")[:140]
    parts = [str(message)]

    if payload is not None:
        try:
            parts.append("Payload:\n" + json.dumps(payload, indent=2, default=str))
        except Exception:
            parts.append("Payload:\n" + str(payload))

    if response is not None:
        try:
            parts.append("Response:\n" + json.dumps(response, indent=2, default=str))
        except Exception:
            parts.append("Response:\n" + str(response))

    if exc is not None:
        parts.append(f"Exception: {str(exc)}")
        try:
            parts.append(frappe.get_traceback())
        except Exception:
            pass

    frappe.log_error("\n\n".join(parts), safe_title)


## NORMALIZE TEMPLATE KEY
def _normalize_template_key(value):
    return (value or "").strip().lower()


## NORMALIZE PHONE
def _normalize_phone(value):
    if not value:
        return ""
    return re.sub(r"\D", "", str(value))


## GET CUSTOMER RECIPIENTS
def _collect_customer_recipient_numbers(customer_doc):
    numbers = []
    seen = set()

    primary_phone = getattr(customer_doc, "whatsapp_number", None)
    key = _normalize_phone(primary_phone)

    if primary_phone and key not in seen:
        numbers.append(str(primary_phone).strip())
        seen.add(key)

    for row in getattr(customer_doc, "custom_contacts", []) or []:
        phone = getattr(row, "phone_number", None)
        key = _normalize_phone(phone)

        if phone and key not in seen:
            numbers.append(str(phone).strip())
            seen.add(key)

    return numbers


## GET TEMPLATE
def _get_template_doc(template_key):
    target = _normalize_template_key(template_key)
    if not target:
        return None

    templates = frappe.get_all(
        "Whatsapp Message Template",
        fields=[
            "name",
            "template_name",
            "language",
            "body_text",
            "footer_text",
            "format",
        ],
        limit_page_length=0,
    )

    for tpl in templates:
        if target in {
            _normalize_template_key(tpl.get("name")),
            _normalize_template_key(tpl.get("template_name")),
        }:
            return tpl

    return None


## UPLOAD MEDIA TO WHATSAPP
def _upload_media(file_path, file_name, access_token, phone_number_id):
    import mimetypes

    mime_type = mimetypes.guess_type(file_name)[0] or "application/pdf"

    with open(file_path, "rb") as f:
        res = requests.post(
            f"https://graph.facebook.com/v24.0/{phone_number_id}/media",
            files={"file": (file_name, f, mime_type)},
            data={"messaging_product": "whatsapp"},
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=60,
        )

    data = res.json()
    return data.get("id")


## BUILD FINAL MESSAGE TEXT FROM TEMPLATE
def _render_message(template, parameters):
    message = template.body_text or ""

    if parameters:
        for key, value in parameters.items():
            message = message.replace(f"{{{{{key}}}}}", str(value))

    if template.footer_text:
        message += f"\n\n{template.footer_text}"

    return message


## SEND WHATSAPP TEMPLATE MESSAGE
def send_whatsapp_template_message(phone, template_name, parameters=None, customer=None, document_url=None):

    settings = frappe.get_single("Whatsapp Setting")
    access_token = settings.get_password("access_token") or settings.get("access_token")
    phone_number_id = settings.get("phone_number_id")

    if not access_token or not phone_number_id:
        frappe.throw("Missing WhatsApp credentials")

    template = _get_template_doc(template_name)
    if not template:
        frappe.throw(f"Template not found: {template_name}")

    ## NORMALIZE PHONE
    phone = phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("+"):
        phone = phone[1:]
    if phone.startswith("0"):
        phone = phone[1:]
    if not phone.startswith("256"):
        phone = "256" + phone

    components = []
    header_type = (template.format or "").lower()

    media_id = None

    ## HANDLE DOCUMENT UPLOAD
    if document_url:
        file_doc = frappe.get_doc("File", {"file_url": document_url})
        file_path = frappe.get_site_path("public", file_doc.file_url.lstrip("/"))

        if not os.path.exists(file_path):
            frappe.throw("File not found on server")

        media_id = _upload_media(file_path, file_doc.file_name, access_token, phone_number_id)

        if not media_id:
            frappe.throw("Media upload failed")

        components.append({
            "type": "header",
            "parameters": [
                {
                    "type": "document",
                    "document": {
                        "id": media_id,
                        "filename": file_doc.file_name
                    }
                }
            ]
        })

    ## BODY PARAMETERS (DYNAMIC - NOT HARD CODED)
    if parameters and template.body_text:
        body_params = []

        matches = re.findall(r"\{\{([^}]+)\}\}", template.body_text)

        for key in matches:
            key = key.strip()
            if key not in parameters:
                frappe.throw(f"Missing parameter: {key}")

            body_params.append({
                "type": "text",
                "parameter_name": key,
                "text": str(parameters[key])
            })

        components.append({
            "type": "body",
            "parameters": body_params
        })

    ## PAYLOAD (API CALL UNCHANGED LOGIC)
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": template.template_name or template.name,
            "language": {"code": template.language or "en_US"},
        }
    }

    if components:
        payload["template"]["components"] = components

    try:
        response = requests.post(
            f"https://graph.facebook.com/v24.0/{phone_number_id}/messages",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )

        result = response.json()

        if response.status_code == 200 and result.get("messages"):
            message_id = result["messages"][0]["id"]

            ## THIS IS THE IMPORTANT PART (CORRECT MESSAGE SAVING)
            message_text = _render_message(template, parameters)

            log_data = {
                "doctype": "Whatsapp Message",
                "from_number": phone,
                "message_type": "template",
                "custom_status": "Outgoing",
                "message": message_text,
                "message_status": "sent",
                "message_id": message_id,
                "customer": customer,
                "timestamp": frappe.utils.now_datetime().strftime("%H:%M:%S"),
            }

            ## SAVE ATTACHED DOCUMENT
            if document_url:
                log_data["custom_document"] = document_url

            frappe.get_doc(log_data).insert(ignore_permissions=True)
            frappe.db.commit()

            return {"success": True, "message_id": message_id}

        _log_whatsapp_error(
            "WhatsApp Send Failed",
            "Message rejected",
            payload=payload,
            response=result,
        )

        return {"success": False, "error": result}

    except Exception as e:
        _log_whatsapp_error(
            "WhatsApp Exception",
            "Send failed",
            payload=payload,
            exc=e,
        )
        return {"success": False, "error": str(e)}


## BACKGROUND JOB
def send_in_transit_whatsapp_async(doc_name):

    doc = frappe.get_doc("Sales Order", doc_name)
    customer = frappe.get_doc("Customer", doc.customer)

    recipients = _collect_customer_recipient_numbers(customer)
    if not recipients:
        return

    parameters = {
        "customer_name": customer.customer_name,
        "delivery_note": doc.name,
        "delivery_date": frappe.utils.formatdate(doc.delivery_date or frappe.utils.nowdate())
    }

    ## CREATE PDF FILE
    pdf = frappe.get_print("Sales Order", doc.name, as_pdf=True)

    file_doc = frappe.get_doc({
        "doctype": "File",
        "file_name": f"InTransit_{doc.name}.pdf",
        "folder": "Home",
        "is_private": 0,
        "content": pdf,
        "attached_to_doctype": "Sales Order",
        "attached_to_name": doc.name,
    })

    file_doc.insert(ignore_permissions=True)
    frappe.db.commit()

    document_url = file_doc.file_url

    ## SEND TO ALL RECIPIENTS
    for phone in recipients:
        send_whatsapp_template_message(
            phone=phone,
            template_name="delivery_update",
            parameters=parameters,
            customer=doc.customer,
            document_url=document_url,
        )


## TRIGGER
def on_sales_order_in_transit(doc, method=None):

    if (doc.workflow_state or "").strip() != "In Transit":
        return

    frappe.enqueue(
        send_in_transit_whatsapp_async,
        doc_name=doc.name,
        queue="default",
        timeout=300,
    )