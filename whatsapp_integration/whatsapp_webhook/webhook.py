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
    frappe.log_error(title=str(title)[:130], message=str(message)[:2000] if message else "OK")

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
    method = frappe.local.request.method
    try:
        if method == "GET":
            return handle_verification()
        elif method == "POST":
            return handle_webhook_data()
    except Exception:
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
    if not raw or is_duplicate_webhook(raw):
        return {"status": "received"}
    try:
        payload = json.loads(raw)
        process_whatsapp_message(payload)
    except Exception:
        wa_log("Processing Failed", frappe.get_traceback())
    return {"status": "received"}

# =========================
# PROCESS MESSAGES
# =========================
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

def handle_single_message(message):
    msg_type = message.get("type")
    from_number = message.get("from")
    message_text = ""
    media_id = ""
    public_file_url = None

    if msg_type == "text":
        message_text = message.get("text", {}).get("body", "")

    elif msg_type in ["image", "document", "video", "audio", "sticker"]:
        media_obj = message.get(msg_type, {})
        media_id = media_obj.get("id", "")
        caption = media_obj.get("caption", "")
        filename = media_obj.get("filename") or f"{msg_type}_{media_id}"

        # Ensure correct extension
        ext_map = {"image": ".jpg", "document": ".pdf", "video": ".mp4", "audio": ".ogg", "sticker": ".webp"}
        ext = ext_map.get(msg_type, ".bin")
        if "." not in filename:
            filename += ext

        message_text = f"{msg_type.capitalize()}: {filename}"
        if caption:
            message_text += f" – {caption}"

        # Download file and get the correct public URL
        public_file_url = download_and_save_media(media_id, filename)

    else:
        message_text = f"Received {msg_type}"

    # Update opt-in if applicable
    check_and_update_opt_in(from_number, message_text)
    # Save the WhatsApp message with file URL if any
    save_whatsapp_message(message, message_text, media_id, public_file_url)

# =========================
# DOWNLOAD & SAVE FILE
# =========================
def download_and_save_media(media_id, filename):
    if not media_id:
        return None

    try:
        # Get WhatsApp access token from settings
        access_token = (
            frappe.db.get_single_value("Whatsapp Setting", "access_token")
            or frappe.conf.get("whatsapp_access_token")
        )
        if not access_token:
            wa_log("No Token")
            return None

        headers = {"Authorization": f"Bearer {access_token}"}

        # Get media URL from WhatsApp API
        resp = requests.get(f"https://graph.facebook.com/v20.0/{media_id}", headers=headers, timeout=15)
        resp.raise_for_status()
        media_url = resp.json().get("url")
        if not media_url:
            return None

        # Download the actual file
        file_resp = requests.get(media_url, headers=headers, timeout=60)
        file_resp.raise_for_status()

        # Save file in File doctype
        file_doc = frappe.get_doc({
            "doctype": "File",
            "file_name": filename,
            "folder": "Home",
            "is_private": 0,
            "content": file_resp.content
        })
        file_doc.insert(ignore_permissions=True)
        frappe.db.commit()

        wa_log("File Saved", f"{filename} → {file_doc.file_url}")
        return file_doc.file_url  # <-- This is the correct /files/... URL

    except Exception as e:
        wa_log("Download Failed", str(e))
        return None

# =========================
# SAVE WHATSAPP MESSAGE
# =========================
def save_whatsapp_message(message, message_text, media_id="", public_file_url=None):
    try:
        from_number = message.get("from")
        msg_id = message.get("id")
        timestamp = datetime.fromtimestamp(int(message.get("timestamp") or 0)).strftime("%H:%M:%S")
        customer = find_customer_by_whatsapp(from_number)

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
        }).insert(ignore_permissions=True)

        # Save the public /files/... URL if media exists
        if public_file_url:
            frappe.db.set_value("Whatsapp Message", msg_doc.name, "custom_document", public_file_url)
            wa_log("Linked Public File", f"{public_file_url} → {msg_doc.name}")

        # Realtime notification
        frappe.publish_realtime("whatsapp_new_message", {
            "contact_number": from_number,
            "message_name": msg_doc.name,
            "timestamp": timestamp
        }, after_commit=True)

        frappe.db.commit()

    except Exception:
        wa_log("Save Failed", frappe.get_traceback())

# =========================
# HELPERS
# =========================
def handle_message_status(status):
    try:
        msg_id = status.get("id")
        new_status = status.get("status")
        ts = status.get("timestamp")
        msg_name = frappe.db.get_value("Whatsapp Message", {"whatsapp_message_id": msg_id}, "name")
        if msg_name and ts:
            frappe.db.set_value("Whatsapp Message", msg_name, {
                "message_status": new_status,
                "status_timestamp": datetime.fromtimestamp(int(ts)).strftime("%Y-%m-%d %H:%M:%S")
            })
            frappe.db.commit()
    except Exception:
        pass

def find_customer_by_whatsapp(number):
    if not number:
        return None
    clean = ''.join(filter(str.isdigit, str(number)))
    patterns = [clean, clean[-10:], clean[-9:]]
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
    global webhook_cache
    h = hashlib.md5(raw_data.encode()).hexdigest()
    if h in webhook_cache:
        return True
    webhook_cache.append(h)
    if len(webhook_cache) > MAX_CACHE_SIZE:
        webhook_cache.pop(0)
    return False

def check_and_update_opt_in(number, text):
    if not number or not text:
        return
    if any(k in text.lower() for k in ["yes", "opt in", "subscribe", "agree", "accept"]):
        cust = find_customer_by_whatsapp(number)
        if cust and not frappe.get_value("Customer", cust, "custom_opt_in"):
            frappe.db.set_value("Customer", cust, "custom_opt_in", 1)
            frappe.db.commit()
