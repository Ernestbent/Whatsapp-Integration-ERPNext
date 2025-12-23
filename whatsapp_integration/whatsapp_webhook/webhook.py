import frappe
import json
import hashlib
import requests
from werkzeug.wrappers import Response
from datetime import datetime


## Safe Logging
def wa_log(title, message=""):
    try:
        frappe.log_error(
            title=str(title)[:140],
            message=str(message)[:3000] if message else "OK"
        )
    except:
        pass


## Text Normalization (Critical for Opt-in)
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
        wa_log("Payload Save Error", f"{e}\n{frappe.get_traceback()}")


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
    """
    Emit real-time events to all connected clients
    """
    try:
        frappe.publish_realtime(
            event=event_type,
            message=data,
            user=None,  # Send to all users
            after_commit=True  # Important: wait for transaction to complete
        )
        
        wa_log(f"Event Emitted: {event_type}", f"Data: {json.dumps(data)[:200]}")
        
    except Exception as e:
        wa_log("Event Emit Error", f"{e}\n{frappe.get_traceback()}")


## Main Webhook Receiver
@frappe.whitelist(allow_guest=True)
def receive_whatsapp():
    try:
        if frappe.local.request.method == "GET":
            return handle_verification()
        return handle_webhook_data()
    except Exception:
        wa_log("Webhook Crash", frappe.get_traceback())
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
        wa_log("Processing Failed", f"{e}\n{frappe.get_traceback()}")

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


## Message Status Handler with Real-time Events
def handle_message_status(status):
    try:
        msg_id = status.get("id")
        new_status = status.get("status")
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

        # Get the contact number for this message
        contact_number = frappe.db.get_value(
            "Whatsapp Message",
            msg_name,
            "from_number"
        )

        # Update status in database
        frappe.db.set_value(
            "Whatsapp Message",
            msg_name,
            "message_status",
            new_status,
            update_modified=False
        )
        
        # Also update the timestamp if available
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

        # ✅ EMIT REAL-TIME STATUS UPDATE EVENT
        emit_whatsapp_event("whatsapp_message_status_changed", {
            "message_name": msg_name,
            "message_id": msg_id,
            "new_status": new_status,
            "contact_number": contact_number,
            "recipient_id": recipient_id,
            "timestamp": datetime.now().isoformat()
        })

        wa_log("Status Updated", f"{msg_name} -> {new_status} for {contact_number}")

    except Exception:
        wa_log("Status Update Error", frappe.get_traceback())


## Single Message Handler with Real-time Events
def handle_single_message(message):
    try:
        msg_type = message.get("type")
        from_number = message.get("from")
        msg_id = message.get("id")
        message_text = ""
        media_id = ""
        public_file_url = None

        if msg_type == "text":
            message_text = message.get("text", {}).get("body", "")
        elif msg_type == "image":
            message_text = "Image received"
            media_id = message.get("image", {}).get("id", "")
        elif msg_type == "video":
            message_text = "Video received"
            media_id = message.get("video", {}).get("id", "")
        elif msg_type == "audio":
            message_text = "Audio received"
            media_id = message.get("audio", {}).get("id", "")
        elif msg_type == "document":
            message_text = message.get("document", {}).get("filename", "Document received")
            media_id = message.get("document", {}).get("id", "")
        elif msg_type == "sticker":
            message_text = "Sticker received"
            media_id = message.get("sticker", {}).get("id", "")
        else:
            message_text = f"Received {msg_type}"

        customer = find_customer_by_whatsapp(from_number)

        # Save message and get the document
        doc_name = save_whatsapp_message(
            message=message,
            message_text=message_text,
            media_id=media_id,
            public_file_url=public_file_url,
            customer=customer,
            msg_id=msg_id
        )

        # ✅ EMIT REAL-TIME NEW MESSAGE EVENT
        if doc_name:
            emit_whatsapp_event("whatsapp_new_message", {
                "contact_number": from_number,
                "message_name": doc_name,
                "message_id": msg_id,
                "message_type": "incoming",
                "whatsapp_type": msg_type,
                "message_text": message_text[:100],  # First 100 chars
                "customer": customer,
                "timestamp": datetime.now().isoformat(),
                "action": "new_incoming_message"
            })
            
            # Also emit generic doc_update for compatibility
            frappe.publish_realtime(
                event="doc_update",
                message={
                    "doctype": "Whatsapp Message",
                    "name": doc_name,
                    "from_number": from_number,
                    "customer": customer,
                    "action": "create"
                },
                user=None,
                after_commit=True
            )

        check_and_update_opt_in(from_number, message_text)

    except Exception:
        wa_log("Message Processing Error", frappe.get_traceback())


## Save Message and Return Document Name
def save_whatsapp_message(message, message_text, media_id="", public_file_url=None, customer=None, msg_id=None):
    try:
        from_number = message.get("from")
        timestamp = datetime.fromtimestamp(
            int(message.get("timestamp", datetime.now().timestamp()))
        ).strftime("%H:%M:%S")

        doc = frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": from_number,
            "message_type": message.get("type"),
            "message": message_text,
            "media_id": media_id,
            "timestamp": timestamp,
            "customer": customer,
            "custom_status": "Incoming",
            "message_id": msg_id,
            "message_status": "received",
        })
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
        wa_log("Message Saved", f"{doc.name} from {from_number}")

        return doc.name

    except Exception:
        wa_log("Save Message Failed", frappe.get_traceback())
        return None


## Customer Look-up by WhatsApp Number
def find_customer_by_whatsapp(number):
    if not number:
        return None

    clean = "".join(filter(str.isdigit, str(number)))
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


## Opt-In Check and Update
def check_and_update_opt_in(number, text):
    if not number or not text:
        return

    normalized = normalize_text(text)

    optin_phrase = "i want to receive exclusive deals and order updates from autozone professional limited"

    if optin_phrase not in normalized:
        return

    cust = find_customer_by_whatsapp(number)

    if cust and not frappe.get_value("Customer", cust, "custom_opt_in"):
        frappe.db.set_value(
            "Customer",
            cust,
            "custom_opt_in",
            1,
            update_modified=False
        )
        frappe.db.commit()
        
        wa_log("Opt-In Updated", f"Customer {cust} opted in via WhatsApp")


## Link Whatsapp Messages to Customer on Customer Save
def link_whatsapp_messages_to_customer(doc, method=None):
    if not doc.whatsapp_number:
        return

    try:
        clean = "".join(filter(str.isdigit, doc.whatsapp_number))
        patterns = {clean, clean[-10:], clean[-9:]}

        if clean.startswith("256"):
            patterns.add("0" + clean[3:])
        if clean.startswith("0"):
            patterns.add("256" + clean[1:])

        messages = frappe.db.get_all(
            "Whatsapp Message",
            filters={
                "from_number": ["in", list(patterns)]
            },
            fields=["name", "message"]
        )

        for msg in messages:
            frappe.db.set_value(
                "Whatsapp Message",
                msg.name,
                "customer",
                doc.name,
                update_modified=False
            )

            if not doc.custom_opt_in:
                if "exclusive deals" in normalize_text(msg.message):
                    frappe.db.set_value(
                        "Customer",
                        doc.name,
                        "custom_opt_in",
                        1,
                        update_modified=False
                    )

        frappe.db.commit()
        
        # Emit event for updated messages
        if messages:
            emit_whatsapp_event("whatsapp_customer_linked", {
                "customer": doc.name,
                "whatsapp_number": doc.whatsapp_number,
                "linked_messages": len(messages)
            })

    except Exception:
        wa_log("Customer Link Error", frappe.get_traceback())


## Manual Real-time Trigger (for testing)
@frappe.whitelist()
def trigger_realtime_test(contact_number, message_text="Test message"):
    """
    Manually trigger a real-time event for testing
    """
    try:
        emit_whatsapp_event("whatsapp_new_message", {
            "contact_number": contact_number,
            "message_name": f"test_{datetime.now().timestamp()}",
            "message_id": f"test_{datetime.now().timestamp()}",
            "message_type": "incoming",
            "message_text": message_text,
            "timestamp": datetime.now().isoformat(),
            "action": "test_event"
        })
        
        return {"success": True, "message": "Test event triggered"}
    except Exception as e:
        return {"success": False, "error": str(e)}