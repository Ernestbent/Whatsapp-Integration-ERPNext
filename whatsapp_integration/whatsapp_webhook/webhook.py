import frappe
import json
from werkzeug.wrappers import Response

@frappe.whitelist(allow_guest=True)
def receive_whatsapp():
    print("\n🔔 WEBHOOK CALLED - Method:", frappe.local.request.method, "\n")
    
    if frappe.local.request.method == "GET":
        mode = frappe.request.args.get("hub.mode")
        token = frappe.request.args.get("hub.verify_token")
        challenge = frappe.request.args.get("hub.challenge")
        
        print(f"GET Request - mode: {mode}, token: {token}, challenge: {challenge}")
        
        VERIFY_TOKEN = frappe.db.get_single_value("Whatsapp Setting", "webhook_verify_token")
        
        if mode == "subscribe" and token == VERIFY_TOKEN:
            response = Response(challenge, content_type='text/plain')
            frappe.local.response = response
            return response
        else:
            frappe.throw("Forbidden", frappe.PermissionError)

    # Handle incoming webhook data 
    raw = frappe.local.request.get_data(as_text=True)
    print(f"\n📥 Raw data received ({len(raw)} bytes)\n")
    
    try:
        payload = json.loads(raw)
        print("\n" + "="*60) 
        print("Whatsapp Webhook Payload Received")
        print("="*60)
        print(json.dumps(payload, indent=2))
        print("="*60 + "\n")
    except Exception as e:
        print(f"❌ Error parsing JSON: {e}")
        print(f"Raw data: {raw}")

    return "EVENT_RECEIVED"
    return "EVENT_RECEIVED"
