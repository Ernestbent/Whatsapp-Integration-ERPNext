import frappe
import json
from werkzeug.wrappers import Response
from whatsapp_integration.erpnext_whatsapp.whatsapp_utils import send_whatsapp_text, send_whatsapp_document, send_whatsapp_location

@frappe.whitelist(allow_guest=True)
def receive_whatsapp():
    # Handle Meta verification challenge
    if frappe.local.request.method == "GET":
        mode = frappe.request.args.get("hub.mode")
        token = frappe.request.args.get("hub.verify_token")
        challenge = frappe.request.args.get("hub.challenge")

        VERIFY_TOKEN = frappe.db.get_single_value("Whatsapp Setting", "webhook_verify_token")

        if mode == "subscribe" and token == VERIFY_TOKEN:
            # Return raw response, bypassing Frappe's JSON
            response = Response(challenge, content_type='text/plain')
            frappe.local.response = response
            return response
        else:
            frappe.throw("Forbidden", frappe.PermissionError)

    # Handle incoming webhook data 
    raw = frappe.local.request.get_data(as_text=True)
    try:
        payload = json.loads(raw)
        print("\n" + "="*60)
        print("Whatsapp Webhook Payload Received")
        print("="*60)
        print(json.dumps(payload, indent=2))
        print("="*60 + "\n")
    except:
        pass

    return "EVENT_RECEIVED"
