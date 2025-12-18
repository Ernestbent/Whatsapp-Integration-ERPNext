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


## Message Status Handler
def handle_message_status(status):
    try:
        msg_id = status.get("id")
        new_status = status.get("status")

        if not msg_id or not new_status:
            return

        msg_name = frappe.db.get_value(
            "Whatsapp Message",
            {"message_id": msg_id},
            "name"
        )

        if not msg_name:
            return

        frappe.db.set_value(
            "Whatsapp Message",
            msg_name,
            "message_status",
            new_status,
            update_modified=False
        )
        frappe.db.commit()

    except Exception:
        wa_log("Status Update Error", frappe.get_traceback())


## Single Message Handler
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
        else:
            message_text = f"Received {msg_type}"

        customer = find_customer_by_whatsapp(from_number)

        save_whatsapp_message(
            message=message,
            message_text=message_text,
            media_id=media_id,
            public_file_url=public_file_url,
            customer=customer,
            msg_id=msg_id
        )

        check_and_update_opt_in(from_number, message_text)

    except Exception:
        wa_log("Message Processing Error", frappe.get_traceback())


## Save Message
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

    except Exception:
        wa_log("Save Message Failed", frappe.get_traceback())


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

    except Exception:
        wa_log("Customer Link Error", frappe.get_traceback())
