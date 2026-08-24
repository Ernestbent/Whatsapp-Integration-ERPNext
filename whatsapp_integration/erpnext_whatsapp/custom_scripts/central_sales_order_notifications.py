import base64
import json
import mimetypes
import os
import re
from urllib.parse import unquote, urlparse

import frappe
import requests
from bs4 import BeautifulSoup
from frappe import _
from frappe.utils.pdf import get_pdf


TEMPLATE_NAME = "central_sales_order"
TEMPLATE_LANGUAGE = "en"
TEMPLATE_BODY = """New Sales Order for *Central Region*

*Customer:* {{1}}
*Salesperson:* {{2}}
*Total Items:* {{3}}
*Focus Items:* {{4}}
*Amount:* UGX {{5}}

Please find the Sales Order details."""
RECIPIENT_NUMBERS = {
    "0750229862",
    "0755829642",
    "0758116526"
}
CENTRAL_SALES_USER_EMAILS = {
    "rhodahnakku6@gmail.com",
    "rhoda@autozonepro.org",
    "cirus@autozonepro.org",
    "issa@autozonepro.org",
    "owen@autozonepro.org",
    "emma@autozonepro.org",
}
FOCUS_ITEM_FIELD = "custom_focus_item"
NOTIFIABLE_WORKFLOW_STATES = {
    "Pending Credit Approval",
    "Approved",
}


def _normalize_email(value):
    return (value or "").strip().lower()


def _normalize_phone(value):
    digits = re.sub(r"\D", "", str(value or ""))
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("2560"):
        digits = "256" + digits[4:]
    elif digits.startswith("0"):
        digits = "256" + digits[1:]
    elif digits and not digits.startswith("256"):
        digits = "256" + digits

    return digits if len(digits) == 12 and digits.startswith("256") else ""


def _safe_filename(value):
    return re.sub(r"[^A-Za-z0-9_.-]", "_", str(value or "").strip()) or "sales_order"


def _format_amount(value):
    return "{:,.0f}".format(frappe.utils.flt(value))


def _is_central_sales_order(sales_order):
    return _normalize_email(getattr(sales_order, "owner", None)) in {
        _normalize_email(email) for email in CENTRAL_SALES_USER_EMAILS
    }


def _get_salesperson_label(sales_order):
    owner = getattr(sales_order, "owner", None)
    if owner:
        full_name = frappe.db.get_value("User", owner, "full_name")
        if full_name:
            return full_name

    for row in getattr(sales_order, "sales_team", []) or []:
        sales_person = (getattr(row, "sales_person", None) or "").strip()
        if sales_person:
            return sales_person

    return owner or ""


def _get_focus_item_codes(items):
    item_codes = {
        (getattr(item, "item_code", None) or "").strip()
        for item in items
        if (getattr(item, "item_code", None) or "").strip()
    }
    if not item_codes:
        return set()

    rows = frappe.get_all(
        "Item",
        filters={
            "name": ["in", list(item_codes)],
            FOCUS_ITEM_FIELD: 1,
        },
        fields=["name"],
        limit_page_length=0,
    )
    return {row.name for row in rows}


def _build_template_parameters(sales_order, customer):
    items = list(getattr(sales_order, "items", []) or [])
    focus_item_codes = _get_focus_item_codes(items)
    focus_items = sum(
        1
        for item in items
        if (getattr(item, "item_code", None) or "").strip() in focus_item_codes
    )

    return {
        "1": customer.customer_name or sales_order.customer_name or sales_order.customer,
        "2": _get_salesperson_label(sales_order),
        "3": str(len(items)),
        "4": str(focus_items),
        "5": _format_amount(sales_order.grand_total or sales_order.base_grand_total),
    }


def _get_template():
    return frappe._dict(
        template_name=TEMPLATE_NAME,
        language=TEMPLATE_LANGUAGE,
        format="DOCUMENT",
        body_text=TEMPLATE_BODY,
        footer_text="",
    )


def _get_whatsapp_credentials():
    settings = frappe.get_single("Whatsapp Setting")
    access_token = settings.get_password("access_token") or settings.get("access_token")
    phone_number_id = settings.get("phone_number_id")
    if not access_token or not phone_number_id:
        frappe.throw("Missing Access Token or Phone Number ID in WhatsApp Settings")

    return access_token, phone_number_id


def _get_local_print_image_path(source):
    path = unquote(urlparse(source or "").path)
    if path.startswith("/files/"):
        return frappe.get_site_path("public", path.lstrip("/"))
    if path.startswith("/private/files/"):
        return frappe.get_site_path(path.lstrip("/"))
    return None


def _prepare_default_sales_order_print(sales_order):
    html = frappe.get_print("Sales Order", sales_order.name, as_pdf=False)
    soup = BeautifulSoup(html, "html.parser")

    for image in soup.find_all("img", src=True):
        image_path = _get_local_print_image_path(image.get("src"))
        if not image_path:
            continue
        if not os.path.exists(image_path):
            image.decompose()
            continue

        mime_type = mimetypes.guess_type(image_path)[0] or "image/jpeg"
        with open(image_path, "rb") as image_file:
            encoded = base64.b64encode(image_file.read()).decode("ascii")
        image["src"] = f"data:{mime_type};base64,{encoded}"

    return str(soup)


def _create_sales_order_pdf(sales_order):
    print_html = _prepare_default_sales_order_print(sales_order)
    pdf_content = get_pdf(
        print_html,
        options={
            "load-error-handling": "ignore",
            "load-media-error-handling": "ignore",
        },
    )

    pdf_doc = frappe.get_doc(
        {
            "doctype": "File",
            "file_name": f"SalesOrder_{_safe_filename(sales_order.name)}.pdf",
            "folder": "Home",
            "is_private": 0,
            "content": pdf_content,
            "attached_to_doctype": "Sales Order",
            "attached_to_name": sales_order.name,
        }
    )
    pdf_doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return pdf_doc


def _upload_media(file_doc, access_token, phone_number_id):
    file_path = frappe.get_site_path("public", file_doc.file_url.lstrip("/"))
    if not os.path.exists(file_path):
        frappe.throw(f"File not found on server: {file_path}")

    mime_type = mimetypes.guess_type(file_doc.file_name)[0] or "application/pdf"
    with open(file_path, "rb") as file_handle:
        response = requests.post(
            f"https://graph.facebook.com/v24.0/{phone_number_id}/media",
            files={"file": (file_doc.file_name, file_handle, mime_type)},
            data={"messaging_product": "whatsapp", "type": mime_type},
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=60,
        )

    result = response.json()
    media_id = result.get("id")
    if not media_id:
        frappe.log_error(
            f"Failed to upload central Sales Order PDF: {json.dumps(result, indent=2)}",
            "Central Sales Order WhatsApp",
        )
        frappe.throw(result.get("error", {}).get("message", "WhatsApp media upload failed"))

    return media_id


def _build_components(media_id, filename, parameters):
    return [
        {
            "type": "header",
            "parameters": [
                {
                    "type": "document",
                    "document": {
                        "id": media_id,
                        "filename": filename,
                    },
                }
            ],
        },
        {
            "type": "body",
            "parameters": [
                {"type": "text", "text": str(parameters[key] or "")}
                for key in ["1", "2", "3", "4", "5"]
            ],
        },
    ]


def _render_message(template, parameters):
    message = template.body_text or ""
    for key, value in parameters.items():
        message = message.replace(f"{{{{{key}}}}}", str(value or ""))
    if template.footer_text:
        message += f"\n\n{template.footer_text}"

    return message


def _send_template(phone, pdf_doc, parameters):
    template = _get_template()

    access_token, phone_number_id = _get_whatsapp_credentials()
    phone = _normalize_phone(phone)
    if not phone:
        return {"success": False, "error": "Invalid recipient phone number"}

    media_id = _upload_media(pdf_doc, access_token, phone_number_id)
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": template.template_name or TEMPLATE_NAME,
            "language": {"code": template.language or TEMPLATE_LANGUAGE},
            "components": _build_components(media_id, pdf_doc.file_name, parameters),
        },
    }

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
        log_data = {
            "doctype": "Whatsapp Message",
            "from_number": phone,
            "message_type": "template",
            "custom_status": "Outgoing",
            "message": _render_message(template, parameters),
            "message_status": "sent",
            "message_id": message_id,
            "timestamp": frappe.utils.now_datetime().strftime("%H:%M:%S"),
        }

        meta = frappe.get_meta("Whatsapp Message")
        if meta.has_field("custom_document"):
            log_data["custom_document"] = pdf_doc.file_url
        if meta.has_field("media_id"):
            log_data["media_id"] = media_id

        frappe.get_doc(log_data).insert(ignore_permissions=True)
        frappe.db.commit()
        return {"success": True, "message_id": message_id}

    error_msg = result.get("error", {}).get("message", str(result))
    frappe.log_error(
        (
            f"Central Sales Order WhatsApp send failed: {error_msg}\n\n"
            f"Payload:\n{json.dumps(payload, indent=2)}\n\n"
            f"Response:\n{json.dumps(result, indent=2)}"
        ),
        "Central Sales Order WhatsApp",
    )
    return {"success": False, "error": error_msg}


def _already_sent(sales_order):
    safe_name = _safe_filename(sales_order.name)
    return bool(
        frappe.db.exists(
            "Whatsapp Message",
            {
                "message_type": "template",
                "custom_status": "Outgoing",
                "message_status": ["in", ["sent", "delivered", "read"]],
                "custom_document": ["like", f"%SalesOrder_{safe_name}%"],
            },
        )
    )


def send_central_sales_order_async(doc_name):
    try:
        sales_order = frappe.get_doc("Sales Order", doc_name)
        if not _is_central_sales_order(sales_order):
            return
        if _already_sent(sales_order):
            return

        customer = frappe.get_doc("Customer", sales_order.customer)
        parameters = _build_template_parameters(sales_order, customer)
        pdf_doc = _create_sales_order_pdf(sales_order)

        failures = []
        success_count = 0
        for phone in RECIPIENT_NUMBERS:
            result = _send_template(phone, pdf_doc, parameters)
            if result.get("success"):
                success_count += 1
            else:
                failures.append(f"{phone}: {result.get('error')}")

        if success_count:
            frappe.log_error(
                f"Central Sales Order sent to {success_count}/{len(RECIPIENT_NUMBERS)} recipients for {doc_name}",
                "Central Sales Order WhatsApp Success",
            )
        if failures:
            frappe.log_error(
                "Failed central recipients:\n" + "\n".join(failures),
                "Central Sales Order WhatsApp",
            )

    except Exception:
        frappe.log_error(frappe.get_traceback(), "Central Sales Order WhatsApp")


def _should_notify(doc):
    if getattr(doc, "docstatus", None) != 1:
        return False
    if not _is_central_sales_order(doc):
        return False
    if _already_sent(doc):
        return False

    current_state = (getattr(doc, "workflow_state", None) or "").strip()
    return current_state in NOTIFIABLE_WORKFLOW_STATES


def _enqueue_central_sales_order(doc):
    frappe.enqueue(
        send_central_sales_order_async,
        doc_name=doc.name,
        queue="short",
        timeout=300,
        is_async=True,
        now=False,
        enqueue_after_commit=True,
    )

    frappe.msgprint(
        _("Central Sales Order WhatsApp message will be sent shortly."),
        indicator="blue",
        alert=True,
    )


def on_central_sales_order_submit(doc, method=None):
    if not _should_notify(doc):
        return

    _enqueue_central_sales_order(doc)


def on_central_sales_order_update_after_submit(doc, method=None):
    if not _should_notify(doc):
        return

    _enqueue_central_sales_order(doc)
