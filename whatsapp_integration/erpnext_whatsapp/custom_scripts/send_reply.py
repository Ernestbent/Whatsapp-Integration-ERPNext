# File: whatsapp_integration/erpnext_whatsapp/custom_scripts/send_reply.py
import frappe
import requests

@frappe.whitelist()
def send_whatsapp_reply(to_number, message_body, reply_to_message_id=None):
    # Get credentials from Whatsapp Setting
    settings = frappe.get_single("Whatsapp Setting")
    phone_id = settings.get("phone_number_id")
    token = settings.get("access_token")
    version = settings.get("api_version", "v24.0")

    if not phone_id or not token:
        return {"success": False, "error": "Missing Phone Number ID or Access Token"}

    url = f"https://graph.facebook.com/{version}/{phone_id}/messages"

    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": message_body}
    }
    if reply_to_message_id:
        payload["context"] = {"message_id": reply_to_message_id}

    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        sent_msg_id = result["messages"][0]["id"]

        # Get current time safely
        now = frappe.utils.now()
        if isinstance(now, str):
            current_time = now.split(" ")[-1][:8]
        else:
            current_time = now.strftime("%H:%M:%S")

        # SAVE AS OUTGOING — AUTOMATICALLY
        frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": to_number,
            "message": message_body,
            "message_type": "text",
            "timestamp": current_time,
            "customer": frappe.db.get_value("Customer", {"whatsapp_number": ["like", f"%{to_number[-9:]}%"]}, "name") or "",
            "custom_status": "Outgoing"   # OUTGOING BY DEFAULT WHEN YOU SEND
        }).insert(ignore_permissions=True)

        return {"success": True, "message_id": sent_msg_id}

    except Exception as e:
        error_msg = str(e)
        try:
            error_detail = response.json().get("error", {}).get("message", "")
            if error_detail:
                error_msg = error_detail
        except:
            pass

        frappe.log_error(
            title="WhatsApp Send Failed",
            message=f"To: {to_number}\nError: {error_msg}"
        )
        return {"success": False, "error": error_msg}