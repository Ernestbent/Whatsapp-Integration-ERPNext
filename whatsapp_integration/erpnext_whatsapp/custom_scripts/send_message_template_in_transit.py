import frappe
import json
import requests
import re
import os
from frappe import _


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
            parts.append("Traceback:\n" + frappe.get_traceback())
        except Exception:
            pass

    frappe.log_error("\n\n".join(parts), safe_title)


def _normalize_template_key(value):
    return (value or "").strip().lower()


def _normalize_phone(value):
    if not value:
        return ""
    return re.sub(r"\D", "", str(value))


def _collect_customer_recipient_numbers(customer_doc):
    numbers = []
    seen = set()

    primary_phone = getattr(customer_doc, "whatsapp_number", None)
    primary_key = _normalize_phone(primary_phone)
    if primary_key and primary_key not in seen:
        numbers.append(str(primary_phone).strip())
        seen.add(primary_key)

    for row in getattr(customer_doc, "custom_contacts", []) or []:
        phone_number = getattr(row, "phone_number", None)
        phone_key = _normalize_phone(phone_number)
        if phone_key and phone_key not in seen:
            numbers.append(str(phone_number).strip())
            seen.add(phone_key)

    return numbers


def _get_template_doc(template_key):
    target = _normalize_template_key(template_key)
    if not target:
        return None

    templates = frappe.get_all(
        "Whatsapp Message Template",
        fields=[
            "name",
            "template_name",
            "status",
            "language",
            "format",
            "body_text",
            "media_example",
            "footer_text",
        ],
        limit_page_length=0,
    )

    for tpl in templates:
        name_key = _normalize_template_key(tpl.get("name"))
        template_name_key = _normalize_template_key(tpl.get("template_name"))
        if target in {name_key, template_name_key}:
            return tpl

    return None


def send_whatsapp_template_message(phone, template_name, parameters=None, customer=None, document_url=None):
    settings = frappe.get_single("Whatsapp Setting")
    access_token = settings.get_password("access_token") or settings.get("access_token")
    phone_number_id = settings.get("phone_number_id")

    if not access_token or not phone_number_id:
        frappe.throw("Missing Access Token or Phone Number ID in WhatsApp Settings")

    template = _get_template_doc(template_name)
    if not template:
        frappe.throw(f"Template '{template_name}' not found")

    phone = phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("+"):
        phone = phone[1:]
    if phone.startswith("0"):
        phone = phone[1:]
    if not phone.startswith("256"):
        phone = "256" + phone

    components = []
    header_type = (template.format or "").lower()

    if header_type in ["image", "video", "documentation"] and document_url:
        format_map = {
            "image": "image",
            "video": "video",
            "documentation": "document",
        }

        try:
            file_doc = frappe.get_doc("File", {"file_url": document_url})
            file_path = frappe.get_site_path("public", file_doc.file_url.lstrip("/"))
            if not os.path.exists(file_path):
                frappe.throw(f"File not found on server: {file_path}")

            import mimetypes

            mime_type = mimetypes.guess_type(file_doc.file_name)[0] or "application/pdf"

            with open(file_path, "rb") as f:
                upload_response = requests.post(
                    f"https://graph.facebook.com/v24.0/{phone_number_id}/media",
                    files={"file": (file_doc.file_name, f, mime_type)},
                    data={"messaging_product": "whatsapp", "type": mime_type},
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=60,
                )

            upload_result = upload_response.json()
            media_id = upload_result.get("id")

            if not media_id:
                error_msg = upload_result.get("error", {}).get("message", str(upload_result))
                _log_whatsapp_error(
                    "In Transit Media Upload",
                    f"Failed to upload media: {error_msg}",
                    response=upload_result,
                )
                frappe.throw(f"Failed to upload media to WhatsApp: {error_msg}")

            components.append(
                {
                    "type": "header",
                    "parameters": [
                        {
                            "type": format_map[header_type],
                            format_map[header_type]: {
                                "id": media_id,
                                "filename": file_doc.file_name,
                            },
                        }
                    ],
                }
            )

        except requests.exceptions.RequestException as e:
            _log_whatsapp_error("In Transit Network Error", "Network error uploading to WhatsApp", exc=e)
            frappe.throw(f"Network error - {str(e)}")
        except Exception as e:
            _log_whatsapp_error("In Transit Media Upload", "Failed to upload media to WhatsApp", exc=e)
            frappe.throw(f"Failed to upload document - {str(e)}")

    if parameters and template.body_text:
        body_params = []
        param_matches = re.findall(r"\{\{([^}]+)\}\}", template.body_text)

        for param_name in param_matches:
            param_key = param_name.strip()
            if param_key in parameters:
                body_params.append(
                    {
                        "type": "text",
                        "parameter_name": param_key,
                        "text": str(parameters[param_key]),
                    }
                )
            else:
                frappe.throw(f"Missing parameter value for: {param_key}")

        if body_params:
            components.append({"type": "body", "parameters": body_params})

    template_code = (template.template_name or template.name).lower().replace(" ", "_")
    template_code = re.sub(r"[^a-z0-9_]", "_", template_code)
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": template_code,
            "language": {"code": template.language or "en_US"},
        },
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
            message_text = template.body_text or ""

            if parameters:
                for key, value in parameters.items():
                    message_text = message_text.replace(f"{{{{{key}}}}}", str(value))

            if template.footer_text:
                message_text += f"\n\n{template.footer_text}"

            log_data = {
                "doctype": "Whatsapp Message",
                "from_number": phone,
                "message_type": "template",
                "custom_status": "Outgoing",
                "message": message_text,
                "message_status": "sent",
                "message_id": message_id,
                "timestamp": frappe.utils.now_datetime().strftime("%H:%M:%S"),
                "customer": customer,
            }

            if document_url and header_type == "documentation":
                log_data["custom_document"] = document_url

            frappe.get_doc(log_data).insert(ignore_permissions=True)
            frappe.db.commit()
            return {"success": True, "message_id": message_id}

        error_msg = result.get("error", {}).get("message", str(result))
        _log_whatsapp_error(
            "In Transit Template Send",
            f"WhatsApp Send Error: {error_msg}",
            payload=payload,
            response=result,
        )
        return {"success": False, "error": error_msg}

    except Exception as e:
        _log_whatsapp_error(
            "In Transit Template Send",
            "WhatsApp Send Exception",
            payload=payload,
            exc=e,
        )
        return {"success": False, "error": str(e)}


def send_in_transit_whatsapp_async(doc_name):
    """
    Send WhatsApp template notification when Sales Order moves to In Transit.
    """
    try:
        doc = frappe.get_doc("Sales Order", doc_name)

        customer = frappe.get_doc("Customer", doc.customer)
        recipient_numbers = _collect_customer_recipient_numbers(customer)
        if not recipient_numbers:
            _log_whatsapp_error(
                "In Transit WhatsApp",
                f"No WhatsApp recipient numbers found for {customer.customer_name}",
            )
            return

        template_key = "delivery_update"
        template_doc = _get_template_doc(template_key)
        if not template_doc:
            _log_whatsapp_error("In Transit WhatsApp", f"Template '{template_key}' not found")
            return

        template_name = template_doc.get("template_name") or template_doc.get("name")
        delivery_date = (
            frappe.utils.formatdate(doc.delivery_date)
            if doc.delivery_date
            else frappe.utils.formatdate(frappe.utils.nowdate())
        )
        parameters = {
            "customer_name": customer.customer_name,
            "delivery_note": doc.name,
            "delivery_date": delivery_date,
        }

        document_url = None
        try:
            pdf_content = frappe.get_print(
                doctype="Sales Order",
                name=doc.name,
                as_pdf=True,
                letterhead=doc.letter_head,
            )
            filename = f"InTransit_{doc.name}.pdf"
            file_doc = frappe.get_doc(
                {
                    "doctype": "File",
                    "file_name": filename,
                    "folder": "Home",
                    "is_private": 0,
                    "content": pdf_content,
                    "attached_to_doctype": "Sales Order",
                    "attached_to_name": doc.name,
                }
            )
            file_doc.insert(ignore_permissions=True)
            frappe.db.commit()
            document_url = file_doc.file_url
        except Exception as e:
            _log_whatsapp_error("In Transit PDF Generation", f"Failed to generate In Transit PDF for {doc.name}", exc=e)

        success_count = 0
        failed = []
        for recipient in recipient_numbers:
            result = send_whatsapp_template_message(
                phone=recipient,
                template_name=template_name,
                parameters=parameters,
                customer=doc.customer,
                document_url=document_url,
            )
            if result.get("success"):
                success_count += 1
            else:
                failed.append({"recipient": recipient, "error": result.get("error")})

        if success_count:
            _log_whatsapp_error(
                "In Transit WhatsApp Success",
                f"In Transit WhatsApp sent to {success_count}/{len(recipient_numbers)} recipients for {doc.name}",
            )
        if failed:
            _log_whatsapp_error(
                "In Transit WhatsApp",
                f"Failed for {len(failed)} recipients for {doc.name}",
                response={"failed": failed},
            )

    except Exception as e:
        _log_whatsapp_error("In Transit WhatsApp", f"In Transit WhatsApp send failed for {doc_name}", exc=e)


def on_sales_order_in_transit(doc, method=None):
    """
    Trigger only for workflow transition: Billed -> In Transit.
    """
    current_state = (getattr(doc, "workflow_state", None) or "").strip()
    if current_state != "In Transit":
        return

    previous_state = None
    try:
        previous_doc = doc.get_doc_before_save()
        previous_state = (
            (getattr(previous_doc, "workflow_state", None) or "").strip()
            if previous_doc
            else None
        )
    except Exception:
        previous_state = None

    if previous_state != "Billed":
        return

    customer = frappe.get_doc("Customer", doc.customer)
    recipient_numbers = _collect_customer_recipient_numbers(customer)
    if not recipient_numbers:
        frappe.msgprint(
            _("No WhatsApp recipient numbers found for {0}. Message will not be sent.").format(
                customer.customer_name
            ),
            indicator="orange",
            alert=True,
        )
        return

    template_doc = _get_template_doc("delivery_update")
    if not template_doc:
        frappe.msgprint(
            _("WhatsApp template 'delivery_update' not found."),
            indicator="orange",
            alert=True,
        )
        return

    frappe.enqueue(
        send_in_transit_whatsapp_async,
        doc_name=doc.name,
        queue="default",
        timeout=300,
        is_async=True,
        now=False,
    )

    frappe.msgprint(
        _("Sales Order moved to In Transit. WhatsApp dispatch message will be sent shortly."),
        indicator="blue",
        alert=True,
    )
