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

        #  EMIT REAL-TIME STATUS UPDATE EVENT
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
        button_payload = None

        # =========================
        # MESSAGE TYPE HANDLING
        # =========================

        if msg_type == "text":
            message_text = message.get("text", {}).get("body", "")

        elif msg_type == "button":
            button_payload = message.get("button", {}).get("payload")
            button_text = message.get("button", {}).get("text")

            # Prefer payload, fallback to text
            message_text = button_payload or button_text or "Button clicked"

        elif msg_type == "image":
            message_text = "📷 Image received"
            media_id = message.get("image", {}).get("id")

        elif msg_type == "video":
            message_text = "🎥 Video received"
            media_id = message.get("video", {}).get("id")

        elif msg_type == "audio":
            message_text = "🎵 Audio received"
            media_id = message.get("audio", {}).get("id")

        elif msg_type == "document":
            message_text = message.get("document", {}).get("filename", "📄 Document received")
            media_id = message.get("document", {}).get("id")

        elif msg_type == "sticker":
            message_text = "😀 Sticker received"
            media_id = message.get("sticker", {}).get("id")

        else:
            message_text = f"Received {msg_type}"

        # Customer Look-up
        customer = find_customer_by_whatsapp(from_number)

        # Check for Opt In
        is_optin_message = check_for_optin_message(message_text)

        # Save Message
        doc_name = save_whatsapp_message(
            message=message,
            message_text=message_text,
            media_id=media_id,
            public_file_url=public_file_url,
            customer=customer,
            msg_id=msg_id,
            is_optin=is_optin_message
        )

        # Update Customer Opt-in 
        if is_optin_message:
            update_customer_optin(from_number, customer)

        # Real-time Event Emission
        if doc_name:
            emit_whatsapp_event("whatsapp_new_message", {
                "contact_number": from_number,
                "message_name": doc_name,
                "message_id": msg_id,
                "message_type": "incoming",
                "whatsapp_type": msg_type,
                "message_text": message_text,
                "button_payload": button_payload,  # Button payload if applicable
                "customer": customer,
                "is_optin": is_optin_message,
                "timestamp": datetime.now().isoformat()
            })

            frappe.publish_realtime(
                event="doc_update",
                message={
                    "doctype": "Whatsapp Message",
                    "name": doc_name,
                    "action": "create"
                },
                user=None,
                after_commit=True
            )

    except Exception:
        wa_log("Message Processing Error", frappe.get_traceback())


## Check if message is opt-in
def check_for_optin_message(text):
    """
    Check if message text contains the opt-in phrase
    Returns True if it's an opt-in message
    """
    if not text:
        return False
    
    normalized = normalize_text(text)
    optin_phrase = "i want to receive exclusive deals and order updates from autozone professional limited"
    
    return optin_phrase in normalized


## Update Customer Opt-in
def update_customer_optin(from_number, customer_name):
    """
    Update customer opt-in status if customer exists
    """
    try:
        if not customer_name:
            # Customer doesn't exist yet, opt-in will be in WhatsApp Message only
            wa_log("Opt-In - No Customer", f"Phone {from_number} opted in but no customer linked yet")
            return
        
        # Check if customer already opted in
        current_optin = frappe.db.get_value("Customer", customer_name, "custom_opt_in")
        
        if not current_optin:
            frappe.db.set_value(
                "Customer",
                customer_name,
                "custom_opt_in",
                1,
                update_modified=False
            )
            frappe.db.commit()
            
            wa_log("Customer Opt-In Updated", f"Customer {customer_name} ({from_number}) opted in via WhatsApp")
            
            # Emit event for customer opt-in
            emit_whatsapp_event("whatsapp_customer_optin", {
                "customer": customer_name,
                "phone": from_number,
                "timestamp": datetime.now().isoformat()
            })
    
    except Exception as e:
        wa_log("Customer Opt-In Error", f"{e}\n{frappe.get_traceback()}")


## Save Message and Return Document Name
def save_whatsapp_message(message, message_text, media_id="", public_file_url=None, customer=None, msg_id=None, is_optin=False):
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
            "custom_opt_in": 1 if is_optin else 0  # Set opt-in checkbox if it's opt-in message
        })
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
        wa_log("Message Saved", f"{doc.name} from {from_number} (Opt-in: {is_optin})")

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


## Link Whatsapp Messages to Customer on Customer Save
def link_whatsapp_messages_to_customer(doc, method=None):
    """
    Hook: Called when Customer is saved
    Links WhatsApp messages to customer and checks for opt-in in message history
    """
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
            fields=["name", "message", "custom_opt_in"]
        )

        # Track if customer should be opted in
        should_opt_in = False

        for msg in messages:
            # Link customer to message
            frappe.db.set_value(
                "Whatsapp Message",
                msg.name,
                "customer",
                doc.name,
                update_modified=False
            )

            # Check if any message has opt-in checked
            if msg.get("custom_opt_in"):
                should_opt_in = True
            
            # Also check message text for opt-in phrase (legacy messages)
            if not should_opt_in and "exclusive deals" in normalize_text(msg.get("message", "")):
                should_opt_in = True

        # Update customer opt-in if needed
        if should_opt_in and not doc.custom_opt_in:
            frappe.db.set_value(
                "Customer",
                doc.name,
                "custom_opt_in",
                1,
                update_modified=False
            )
            wa_log("Customer Opt-In Set", f"Customer {doc.name} opted in based on message history")

        frappe.db.commit()
        
        # Emit event for updated messages
        if messages:
            emit_whatsapp_event("whatsapp_customer_linked", {
                "customer": doc.name,
                "whatsapp_number": doc.whatsapp_number,
                "linked_messages": len(messages),
                "opted_in": should_opt_in
            })

    except Exception:
        wa_log("Customer Link Error", frappe.get_traceback())
