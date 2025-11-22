import frappe
import requests
import json

@frappe.whitelist()
def send_text_message(to, message, preview_url=False):
    try:
        settings = frappe.get_single("Whatsapp Setting")
        phone_number_id = settings.get("phone_number_id")
        access_token = settings.get("access_token")

        if not phone_number_id or not access_token:
            return {"success": False, "error": "WhatsApp credentials not configured"}

        url = f"https://graph.facebook.com/v22.0/{phone_number_id}/messages"
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {access_token}"}
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {"preview_url": preview_url, "body": message}
        }

        response = requests.post(url, headers=headers, json=payload)
        data = response.json()

        if response.status_code == 200:
            msg_id = data.get("messages", [{}])[0].get("id")
            return {"success": True, "message_id": msg_id, "response": data}
        else:
            err = data.get("error", {}).get("message", "Unknown error")
            return {"success": False, "error": err, "response": data}

    except Exception as e:
        frappe.log_error(f"WhatsApp Send Error: {str(e)}", "WhatsApp API")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def send_location_message(to, latitude="0.367648", longitude="32.5661245", name="Autozone Professional Ltd", address="Opposite, Mbogo Junior College, Mbogo Rd, Kampala"):
    try:
        settings = frappe.get_single("Whatsapp Setting")
        phone_number_id = settings.get("phone_number_id")
        access_token = settings.get("access_token")

        if not phone_number_id or not access_token:
            return {"success": False, "error": "Missing WhatsApp credentials"}

        url = f"https://graph.facebook.com/v22.0/{phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "location",
            "location": {"latitude": latitude, "longitude": longitude, "name": name, "address": address},
        }

        response = requests.post(url, data=json.dumps(payload).encode("utf-8"),
                                 headers={"Content-Type": "application/json", "Authorization": f"Bearer {access_token}"}, timeout=30)
        data = response.json()
        if response.status_code == 200:
            msg_id = data.get("messages", [{}])[0].get("id")
            return {"success": True, "message_id": msg_id, "response": data}
        else:
            err = data.get("error", {}).get("message", response.text)
            frappe.log_error(f"WhatsApp Location Failed: {err}", "WhatsApp Location")
            return {"success": False, "error": err, "response": data}

    except Exception as e:
        frappe.log_error(f"WhatsApp Location Exception: {str(e)}", "WhatsApp Location")
        return {"success": False, "error": str(e)}
