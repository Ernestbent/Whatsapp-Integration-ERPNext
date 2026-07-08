import re
import json

import frappe
import requests


ALLOWED_CREDIT_CONTROLLER_EMAILS = {
    "ernestben69@gmail.com",
    "admin@autozonepro.org",
    "developer@autozonepro.org",
    "outstanding@autozonepro.org"
}
ADDITIONAL_COMMENT_NOTIFICATION_NUMBERS = {
    "+256 755 829642",
}

CREDIT_CONTROLLER_ROLE = "Credit Controller"
CREDIT_CONTROLLER_COMMENT_TEMPLATE_NAME = "comment_from_credit_controller"
CREDIT_CONTROLLER_COMMENT_TEMPLATE_LANGUAGE = "en"
CREDIT_CONTROLLER_COMMENT_TEMPLATE_BUTTON_INDEX = "0"
SALES_ORDER_URL_BASE = "https://accounting.autozonepro.org/app/sales-order"
CREDIT_CONTROLLER_COMMENT_TEMPLATE_BODY = (
    "A new comment has been added to your Sales Order.\n\n"
    "Sales Order: {{1}}\n"
    "Customer: {{2}}\n"
    "Commented by: {{3}}\n\n"
    "Comment:\n"
    "{{4}}\n\n"
    "Please review the Sales Order for more details."
)


def _normalize_email(email):
    return (email or "").strip().lower()


def _normalize_phone(phone):
    if not phone:
        return ""

    digits = re.sub(r"\D", "", str(phone))
    if digits.startswith("0") and len(digits) >= 10:
        return "256" + digits[1:]
    if digits.startswith("256"):
        return digits
    if len(digits) == 9:
        return "256" + digits

    return "256" + digits.lstrip("0")


def _strip_comment_html(content):
    text = frappe.utils.strip_html(content or "")
    return re.sub(r"\s+", " ", text).strip()


def _has_role(user, role):
    if not user:
        return False

    return bool(
        frappe.db.exists(
            "Has Role",
            {
                "parenttype": "User",
                "parent": user,
                "role": role,
            },
        )
    )


def _is_credit_controller(user):
    return _has_role(user, CREDIT_CONTROLLER_ROLE)


def _get_enabled_user_with_mobile(user):
    if not user:
        return None

    user_doc = frappe.db.get_value(
        "User",
        user,
        ["name", "full_name", "mobile_no", "phone", "enabled"],
        as_dict=True,
    )
    if not user_doc or not user_doc.enabled:
        return None

    user_doc.whatsapp_recipient_number = _normalize_phone(user_doc.mobile_no or user_doc.phone)
    if not user_doc.whatsapp_recipient_number:
        return None

    return user_doc


def _add_additional_recipients(recipients):
    seen_numbers = {
        _normalize_phone(getattr(recipient, "whatsapp_recipient_number", None))
        for recipient in recipients
        if getattr(recipient, "whatsapp_recipient_number", None)
    }

    for phone in ADDITIONAL_COMMENT_NOTIFICATION_NUMBERS:
        normalized = _normalize_phone(phone)
        if not normalized or normalized in seen_numbers:
            continue

        recipients.append(
            frappe._dict(
                {
                    "name": normalized,
                    "full_name": "Additional Comment Recipient",
                    "whatsapp_recipient_number": normalized,
                    "is_additional_recipient": True,
                }
            )
        )
        seen_numbers.add(normalized)

    return recipients


def _get_sales_order_creator_recipient(sales_order_owner, comment_creator):
    if _normalize_email(sales_order_owner) == _normalize_email(comment_creator):
        return _add_additional_recipients([])

    user_doc = _get_enabled_user_with_mobile(sales_order_owner)
    recipients = [user_doc] if user_doc else []
    return _add_additional_recipients(recipients)


def _log_skip(reason, comment_doc, sales_order=None, extra=None):
    details = {
        "reason": reason,
        "comment": comment_doc.name,
        "comment_owner": comment_doc.owner,
        "comment_email": comment_doc.comment_email,
        "comment_by": comment_doc.comment_by,
        "reference_doctype": comment_doc.reference_doctype,
        "reference_name": comment_doc.reference_name,
    }

    if sales_order:
        details.update(
            {
                "sales_order": sales_order.name,
                "sales_order_owner": sales_order.owner,
                "customer": sales_order.customer,
                "customer_name": sales_order.customer_name,
            }
        )

    if extra:
        details.update(extra)

    frappe.logger().info("Sales Order Comment WhatsApp skipped: " + json.dumps(details, default=str))


def _get_comment_creator(comment_doc):
    return comment_doc.comment_email or comment_doc.owner


def _log_whatsapp_error(title, message, payload=None, response=None, exc=None):
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
        parts.append("Traceback:\n" + frappe.get_traceback())

    frappe.log_error(title=(title or "Sales Order Comment WhatsApp")[:140], message="\n\n".join(parts))


def _get_sales_order_url(sales_order_name):
    sales_order_name = (sales_order_name or "").strip()
    return f"{SALES_ORDER_URL_BASE}/{sales_order_name}" if sales_order_name else SALES_ORDER_URL_BASE


def _get_trimmed_comment_text(comment_doc):
    comment_text = _strip_comment_html(comment_doc.content)
    if len(comment_text) > 900:
        comment_text = comment_text[:897] + "..."

    return comment_text


def _build_logged_comment_text(comment_doc, sales_order):
    sales_order_url = _get_sales_order_url(sales_order.name)
    link_suffix = f"\n\nSales Order Link:\n{sales_order_url}"
    max_comment_length = max(0, 900 - len(link_suffix))

    comment_text = _strip_comment_html(comment_doc.content)
    if len(comment_text) > max_comment_length:
        comment_text = comment_text[: max(0, max_comment_length - 3)] + "..."

    return f"{comment_text}{link_suffix}"


def _build_credit_controller_template_values(comment_doc, sales_order):
    comment_text = _get_trimmed_comment_text(comment_doc)

    return [
        sales_order.name,
        sales_order.customer_name or sales_order.customer,
        comment_doc.comment_by or _get_comment_creator(comment_doc),
        comment_text,
    ]


def _build_button_value(sales_order):
    return _get_sales_order_url(sales_order.name)


def _render_credit_controller_message(values):
    message = CREDIT_CONTROLLER_COMMENT_TEMPLATE_BODY
    for index, value in enumerate(values, start=1):
        message = message.replace(f"{{{{{index}}}}}", str(value or ""))
    return message


def _build_credit_controller_log_values(values, comment_doc, sales_order):
    log_values = list(values)
    log_values[3] = _build_logged_comment_text(comment_doc, sales_order)
    return log_values


def _send_credit_controller_comment_template(phone, values, comment_doc, sales_order, recipient_user=None, recipient_name=None):
    settings = frappe.get_single("Whatsapp Setting")
    access_token = settings.get_password("access_token") or settings.get("access_token")
    phone_number_id = settings.get("phone_number_id")

    if not access_token or not phone_number_id:
        return {"success": False, "error": "Missing Access Token or Phone Number ID in WhatsApp Settings"}

    phone = _normalize_phone(phone)
    if not phone:
        return {"success": False, "error": "Missing recipient phone number"}

    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": CREDIT_CONTROLLER_COMMENT_TEMPLATE_NAME,
            "language": {"code": CREDIT_CONTROLLER_COMMENT_TEMPLATE_LANGUAGE},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(value or "")} for value in values],
                },
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": CREDIT_CONTROLLER_COMMENT_TEMPLATE_BUTTON_INDEX,
                    "parameters": [
                        {
                            "type": "text",
                            "text": _build_button_value(sales_order),
                        }
                    ],
                },
            ],
        },
    }

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
            log_data = {
                "doctype": "Whatsapp Message",
                "from_number": phone,
                "message_type": "template",
                "message": _render_credit_controller_message(
                    _build_credit_controller_log_values(values, comment_doc, sales_order)
                ),
                "message_status": "sent",
                "message_id": message_id,
                "timestamp": frappe.utils.now_datetime().strftime("%H:%M:%S"),
            }
            if recipient_user and frappe.db.exists("User", recipient_user):
                log_data["custom_user"] = recipient_user

            frappe.get_doc(log_data).insert(ignore_permissions=True)
            frappe.db.commit()
            return {"success": True, "message_id": message_id}

        error_msg = result.get("error", {}).get("message", str(result))
        _log_whatsapp_error(
            "Sales Order Comment WhatsApp",
            f"WhatsApp Send Error: {error_msg}",
            payload=payload,
            response=result,
        )
        return {"success": False, "error": error_msg}

    except Exception as e:
        _log_whatsapp_error(
            "Sales Order Comment WhatsApp",
            "WhatsApp send exception",
            payload=payload,
            exc=e,
        )
        return {"success": False, "error": str(e)}


def _send_sales_order_comment_notifications(comment_name):
    try:
        comment_doc = frappe.get_doc("Comment", comment_name)

        if comment_doc.reference_doctype != "Sales Order" or not comment_doc.reference_name:
            _log_skip("Comment is not linked to a Sales Order.", comment_doc)
            return
        if (comment_doc.comment_type or "").lower() != "comment":
            _log_skip("Comment type is not Comment.", comment_doc)
            return

        sales_order = frappe.get_doc("Sales Order", comment_doc.reference_name)
        comment_creator = _get_comment_creator(comment_doc)

        if not _is_credit_controller(comment_creator):
            return

        recipients = _get_sales_order_creator_recipient(sales_order.owner, comment_creator)
        if not recipients:
            _log_skip(
                "Credit Controller comment found, but Sales Order creator has no usable User mobile_no/phone or is same as commenter.",
                comment_doc,
                sales_order,
                {"comment_creator": comment_creator},
            )
            return

        values = _build_credit_controller_template_values(comment_doc, sales_order)

        for recipient in recipients:
            result = _send_credit_controller_comment_template(
                phone=recipient.whatsapp_recipient_number,
                values=values,
                comment_doc=comment_doc,
                sales_order=sales_order,
                recipient_user=None if getattr(recipient, "is_additional_recipient", False) else recipient.name,
                recipient_name=recipient.full_name or recipient.name,
            )

            if not result.get("success"):
                frappe.log_error(
                    title="Sales Order Comment WhatsApp",
                    message=(
                        f"Failed to send credit controller comment notification for {sales_order.name} "
                        f"to {recipient.name}: {result.get('error')}"
                    ),
                )

    except Exception:
        frappe.log_error(
            title="Sales Order Comment WhatsApp",
            message=frappe.get_traceback(),
        )


def on_sales_order_comment_after_insert(doc, method=None):
    if doc.reference_doctype != "Sales Order" or not doc.reference_name:
        return
    if (doc.comment_type or "").lower() != "comment":
        return

    frappe.enqueue(
        _send_sales_order_comment_notifications,
        comment_name=doc.name,
        queue="default",
        timeout=300,
        is_async=True,
        now=False,
        enqueue_after_commit=True,
    )
