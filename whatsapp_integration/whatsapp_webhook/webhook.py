import frappe
import json
import hashlib
import requests
from werkzeug.wrappers import Response
from datetime import datetime

# =========================
# SAFE LOGGING
# =========================
def wa_log(title, message=""):
    """Safe logging with length limits"""
    try:
        frappe.log_error(title=str(title)[:130], message=str(message)[:2000] if message else "OK")
    except:
        pass

# =========================
# DUPLICATE PREVENTION
# =========================
webhook_cache = []
MAX_CACHE_SIZE = 100

# =========================
# MAIN WEBHOOK
# =========================
@frappe.whitelist(allow_guest=True)
def receive_whatsapp():
    """Main webhook endpoint for WhatsApp Cloud API"""
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
    """Handle webhook verification from Meta"""
    mode = frappe.request.args.get("hub.mode")
    token = frappe.request.args.get("hub.verify_token")
    challenge = frappe.request.args.get("hub.challenge")
    
    if mode == "subscribe" and token == "vibecode":
        return Response(challenge, status=200, content_type="text/plain")
    return Response("Forbidden", status=403)

def handle_webhook_data():
    """Process incoming webhook POST data"""
    raw = frappe.local.request.get_data(as_text=True)
    
    # Prevent duplicate processing
    if not raw or is_duplicate_webhook(raw):
        return {"status": "received"}
    
    # Log raw webhook for debugging (first 1000 chars)
    wa_log("Webhook Received", raw[:1000])
    
    try:
        payload = json.loads(raw)
        process_whatsapp_message(payload)
    except Exception as e:
        wa_log("Processing Failed", f"{str(e)}\n{frappe.get_traceback()}")
    
    return {"status": "received"}

# =========================
# PROCESS MESSAGES
# =========================
def process_whatsapp_message(payload):
    """Main processing logic for WhatsApp webhooks"""
    if payload.get("object") != "whatsapp_business_account":
        wa_log("Invalid Webhook Object", str(payload.get("object")))
        return

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            
            # Process status updates (sent, delivered, read, failed)
            statuses = value.get("statuses", [])
            if statuses:
                wa_log("Statuses Found", f"Count: {len(statuses)}")
                for status in statuses:
                    handle_message_status(status)
            
            # Process incoming messages
            messages = value.get("messages", [])
            if messages:
                wa_log("Messages Found", f"Count: {len(messages)}")
                for message in messages:
                    handle_single_message(message)

# =========================
# HANDLE MESSAGE STATUS UPDATES
# =========================
def handle_message_status(status):
    """
    Handle status updates from WhatsApp Cloud API
    Status values: sent, delivered, read, failed
    """
    try:
        msg_id = status.get("id")
        new_status = status.get("status")
        ts = status.get("timestamp")
        recipient = status.get("recipient_id")
        
        wa_log("Status Update", f"ID: {msg_id}, Status: {new_status}, To: {recipient}")
        
        if not msg_id or not new_status:
            wa_log("Status Missing Data", f"ID: {msg_id}, Status: {new_status}")
            return
        
        # Find the Whatsapp Message by whatsapp_message_id
        msg_name = frappe.db.get_value(
            "Whatsapp Message",
            {"whatsapp_message_id": msg_id},
            "name"
        )
        
        if not msg_name:
            wa_log("Message Not Found in DB", f"WhatsApp ID: {msg_id}")
            return
        
        # Get contact number for realtime update
        contact_number = frappe.db.get_value("Whatsapp Message", msg_name, "from_number")
        
        # Update the message status
        frappe.db.set_value("Whatsapp Message", msg_name, {
            "message_status": new_status,
            "status_timestamp": datetime.fromtimestamp(int(ts)).strftime("%Y-%m-%d %H:%M:%S")
        }, update_modified=False)
        
        frappe.db.commit()
        
        wa_log("Status Updated", f"Doc: {msg_name}, Status: {new_status}")
        
        # Publish realtime event to update UI ticks immediately
        if contact_number:
            frappe.publish_realtime(
                "whatsapp_message_status_changed",
                {
                    "contact_number": contact_number,
                    "message_name": msg_name,
                    "new_status": new_status,
                    "timestamp": datetime.fromtimestamp(int(ts)).strftime("%H:%M:%S")
                },
                after_commit=True
            )
            wa_log("Realtime Published", f"Event: status_changed, Contact: {contact_number}")
        
    except Exception as e:
        wa_log("Status Update Error", f"{str(e)}\n{frappe.get_traceback()}")

# =========================
# HANDLE INCOMING MESSAGES
# =========================
def handle_single_message(message):
    """Process a single incoming WhatsApp message"""
    try:
        msg_type = message.get("type")
        from_number = message.get("from")
        message_text = ""
        media_id = ""
        public_file_url = None

        wa_log("Processing Message", f"Type: {msg_type}, From: {from_number}")

        if msg_type == "text":
            message_text = message.get("text", {}).get("body", "")

        elif msg_type in ["image", "document", "video", "audio", "sticker"]:
            media_obj = message.get(msg_type, {})
            media_id = media_obj.get("id", "")
            caption = media_obj.get("caption", "")
            filename = media_obj.get("filename") or f"{msg_type}_{media_id}"

            # Ensure correct extension
            ext_map = {
                "image": ".jpg",
                "document": ".pdf",
                "video": ".mp4",
                "audio": ".ogg",
                "sticker": ".webp"
            }
            ext = ext_map.get(msg_type, ".bin")
            if "." not in filename:
                filename += ext

            message_text = f"{msg_type.capitalize()}: {filename}"
            if caption:
                message_text += f" – {caption}"

            # Download file and get the public URL
            public_file_url = download_and_save_media(media_id, filename)

        elif msg_type == "location":
            location = message.get("location", {})
            lat = location.get("latitude")
            lng = location.get("longitude")
            message_text = f"Location: {lat}, {lng}"

        elif msg_type == "contacts":
            contacts = message.get("contacts", [])
            if contacts:
                contact = contacts[0]
                name = contact.get("name", {}).get("formatted_name", "Contact")
                message_text = f"Contact: {name}"

        else:
            message_text = f"Received {msg_type}"
            wa_log("Unknown Message Type", msg_type)

        # Update opt-in if applicable
        check_and_update_opt_in(from_number, message_text)
        
        # Save the WhatsApp message
        save_whatsapp_message(message, message_text, media_id, public_file_url)
        
    except Exception as e:
        wa_log("Message Processing Error", f"{str(e)}\n{frappe.get_traceback()}")

# =========================
# DOWNLOAD & SAVE FILE
# =========================
def download_and_save_media(media_id, filename):
    """Download media from WhatsApp and save to ERPNext File doctype"""
    if not media_id:
        return None

    try:
        # Get WhatsApp access token
        access_token = (
            frappe.db.get_single_value("Whatsapp Setting", "access_token")
            or frappe.conf.get("whatsapp_access_token")
        )
        
        if not access_token:
            wa_log("No Access Token", "Cannot download media")
            return None

        headers = {"Authorization": f"Bearer {access_token}"}

        # Step 1: Get media URL from WhatsApp API
        wa_log("Getting Media URL", f"Media ID: {media_id}")
        resp = requests.get(
            f"https://graph.facebook.com/v20.0/{media_id}",
            headers=headers,
            timeout=15
        )
        resp.raise_for_status()
        media_url = resp.json().get("url")
        
        if not media_url:
            wa_log("No Media URL", "WhatsApp returned empty URL")
            return None

        # Step 2: Download the actual file
        wa_log("Downloading Media", f"URL: {media_url[:100]}")
        file_resp = requests.get(media_url, headers=headers, timeout=60)
        file_resp.raise_for_status()

        # Step 3: Save to ERPNext File doctype
        file_doc = frappe.get_doc({
            "doctype": "File",
            "file_name": filename,
            "folder": "Home",
            "is_private": 0,  # Public so it can be viewed
            "content": file_resp.content
        })
        file_doc.insert(ignore_permissions=True)
        frappe.db.commit()

        wa_log("File Saved Successfully", f"{filename} → {file_doc.file_url}")
        return file_doc.file_url

    except Exception as e:
        wa_log("Media Download Failed", f"{str(e)}\n{frappe.get_traceback()}")
        return None

# =========================
# SAVE WHATSAPP MESSAGE
# =========================
def save_whatsapp_message(message, message_text, media_id="", public_file_url=None):
    """Create a Whatsapp Message document for incoming message"""
    try:
        from_number = message.get("from")
        msg_id = message.get("id")
        timestamp = datetime.fromtimestamp(int(message.get("timestamp") or 0)).strftime("%H:%M:%S")
        customer = find_customer_by_whatsapp(from_number)

        wa_log("Saving Message", f"From: {from_number}, Type: {message.get('type')}")

        # Create Whatsapp Message document
        msg_doc = frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": from_number,
            "message_type": message.get("type"),
            "message": message_text,
            "media_id": media_id,
            "timestamp": timestamp,
            "customer": customer,
            "custom_status": "Incoming",
            "whatsapp_message_id": msg_id,
            "message_status": "received",
        })
        msg_doc.insert(ignore_permissions=True)

        # Save file URL to custom_document if media exists
        if public_file_url:
            frappe.db.set_value("Whatsapp Message", msg_doc.name, "custom_document", public_file_url)
            wa_log("File Linked", f"{public_file_url} → {msg_doc.name}")

        frappe.db.commit()

        # Publish realtime event for UI update
        frappe.publish_realtime(
            "whatsapp_new_message",
            {
                "contact_number": from_number,
                "message_name": msg_doc.name,
                "timestamp": timestamp
            },
            after_commit=True
        )
        
        wa_log("Message Saved & Event Published", f"Doc: {msg_doc.name}")

    except Exception as e:
        wa_log("Save Message Failed", f"{str(e)}\n{frappe.get_traceback()}")

# =========================
# HELPER FUNCTIONS
# =========================
def find_customer_by_whatsapp(number):
    """Find customer by WhatsApp number with multiple patterns"""
    if not number:
        return None
    
    clean = ''.join(filter(str.isdigit, str(number)))
    patterns = [clean, clean[-10:], clean[-9:]]
    
    # Uganda specific patterns
    if clean.startswith("256") and len(clean) == 12:
        patterns.append("0" + clean[3:])
    if clean.startswith("0"):
        patterns.append("256" + clean[1:])
    
    for p in patterns:
        cust = frappe.db.get_value("Customer", {"whatsapp_number": p}, "name")
        if cust:
            return cust
    
    return None

def is_duplicate_webhook(raw_data):
    """Prevent processing the same webhook twice"""
    global webhook_cache
    h = hashlib.md5(raw_data.encode()).hexdigest()
    
    if h in webhook_cache:
        wa_log("Duplicate Webhook", "Skipping")
        return True
    
    webhook_cache.append(h)
    if len(webhook_cache) > MAX_CACHE_SIZE:
        webhook_cache.pop(0)
    
    return False

def check_and_update_opt_in(number, text):
    """Check if message contains opt-in keywords and update customer"""
    if not number or not text:
        return
    
    opt_in_keywords = ["yes", "opt in", "subscribe", "agree", "accept"]
    if any(k in text.lower() for k in opt_in_keywords):
        cust = find_customer_by_whatsapp(number)
        if cust and not frappe.get_value("Customer", cust, "custom_opt_in"):
            frappe.db.set_value("Customer", cust, "custom_opt_in", 1)
            frappe.db.commit()
            wa_log("Opt-in Updated", f"Customer: {cust}")