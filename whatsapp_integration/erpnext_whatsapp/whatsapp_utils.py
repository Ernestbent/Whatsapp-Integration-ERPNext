import frappe
import requests
import json

@frappe.whitelist()
def send_text_message(to, message, preview_url=False):
    """
    Send simple WhatsApp text message
    
    Args:
        to: Phone number with country code (e.g., "256757001909")
        message: Message text to send
        preview_url: Enable link preview (True/False)
    """
    try:
        # Get credentials from Whatsapp Setting
        settings = frappe.get_single("Whatsapp Setting")
        phone_number_id = settings.get("phone_number_id")
        access_token = settings.get("access_token")
        
        if not phone_number_id or not access_token:
            return {
                "success": False,
                "error": "WhatsApp credentials not configured. Please set phone_number_id and access_token in Whatsapp Setting"
            }
        
        # API endpoint
        url = f"https://graph.facebook.com/v22.0/{phone_number_id}/messages"
        
        # Headers
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}"
        }
        
        # Payload - exactly as Meta's documentation
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {
                "preview_url": preview_url,
                "body": message
            }
        }
        
        # Send request
        print(f"\n📤 Sending message to {to}...")
        response = requests.post(url, headers=headers, json=payload)
        response_data = response.json()
        
        # Handle response
        if response.status_code == 200:
            message_id = response_data.get("messages", [{}])[0].get("id")
            print(f"✅ Message sent successfully!")
            print(f"Message ID: {message_id}\n")
            
            return {
                "success": True,
                "message_id": message_id,
                "response": response_data
            }
        else:
            error_message = response_data.get("error", {}).get("message", "Unknown error")
            error_code = response_data.get("error", {}).get("code")
            print(f"❌ Failed to send message")
            print(f"Error: {error_message} (Code: {error_code})\n")
            
            return {
                "success": False,
                "error": error_message,
                "error_code": error_code,
                "response": response_data
            }
            
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Exception: {error_msg}\n")
        frappe.log_error(f"WhatsApp Send Error: {error_msg}", "WhatsApp API")
        
        return {
            "success": False,
            "error": error_msg
        }

@frappe.whitelist()
def send_location_message(to, latitude=None, longitude=None, name=None, address=None):
    """
    Send a WhatsApp location message

    Args:
        to (str): Phone number (e.g., "256757001909")
        latitude (float): e.g., 0.367648
        longitude (float): e.g., 32.5661245
        name (str): Location name
        address (str): Address
    """
    try:
        settings = frappe.get_single("Whatsapp Setting")
        phone_number_id = settings.get("phone_number_id")
        access_token = settings.get("access_token")

        if not phone_number_id or not access_token:
            return {"success": False, "error": "Missing WhatsApp credentials"}

        # Default to your company location
        latitude = latitude or "0.367648"
        longitude = longitude or "32.5661245"
        name = name or "Autozone Professional Ltd"
        address = address or "Opposite, Mbogo Junior College, Mbogo Rd, Kampala"

        url = f"https://graph.facebook.com/v22.0/{phone_number_id}/messages"

        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "location",
            "location": {
                "latitude": "0.3675963",
                "longitude": "32.5661554",
                "name": "Autozone Professional Ltd",
                "address": "Opposite, Mbogo Junior College, Mbogo Rd, Kampala",
            },
        }

        response = requests.post(
            url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": f"Bearer {access_token}",
            },
            timeout=30,
        )

        data = response.json()
        if response.status_code == 200:
            msg_id = data.get("messages", [{}])[0].get("id")
            frappe.logger().info(f"✅ WhatsApp Location Sent: {msg_id}")
            return {"success": True, "message_id": msg_id, "response": data}
        else:
            err = data.get("error", {}).get("message", response.text)
            frappe.log_error(f"WhatsApp Location Failed: {err}", "WhatsApp Location")
            return {"success": False, "error": err, "response": data}

    except Exception as e:
        frappe.log_error(f"WhatsApp Location Exception: {str(e)}", "WhatsApp Location")
        return {"success": False, "error": str(e)}




# @frappe.whitelist()
# def test_send(phone_number, message="Hello from Frappe! 👋"):
#     """
#     Quick test function
#     Usage: bench console then call this function
#     """
#     return send_text_message(phone_number, message)