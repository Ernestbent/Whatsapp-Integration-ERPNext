import frappe
import json
import hashlib
from werkzeug.wrappers import Response
from datetime import datetime

# Cache for deduplication
webhook_cache = []
MAX_CACHE_SIZE = 100

@frappe.whitelist(allow_guest=True)
def receive_whatsapp():
    """WhatsApp Cloud API Webhook handler"""
    method = frappe.local.request.method

    try:
        if method == "GET":
            return handle_verification()
        elif method == "POST":
            return handle_webhook_data()
        else:
            return {"status": "error", "message": "Method not allowed"}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "WhatsApp Webhook Error")
        return {"status": "error", "message": str(e)}

def handle_verification():
    mode = frappe.request.args.get("hub.mode")
    token = frappe.request.args.get("hub.verify_token")
    challenge = frappe.request.args.get("hub.challenge")
    VERIFY_TOKEN = "vibecode"

    if mode == "subscribe" and token == VERIFY_TOKEN:
        return Response(challenge, status=200, content_type='text/plain')
    return Response("Forbidden - Invalid verify token", status=403, content_type='text/plain')

def handle_webhook_data():
    raw = frappe.local.request.get_data(as_text=True)

    if is_duplicate_webhook(raw):
        return {"status": "received"}

    if not raw:
        return {"status": "received"}

    try:
        payload = json.loads(raw)
        process_whatsapp_message(payload)
        return {"status": "received"}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "WhatsApp Webhook Processing Error")
        return {"status": "received"}

def process_whatsapp_message(payload):
    if payload.get("object") != "whatsapp_business_account":
        return

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            messages = value.get("messages", [])

            for message in messages:
                msg_type = message.get('type')
                message_text = ""
                media_id = ""

                if msg_type == 'text':
                    message_text = message.get('text', {}).get('body', '')
                elif msg_type == 'image':
                    media_id = message.get('image', {}).get('id', '')
                    caption = message.get('image', {}).get('caption', '')
                    message_text = f"Image: {caption}" if caption else "Image received"
                elif msg_type == 'document':
                    media_id = message.get('document', {}).get('id', '')
                    filename = message.get('document', {}).get('filename', '')
                    message_text = f"Document: {filename}" if filename else "Document received"
                elif msg_type == 'audio':
                    message_text = "Audio received"
                elif msg_type == 'video':
                    message_text = "Video received"
                elif msg_type == 'location':
                    loc = message.get('location', {})
                    message_text = f"Location: {loc.get('latitude','')}, {loc.get('longitude','')}"
                elif msg_type == 'contacts':
                    contacts = message.get('contacts', [])
                    message_text = f"{len(contacts)} contact(s) shared"
                else:
                    message_text = f"Unknown message type: {msg_type}"

                from_number = message.get("from")
                check_and_update_opt_in(from_number, message_text)
                save_whatsapp_message(message, message_text, media_id)

def save_whatsapp_message(message, message_text, media_id=""):
    """Save incoming WhatsApp message and update/create Whatsapp Live Chat"""
    try:
        from_number = message.get("from", "")
        timestamp_unix = message.get("timestamp", "")
        timestamp_str = datetime.fromtimestamp(int(timestamp_unix)).strftime("%H:%M:%S") if timestamp_unix else frappe.utils.now_datetime().strftime("%H:%M:%S")
        customer_name = find_customer_by_whatsapp(from_number)

        # Save to Whatsapp Message
        msg_doc = frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": from_number,
            "message_type": message.get("type", ""),
            "message": message_text,
            "media_id": media_id,
            "timestamp": timestamp_str,
            "customer": customer_name,
            "custom_status": "Incoming"
        })
        msg_doc.insert(ignore_permissions=True)

        # AUTO CREATE OR UPDATE Whatsapp Live Chat using "contact" field
        chat_doc_name = frappe.db.get_value("Whatsapp Live Chat", {"contact": from_number}, "name")

        if chat_doc_name:
            # Update existing
            unread_count = frappe.db.get_value("Whatsapp Live Chat", chat_doc_name, "unread_count") or 0
            frappe.db.set_value("Whatsapp Live Chat", chat_doc_name, {
                "contact": from_number,  # Ensure it's saved
                "last_message": message_text[:100],
                "last_message_time": frappe.utils.now(),
                "unread_count": unread_count + 1
            })
        else:
            # Create new
            frappe.get_doc({
                "doctype": "Whatsapp Live Chat",
                "contact": from_number,  # THIS IS YOUR FIELD
                "last_message": message_text[:100],
                "last_message_time": frappe.utils.now(),
                "unread_count": 1
            }).insert(ignore_permissions=True)

        frappe.db.commit()
        return msg_doc.name

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Whatsapp Message Save FAILED")
        raise

def find_customer_by_whatsapp(whatsapp_number):
    if not whatsapp_number:
        return None
    clean_number = ''.join(filter(str.isdigit, whatsapp_number))
    patterns = [
        clean_number,
        "0" + clean_number[3:] if clean_number.startswith("256") and len(clean_number) == 12 else "",
        "256" + clean_number[1:] if clean_number.startswith("0") and len(clean_number) == 10 else "",
        clean_number[-9:] if len(clean_number) >= 9 else ""
    ]
    for num in [p for p in patterns if p]:
        customer = frappe.db.get_value("Customer", {"whatsapp_number": num}, "name")
        if customer:
            return customer
    return None

def is_duplicate_webhook(raw_data):
    global webhook_cache
    webhook_hash = hashlib.md5(raw_data.encode()).hexdigest()
    if webhook_hash in webhook_cache:
        return True
    webhook_cache.append(webhook_hash)
    if len(webhook_cache) > MAX_CACHE_SIZE:
        webhook_cache.pop(0)
    return False

def check_and_update_opt_in(whatsapp_number, message_text):
    if not whatsapp_number or not message_text:
        return
    opt_in_phrases = ["yes", "opt in", "opt-in", "subscribe", "agree", "accept", "i want to receive updates"]
    if not any(phrase in message_text.lower() for phrase in opt_in_phrases):
        return
    customer_name = find_customer_by_whatsapp(whatsapp_number)
    if not customer_name:
        return
    customer = frappe.get_doc("Customer", customer_name)
    if customer.get("custom_opt_in"):
        return
    customer.custom_opt_in = 1
    customer.save(ignore_permissions=True)
    frappe.db.commit()