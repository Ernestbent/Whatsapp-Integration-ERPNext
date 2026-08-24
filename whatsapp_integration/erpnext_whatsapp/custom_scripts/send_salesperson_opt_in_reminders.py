import frappe
import requests
from frappe.utils import cint, now_datetime

from whatsapp_integration.erpnext_whatsapp.custom_scripts.send_message_template_in_transit import (
    _log_whatsapp_error,
)
from whatsapp_integration.erpnext_whatsapp.custom_scripts.send_salesperson_outstanding_reports import (
    _get_whatsapp_credentials,
    _resolve_salesperson_user,
)


TEMPLATE_NAME = "opt_in_reminders"
TEMPLATE_LANGUAGE = "en"
TEMPLATE_BODY = (
    "Good morning,\n\n"
    "Please be informed that effective *1st September*, customers who have not opted in "
    "and updated their locations will not be billed.\n\n"
    "Kindly ensure that the required opt-ins are obtained and customer locations are "
    "updated before the deadline.\n\n"
    "Thank you."
)


def _is_disabled():
    return bool(
        cint(frappe.conf.get("disable_salesperson_opt_in_reminders"))
        or cint(frappe.conf.get("disable_whatsapp_sends"))
    )


def _get_salespeople():
    return frappe.get_all(
        "Sales Person",
        filters={"enabled": 1, "is_group": 0},
        pluck="name",
        order_by="name asc",
        limit_page_length=0,
    )


def _log_outgoing_message(phone, user_name, message_id="", status="sent", error_text=""):
    message = TEMPLATE_BODY
    if error_text:
        message = f"{message}\n\nError: {error_text}"

    meta = frappe.get_meta("Whatsapp Message")
    log_doc = {
        "doctype": "Whatsapp Message",
        "from_number": phone,
        "message_type": "template",
        "custom_status": "Outgoing",
        "message": message,
        "message_status": status,
        "message_id": message_id or "",
        "timestamp": now_datetime().strftime("%H:%M:%S"),
    }

    if meta.has_field("custom_user"):
        log_doc["custom_user"] = user_name
    if meta.has_field("whatsapp_message_id"):
        log_doc["whatsapp_message_id"] = message_id or ""

    frappe.get_doc(log_doc).insert(ignore_permissions=True)
    frappe.db.commit()


def _send_template(phone):
    _, access_token, phone_number_id = _get_whatsapp_credentials()
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": TEMPLATE_NAME,
            "language": {"code": TEMPLATE_LANGUAGE},
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

    try:
        result = response.json()
    except ValueError:
        result = {"raw_response": response.text}

    if response.status_code == 200 and result.get("messages"):
        return {
            "success": True,
            "message_id": result["messages"][0]["id"],
        }

    error = result.get("error", {}).get("message", str(result))
    _log_whatsapp_error(
        "Salesperson Opt-in Reminder Send Failed",
        error,
        payload=payload,
        response=result,
    )
    return {"success": False, "error": error}


def _run_salesperson_opt_in_reminders():
    details = []
    sent_phones = set()

    for salesperson in _get_salespeople():
        try:
            user_doc, phone = _resolve_salesperson_user(salesperson)
        except Exception as exc:
            _log_whatsapp_error(
                "Salesperson Opt-in Reminder Recipient Resolution",
                f"Failed to resolve recipient for {salesperson}",
                exc=exc,
            )
            details.append({
                "sales_person": salesperson,
                "status": "skipped",
                "error": str(exc),
            })
            continue

        if phone in sent_phones:
            details.append({
                "sales_person": salesperson,
                "status": "skipped",
                "detail": "Phone number already processed",
                "phone": phone,
            })
            continue

        sent_phones.add(phone)

        try:
            result = _send_template(phone)
            if result.get("success"):
                _log_outgoing_message(
                    phone=phone,
                    user_name=user_doc.name,
                    message_id=result.get("message_id"),
                )
                details.append({
                    "sales_person": salesperson,
                    "status": "sent",
                    "recipient_user": user_doc.name,
                    "phone": phone,
                    "message_id": result.get("message_id"),
                })
                continue

            _log_outgoing_message(
                phone=phone,
                user_name=user_doc.name,
                status="failed",
                error_text=result.get("error"),
            )
            details.append({
                "sales_person": salesperson,
                "status": "failed",
                "recipient_user": user_doc.name,
                "phone": phone,
                "error": result.get("error"),
            })
        except Exception as exc:
            _log_whatsapp_error(
                "Salesperson Opt-in Reminder Exception",
                f"Failed to send reminder to {salesperson}",
                exc=exc,
            )
            details.append({
                "sales_person": salesperson,
                "status": "failed",
                "recipient_user": user_doc.name,
                "phone": phone,
                "error": str(exc),
            })

    return {
        "processed": len(details),
        "sent": sum(row["status"] == "sent" for row in details),
        "failed": sum(row["status"] == "failed" for row in details),
        "skipped": sum(row["status"] == "skipped" for row in details),
        "details": details,
    }


def _send_salesperson_opt_in_reminders_background():
    try:
        summary = _run_salesperson_opt_in_reminders()
        frappe.log_error(
            title="Salesperson Opt-in Reminder Summary",
            message=frappe.as_json(summary, indent=2),
        )
    except Exception:
        frappe.log_error(
            title="Salesperson Opt-in Reminder Background Error",
            message=frappe.get_traceback(),
        )


def run_scheduled_salesperson_opt_in_reminders():
    if _is_disabled():
        frappe.logger().info(
            "Skipping scheduled salesperson opt-in reminders because site config disabled them."
        )
        return

    frappe.enqueue(
        _send_salesperson_opt_in_reminders_background,
        queue="default",
        timeout=900,
        is_async=True,
        now=False,
        enqueue_after_commit=True,
    )
