# whatsapp_utils.py

import frappe
import requests

@frappe.whitelist()
def send_whatsapp_text(to_number, message=None):
    """
    Send a text message to a hardcoded number
    """
    try:
        settings = frappe.get_single("Whatsapp Setting")
        token = settings.access_token
        phone_id = settings.phone_number_id

        if not token or not phone_id:
            return {"success": False, "error": "Missing credentials"}

        url = f"https://graph.facebook.com/v22.0/{phone_id}/messages"

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": "256757001909",
            "type": "text",
            "text": {
                "preview_url": True,
                "body": message or "Hello from Autozone Professional Ltd!"
            }
        }

        response = requests.post(
            url, json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )

        if response.ok:
            frappe.logger().info(f"Text sent to {to_number}")
            return {"success": True, "data": response.json()}
        else:
            err = response.json().get("error", {}).get("message", response.text)
            frappe.log_error(f"Text failed: {err}", "WhatsApp Text")
            return {"success": False, "error": err}

    except Exception as e:
        frappe.log_error(f"Text exception: {str(e)}", "WhatsApp")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def send_whatsapp_document(to_number):
    """
    Send a pre-defined document to a WhatsApp number
    """
    try:
        settings = frappe.get_single("Whatsapp Setting")
        token = settings.access_token
        phone_id = settings.phone_number_id

        if not token or not phone_id:
            return {"success": False, "error": "Missing credentials"}

        # Hardcoded document
        document = {
            "link": "https://8816618d9e70.ngrok-free.app/files/Autozone%20Pro%20-%20Tusiime%20-%200741939225.pdf",
            "filename": "Autozone Pro - Tusiime - 0741939225.pdf",
            "caption": "Attached Sales Invoice"
        }

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": "256757001909",
            "type": "document",
            "document": document
        }

        url = f"https://graph.facebook.com/v22.0/{phone_id}/messages"

        response = requests.post(
            url, json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )

        if response.ok:
            frappe.logger().info(f"Document sent to {to_number}")
            return {"success": True, "data": response.json()}
        else:
            err = response.json().get("error", {}).get("message", response.text)
            frappe.log_error(f"Document failed: {err}", "WhatsApp Document")
            return {"success": False, "error": err}

    except Exception as e:
        frappe.log_error(f"WhatsApp document exception: {str(e)}", "WhatsApp Document")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def send_whatsapp_location(to_number):
    """
    Send a hardcoded location to a WhatsApp number
    """
    try:
        settings = frappe.get_single("Whatsapp Setting")
        token = settings.access_token
        phone_id = settings.phone_number_id

        if not token or not phone_id:
            return {"success": False, "error": "Missing credentials"}

        # Hardcoded location details
        location = {
            "latitude": "0.3676028",
            "longitude": "32.5661522",
            "name": "Autozone Professional Ltd Main Office",
            "address": "Opposite, Mbogo Junior College, Mbogo Rd, Kampala"
        }

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": "256757001909",
            "type": "location",
            "location": location
        }

        url = f"https://graph.facebook.com/v22.0/{phone_id}/messages"

        response = requests.post(
            url, json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            timeout=30
        )

        if response.ok:
            frappe.logger().info(f"Location sent to {to_number}")
            return {"success": True, "data": response.json()}
        else:
            err = response.json().get("error", {}).get("message", response.text)
            frappe.log_error(f"Location failed: {err}", "WhatsApp Location")
            return {"success": False, "error": err}

    except Exception as e:
        frappe.log_error(f"WhatsApp location exception: {str(e)}", "WhatsApp Location")
        return {"success": False, "error": str(e)}
