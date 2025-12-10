import frappe
import json
import hashlib
import requests
from werkzeug.wrappers import Response
from datetime import datetime

# Safe logging
def wa_log(title, message=""):
    try:
        frappe.log_error(title=str(title)[:130], message=str(message)[:2000] if message else "OK")
    except:
        pass

# Save raw payload
def save_raw_payload(raw_json):
    try:
        payload_obj = json.loads(raw_json) if isinstance(raw_json, str) else raw_json
        frappe.get_doc({
            "doctype": "Whatsapp Cloud API Payload",
            "payload": payload_obj
        }).insert(ignore_permissions=True)
        frappe.db.commit()
    except Exception as e:
        wa_log("Payload Save Error", f"{str(e)}\n{frappe.get_traceback()}")

# Duplicate prevention
webhook_cache = []
MAX_CACHE_SIZE = 100

def is_duplicate_webhook(raw_data):
    global webhook_cache
    h = hashlib.md5(str(raw_data).encode()).hexdigest()
    if h in webhook_cache:
        return True
    webhook_cache.append(h)
    if len(webhook_cache) > MAX_CACHE_SIZE:
        webhook_cache.pop(0)
    return False

@frappe.whitelist(allow_guest=True)
def receive_whatsapp():
    method = frappe.local.request.method
    try:
        if method == "GET":
            return handle_verification()
        elif method == "POST":
            return handle_webhook_data()
    except Exception as e:
        wa_log("Webhook Crash", frappe.get_traceback())
        return {"status": "error"}

def handle_verification():
    mode = frappe.request.args.get("hub.mode")
    token = frappe.request.args.get("hub.verify_token")
    challenge = frappe.request.args.get("hub.challenge")
    if mode == "subscribe" and token == "vibecode":
        return Response(challenge, status=200, content_type="text/plain")
    return Response("Forbidden", status=403)

def handle_webhook_data():
    raw = frappe.local.request.get_data(as_text=True)
    if not raw:
        return {"status": "received"}
    save_raw_payload(raw)
    if is_duplicate_webhook(raw):
        return {"status": "received"}
    try:
        payload = json.loads(raw)
        process_whatsapp_message(payload)
    except Exception as e:
        wa_log("Processing Failed", f"{str(e)}\n{frappe.get_traceback()}")
    return {"status": "received"}

def process_whatsapp_message(payload):
    if payload.get("object") != "whatsapp_business_account":
        return
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for status in value.get("statuses", []):
                handle_message_status(status)
            for message in value.get("messages", []):
                handle_single_message(message)

def handle_message_status(status):
    try:
        msg_id = status.get("id")
        new_status = status.get("status")
        ts = status.get("timestamp")
        if not msg_id or not new_status:
            return
        msg_name = frappe.db.get_value("Whatsapp Message", {"message_id": msg_id}, "name")
        if not msg_name:
            return
        contact_number = frappe.db.get_value("Whatsapp Message", msg_name, "from_number")
        frappe.db.set_value("Whatsapp Message", msg_name, {
            "message_status": new_status,
            "status_timestamp": datetime.fromtimestamp(int(ts)).strftime("%Y-%m-%d %H:%M:%S")
        }, update_modified=False)
        frappe.db.commit()
        if contact_number:
            frappe.publish_realtime("whatsapp_message_status_changed", {
                "contact_number": contact_number,
                "message_name": msg_name,
                "new_status": new_status,
                "timestamp": datetime.fromtimestamp(int(ts)).strftime("%H:%M:%S")
            }, after_commit=True)
    except Exception as e:
        wa_log("Status Update Error", f"{str(e)}\n{frappe.get_traceback()}")

def handle_single_message(message):
    try:
        msg_type = message.get("type")
        from_number = message.get("from")
        message_text = ""
        media_id = ""
        public_file_url = None
        msg_id = message.get("id")
        
        if msg_type == "text":
            message_text = message.get("text", {}).get("body", "")
        elif msg_type in ["image", "document", "video", "audio", "sticker"]:
            media_obj = message.get(msg_type, {})
            media_id = media_obj.get("id", "")
            caption = media_obj.get("caption", "")
            filename = media_obj.get("filename") or f"{msg_type}_{media_id}"
            ext_map = {"image": ".jpg", "document": ".pdf", "video": ".mp4", "audio": ".ogg", 
                      "sticker": ".webp", "jpeg": ".jpeg", "png": ".png", "gif": ".gif"}
            ext = ext_map.get(msg_type, ".bin")
            if "." not in filename:
                filename += ext
            message_text = f"{msg_type.capitalize()}: {filename}"
            if caption:
                message_text += f" – {caption}"
            public_file_url = download_and_save_media(media_id, filename)
        elif msg_type == "location":
            loc = message.get("location", {})
            message_text = f"Location: {loc.get('latitude')}, {loc.get('longitude')}"
        elif msg_type == "contacts":
            contact = message.get("contacts", [{}])[0]
            name = contact.get("name", {}).get("formatted_name", "Contact")
            message_text = f"Contact: {name}"
        else:
            message_text = f"Received {msg_type}"
        
        # Just find customer, don't create if not exists
        customer = find_customer_by_whatsapp(from_number)
        
        check_and_update_opt_in(from_number, message_text)
        save_whatsapp_message(message, message_text, media_id, public_file_url, customer, msg_id)
    except Exception as e:
        wa_log("Message Processing Error", f"{str(e)}\n{frappe.get_traceback()}")

def download_and_save_media(media_id, filename):
    if not media_id:
        return None
    try:
        access_token = frappe.db.get_single_value("Whatsapp Setting", "access_token") or frappe.conf.get("whatsapp_access_token")
        if not access_token:
            return None
        headers = {"Authorization": f"Bearer {access_token}"}
        resp = requests.get(f"https://graph.facebook.com/v20.0/{media_id}", headers=headers, timeout=15)
        resp.raise_for_status()
        media_url = resp.json().get("url")
        if not media_url:
            return None
        file_resp = requests.get(media_url, headers=headers, timeout=60)
        file_resp.raise_for_status()
        file_doc = frappe.get_doc({
            "doctype": "File",
            "file_name": filename,
            "folder": "Home",
            "is_private": 0,
            "content": file_resp.content
        })
        file_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        return file_doc.file_url
    except Exception as e:
        wa_log("Media Download Failed", f"{str(e)}\n{frappe.get_traceback()}")
        return None

def save_whatsapp_message(message, message_text, media_id="", public_file_url=None, customer=None, msg_id=None):
    """
    Save message with phone number as primary identifier
    Customer field is optional and will be updated when customer is created
    """
    try:
        from_number = message.get("from")
        timestamp = datetime.fromtimestamp(int(message.get("timestamp") or 0)).strftime("%H:%M:%S") if message.get("timestamp") else datetime.now().strftime("%H:%M:%S")
        
        msg_doc = frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": from_number,  # Always save phone number
            "message_type": message.get("type"),
            "message": message_text,
            "media_id": media_id,
            "timestamp": timestamp,
            "customer": customer if customer else None,  # Optional
            "custom_status": "Incoming",
            "message_id": msg_id,
            "message_status": "received",
        })
        msg_doc.insert(ignore_permissions=True)
        
        if public_file_url:
            frappe.db.set_value("Whatsapp Message", msg_doc.name, "custom_document", public_file_url, update_modified=False)
        
        frappe.db.commit()
        frappe.publish_realtime("whatsapp_new_message", {
            "contact_number": from_number,
            "message_name": msg_doc.name,
            "timestamp": timestamp
        }, after_commit=True)
    except Exception as e:
        wa_log("Save Message Failed", f"{str(e)}\n{frappe.get_traceback()}")

def find_customer_by_whatsapp(number):
    """
    Find customer by WhatsApp number using multiple patterns
    Returns customer name if found, None otherwise
    """
    if not number:
        return None
    
    clean = ''.join(filter(str.isdigit, str(number)))
    patterns = [clean, clean[-10:], clean[-9:]]
    
    # Add Uganda-specific patterns
    if clean.startswith("256") and len(clean) == 12:
        patterns.append("0" + clean[3:])
    if clean.startswith("0"):
        patterns.append("256" + clean[1:])
    
    for p in patterns:
        cust = frappe.db.get_value("Customer", {"whatsapp_number": p}, "name")
        if cust:
            return cust
    
    return None

def check_and_update_opt_in(number, text):
    if not number or not text:
        return
    keywords = ["yes", "opt in", "subscribe", "agree", "accept", 
                "i want to receive updates", 
                "i want to receive exclusive deals & order updates from autozone professional limited."]
    if any(k in text.lower() for k in keywords):
        cust = find_customer_by_whatsapp(number)
        if cust and not frappe.get_value("Customer", cust, "custom_opt_in"):
            frappe.db.set_value("Customer", cust, "custom_opt_in", 1, update_modified=False)
            frappe.db.commit()


# Customer Doctype Hook - Auto-link messages when customer is created/updated
def link_whatsapp_messages_to_customer(doc, method=None):
    """
    Hook this to Customer doctype's after_insert and on_update events
    Automatically links all messages with matching phone number to this customer
    
    Add to hooks.py:
    doc_events = {
        "Customer": {
            "after_insert": "your_app.webhook.link_whatsapp_messages_to_customer",
            "on_update": "your_app.webhook.link_whatsapp_messages_to_customer"
        }
    }
    """
    if not doc.whatsapp_number:
        return
    
    try:
        clean = ''.join(filter(str.isdigit, str(doc.whatsapp_number)))
        patterns = [clean, clean[-10:], clean[-9:]]
        
        # Add variations
        if clean.startswith("256") and len(clean) == 12:
            patterns.append("0" + clean[3:])
        if clean.startswith("0"):
            patterns.append("256" + clean[1:])
        
        # Find all messages with this phone number that don't have a customer linked
        # OR have a different customer linked (in case of phone number change)
        updated_count = 0
        for pattern in patterns:
            messages = frappe.db.get_all("Whatsapp Message",
                filters={
                    "from_number": ["like", f"%{pattern}%"],
                    "customer": ["!=", doc.name]  # Not already linked to this customer
                },
                fields=["name", "customer"]
            )
            
            for msg in messages:
                # Only update if no customer or different customer
                if not msg.customer or msg.customer != doc.name:
                    frappe.db.set_value("Whatsapp Message", msg.name, "customer", doc.name, update_modified=False)
                    updated_count += 1
        
        if updated_count > 0:
            frappe.db.commit()
            frappe.msgprint(f"Linked {updated_count} WhatsApp message(s) to {doc.customer_name}", 
                          alert=True, indicator="green")
    
    except Exception as e:
        frappe.log_error(f"Error linking WhatsApp messages: {str(e)}", "WhatsApp Link Error")