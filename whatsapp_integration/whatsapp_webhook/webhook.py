import frappe
import json
import hashlib
import requests
import os
import mimetypes
from werkzeug.wrappers import Response
from datetime import datetime


## Text Normalization
def normalize_text(text):
    if not text:
        return ""
    return " ".join(
        text.lower()
        .replace("&", "and")
        .replace(".", "")
        .replace(",", "")
        .split()
    )


## Save Raw Payload
def save_raw_payload(raw_json):
    try:
        payload_obj = json.loads(raw_json) if isinstance(raw_json, str) else raw_json
        frappe.get_doc({
            "doctype": "Whatsapp Cloud API Payload",
            "payload": payload_obj
        }).insert(ignore_permissions=True)
        frappe.db.commit()
    except Exception as e:
        frappe.log_error("Payload Save Error", f"{e}\n{frappe.get_traceback()}")


## Duplicate Webhook Detection
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


## Real-time Event Emitter
def emit_whatsapp_event(event_type, data):
    try:
        frappe.publish_realtime(
            event=event_type,
            message=data,
            user=None,
            after_commit=True
        )
    except Exception as e:
        frappe.log_error("Event Emit Error", f"{e}\n{frappe.get_traceback()}")


## Download Media from WhatsApp and Save to Frappe File Doctype
def download_and_save_media(media_id: str, filename: str = None, mime_type: str = None) -> str:
    """
    Download media from WhatsApp Cloud API using media_id.
    Saves to Frappe File doctype and returns the public file_url.
    Returns None if download fails.
    """
    try:
        settings     = frappe.get_single("Whatsapp Setting")
        ACCESS_TOKEN = settings.get("access_token")
        API_VERSION  = settings.get("app_version") or "v24.0"

        if not ACCESS_TOKEN:
            frappe.log_error("WhatsApp access token missing", "WhatsApp Media Download")
            return None

        headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}

        # Step 1: Get the media download URL from WhatsApp
        meta_response = requests.get(
            f"https://graph.facebook.com/{API_VERSION}/{media_id}",
            headers=headers,
            timeout=30
        )
        meta_response.raise_for_status()
        media_info = meta_response.json()

        download_url = media_info.get("url")
        if not download_url:
            frappe.log_error(f"No download URL for media_id: {media_id}", "WhatsApp Media Download")
            return None

        # Determine mime type and extension
        detected_mime = media_info.get("mime_type", mime_type or "application/octet-stream")
        extension     = mimetypes.guess_extension(detected_mime) or ""

        # Clean up common wrong extensions from mimetypes library
        ext_map = {
            ".jpe":  ".jpg",
            ".jpeg": ".jpg",
            ".mpga": ".mp3",
            ".m4a":  ".m4a",
            ".weba": ".webp",
        }
        extension = ext_map.get(extension, extension)

        # Build filename if not provided
        if not filename:
            filename = f"whatsapp_{media_id}{extension}"
        elif not os.path.splitext(filename)[1]:
            filename = f"{filename}{extension}"

        # Step 2: Download the actual file bytes
        download_response = requests.get(
            download_url,
            headers=headers,
            timeout=60
        )
        download_response.raise_for_status()
        file_bytes = download_response.content

        # Step 3: Save to Frappe File doctype
        file_doc = frappe.get_doc({
            "doctype":    "File",
            "file_name":  filename,
            "folder":     "Home",
            "is_private": 0,
            "content":    file_bytes
        })
        file_doc.insert(ignore_permissions=True)
        frappe.db.commit()

        frappe.logger().info(f"[WhatsApp] Media saved -> {file_doc.file_url}")
        return file_doc.file_url

    except Exception as e:
        frappe.log_error(
            f"Media download failed for media_id {media_id}: {str(e)}",
            "WhatsApp Media Download"
        )
        return None


## Main Webhook Receiver
@frappe.whitelist(allow_guest=True)
def receive_whatsapp():
    try:
        if frappe.local.request.method == "GET":
            return handle_verification()
        return handle_webhook_data()
    except Exception:
        frappe.log_error("Webhook Crash", frappe.get_traceback())
        return {"status": "error"}


## Webhook Verification Handler
def handle_verification():
    args = frappe.request.args
    if args.get("hub.mode") == "subscribe" and args.get("hub.verify_token") == "vibecode":
        return Response(args.get("hub.challenge"), status=200, content_type="text/plain")
    return Response("Forbidden", status=403)


## Process Webhook Data
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
        frappe.log_error("Processing Failed", f"{e}\n{frappe.get_traceback()}")

    return {"status": "received"}


## Payload Processor
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


## Message Status Handler
def handle_message_status(status):
    try:
        msg_id       = status.get("id")
        new_status   = status.get("status")
        recipient_id = status.get("recipient_id", "")

        if not msg_id or not new_status:
            return

        msg_name = frappe.db.get_value(
            "Whatsapp Message",
            {"message_id": msg_id},
            "name"
        )

        if not msg_name:
            return

        contact_number = frappe.db.get_value("Whatsapp Message", msg_name, "from_number")

        frappe.db.set_value(
            "Whatsapp Message",
            msg_name,
            "message_status",
            new_status,
            update_modified=False
        )

        timestamp = status.get("timestamp")
        if timestamp:
            try:
                ts_time = datetime.fromtimestamp(int(timestamp)).strftime("%H:%M:%S")
                frappe.db.set_value(
                    "Whatsapp Message",
                    msg_name,
                    "timestamp",
                    ts_time,
                    update_modified=False
                )
            except:
                pass

        frappe.db.commit()

        emit_whatsapp_event("whatsapp_message_status_changed", {
            "message_name":   msg_name,
            "message_id":     msg_id,
            "new_status":     new_status,
            "contact_number": contact_number,
            "recipient_id":   recipient_id,
            "timestamp":      datetime.now().isoformat()
        })

    except Exception:
        frappe.log_error("Status Update Error", frappe.get_traceback())


## Single Message Handler
def handle_single_message(message):
    try:
        msg_type    = message.get("type")
        from_number = message.get("from")
        msg_id      = message.get("id")

        message_text    = ""
        media_id        = ""
        public_file_url = None
        button_payload  = None
        mime_type       = None
        filename        = None

        if msg_type == "text":
            message_text = message.get("text", {}).get("body", "")

        elif msg_type == "button":
            button_payload = message.get("button", {}).get("payload")
            button_text    = message.get("button", {}).get("text")
            message_text   = button_payload or button_text or "Button clicked"

        elif msg_type == "image":
            image_data      = message.get("image", {})
            media_id        = image_data.get("id", "")
            mime_type       = image_data.get("mime_type", "image/jpeg")
            message_text    = image_data.get("caption", "Image received")
            filename        = f"whatsapp_image_{msg_id}.jpg"
            public_file_url = download_and_save_media(media_id, filename, mime_type)

        elif msg_type == "video":
            video_data      = message.get("video", {})
            media_id        = video_data.get("id", "")
            mime_type       = video_data.get("mime_type", "video/mp4")
            message_text    = video_data.get("caption", "Video received")
            filename        = f"whatsapp_video_{msg_id}.mp4"
            public_file_url = download_and_save_media(media_id, filename, mime_type)

        elif msg_type == "audio":
            audio_data      = message.get("audio", {})
            media_id        = audio_data.get("id", "")
            mime_type       = audio_data.get("mime_type", "audio/ogg")
            message_text    = "Audio received"
            filename        = f"whatsapp_audio_{msg_id}.ogg"
            public_file_url = download_and_save_media(media_id, filename, mime_type)

        elif msg_type == "document":
            doc_data        = message.get("document", {})
            media_id        = doc_data.get("id", "")
            mime_type       = doc_data.get("mime_type", "application/octet-stream")
            filename        = doc_data.get("filename") or f"whatsapp_document_{msg_id}"
            message_text    = filename
            public_file_url = download_and_save_media(media_id, filename, mime_type)

        elif msg_type == "sticker":
            sticker_data    = message.get("sticker", {})
            media_id        = sticker_data.get("id", "")
            mime_type       = sticker_data.get("mime_type", "image/webp")
            message_text    = "Sticker received"
            filename        = f"whatsapp_sticker_{msg_id}.webp"
            public_file_url = download_and_save_media(media_id, filename, mime_type)

        elif msg_type == "contacts":
            contacts_data = message.get("contacts", [])
            if contacts_data:
                contact_lines = []
                for contact in contacts_data:
                    name_info    = contact.get("name", {})
                    full_name    = name_info.get("formatted_name", "Unknown")
                    phones       = contact.get("phones", [])
                    emails       = contact.get("emails", [])
                    phone_number = phones[0].get("phone", "") if phones else ""
                    email        = emails[0].get("email", "") if emails else ""

                    line = full_name
                    if phone_number:
                        line += f" | {phone_number}"
                    if email:
                        line += f" | {email}"
                    contact_lines.append(line)

                message_text = "Contact(s) received:\n" + "\n".join(contact_lines)
            else:
                message_text = "Contact received"

        elif msg_type == "location":
            location     = message.get("location", {})
            latitude     = location.get("latitude", "")
            longitude    = location.get("longitude", "")
            loc_name     = location.get("name", "")
            address      = location.get("address", "")
            message_text = "Location received"
            if loc_name:
                message_text += f": {loc_name}"
            if address:
                message_text += f" | {address}"
            if latitude and longitude:
                message_text += f" | https://maps.google.com/?q={latitude},{longitude}"

        else:
            message_text = f"Received {msg_type}"

        customer         = find_customer_by_whatsapp(from_number)
        is_optin_message = check_for_optin_message(message_text)

        doc_name = save_whatsapp_message(
            message         = message,
            message_text    = message_text,
            media_id        = media_id,
            public_file_url = public_file_url,
            customer        = customer,
            msg_id          = msg_id,
            is_optin        = is_optin_message
        )

        if is_optin_message:
            update_customer_optin(from_number, customer)

        if doc_name:
            emit_whatsapp_event("whatsapp_new_message", {
                "contact_number": from_number,
                "message_name":   doc_name,
                "message_id":     msg_id,
                "message_type":   "incoming",
                "whatsapp_type":  msg_type,
                "message_text":   message_text,
                "button_payload": button_payload,
                "customer":       customer,
                "is_optin":       is_optin_message,
                "file_url":       public_file_url,
                "timestamp":      datetime.now().isoformat()
            })

            frappe.publish_realtime(
                event="doc_update",
                message={
                    "doctype": "Whatsapp Message",
                    "name":    doc_name,
                    "action":  "create"
                },
                user=None,
                after_commit=True
            )

    except Exception:
        frappe.log_error("Message Processing Error", frappe.get_traceback())


## Check if message is opt-in
def check_for_optin_message(text):
    if not text:
        return False
    normalized   = normalize_text(text)
    optin_phrase = "i would like to receive exclusive deals and order updates from autozone professional limited"
    return optin_phrase in normalized


## Update Customer Opt-in
def update_customer_optin(from_number, customer_name):
    try:
        if not customer_name:
            return

        if not frappe.db.exists("Customer", customer_name):
            return

        current_optin = frappe.db.get_value("Customer", customer_name, "custom_opt_in")
        if current_optin:
            return

        frappe.db.sql(
            "UPDATE `tabCustomer` SET `custom_opt_in` = 1 WHERE `name` = %s",
            (customer_name,)
        )
        frappe.db.commit()

        emit_whatsapp_event("whatsapp_customer_optin", {
            "customer":  customer_name,
            "phone":     from_number,
            "timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        frappe.log_error("Customer Opt-In Error", f"{e}\n{frappe.get_traceback()}")


## Save Message and Return Document Name
def save_whatsapp_message(message, message_text, media_id="", public_file_url=None,
                          customer=None, msg_id=None, is_optin=False):
    try:
        from_number = message.get("from")
        timestamp   = datetime.fromtimestamp(
            int(message.get("timestamp", datetime.now().timestamp()))
        ).strftime("%H:%M:%S")

        doc = frappe.get_doc({
            "doctype":        "Whatsapp Message",
            "from_number":    from_number,
            "message_type":   message.get("type"),
            "message":        message_text,
            "media_id":       media_id,
            "timestamp":      timestamp,
            "customer":       customer,
            "custom_status":  "Incoming",
            "message_id":     msg_id,
            "message_status": "received",
            "custom_opt_in":  1 if is_optin else 0
        })
        doc.insert(ignore_permissions=True)

        # Save file URL if media was downloaded
        if public_file_url:
            frappe.db.set_value(
                "Whatsapp Message",
                doc.name,
                "custom_document",
                public_file_url,
                update_modified=False
            )

        frappe.db.commit()
        return doc.name

    except Exception:
        frappe.log_error("Save Message Failed", frappe.get_traceback())
        return None


## Customer Look-up by WhatsApp Number
def find_customer_by_whatsapp(number):
    if not number:
        return None

    clean    = "".join(filter(str.isdigit, str(number)))
    patterns = {clean, clean[-10:], clean[-9:]}

    if clean.startswith("256"):
        patterns.add("0" + clean[3:])
    if clean.startswith("0"):
        patterns.add("256" + clean[1:])

    for p in patterns:
        cust = frappe.db.get_value("Customer", {"whatsapp_number": p}, "name")
        if cust:
            return cust

    return None


## Link Whatsapp Messages to Customer on Customer Save
def link_whatsapp_messages_to_customer(doc, method=None):
    if not doc.whatsapp_number:
        return

    try:
        clean    = "".join(filter(str.isdigit, doc.whatsapp_number))
        patterns = {clean, clean[-10:], clean[-9:]}

        if clean.startswith("256"):
            patterns.add("0" + clean[3:])
        if clean.startswith("0"):
            patterns.add("256" + clean[1:])

        messages = frappe.db.get_all(
            "Whatsapp Message",
            filters={"from_number": ["in", list(patterns)]},
            fields=["name", "message", "custom_opt_in"]
        )

        should_opt_in = False

        for msg in messages:
            frappe.db.set_value(
                "Whatsapp Message",
                msg.name,
                "customer",
                doc.name,
                update_modified=False
            )

            if msg.get("custom_opt_in"):
                should_opt_in = True

            if not should_opt_in and check_for_optin_message(msg.get("message", "")):
                should_opt_in = True

        if should_opt_in and not doc.custom_opt_in:
            frappe.db.sql(
                "UPDATE `tabCustomer` SET `custom_opt_in` = 1 WHERE `name` = %s",
                (doc.name,)
            )

        frappe.db.commit()

        if messages:
            emit_whatsapp_event("whatsapp_customer_linked", {
                "customer":        doc.name,
                "whatsapp_number": doc.whatsapp_number,
                "linked_messages": len(messages),
                "opted_in":        should_opt_in
            })

    except Exception:
        frappe.log_error("Customer Link Error", frappe.get_traceback())