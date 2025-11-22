import frappe
import json
import hashlib

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
        frappe.log_error(
            title="WhatsApp Webhook Error",
            message=frappe.get_traceback()
        )
        return {"status": "error", "message": str(e)}


def handle_verification():
    """Handle GET request for webhook verification"""
    mode = frappe.request.args.get("hub.mode")
    token = frappe.request.args.get("hub.verify_token")
    challenge = frappe.request.args.get("hub.challenge")
    
    VERIFY_TOKEN = frappe.db.get_single_value("Whatsapp Setting", "webhook_verify_token")
    
    if mode == "subscribe" and token == VERIFY_TOKEN:
        frappe.response['type'] = 'page'
        frappe.response['message'] = challenge
        return challenge
    else:
        frappe.throw("Forbidden - Invalid verify token", frappe.PermissionError)


def handle_webhook_data():
    """Handle POST request with webhook data"""
    raw = frappe.local.request.get_data(as_text=True)
    
    # Check for duplicate
    if is_duplicate_webhook(raw):
        return {"status": "received"}
    
    if not raw:
        return {"status": "received"}
    
    try:
        payload = json.loads(raw)
        process_whatsapp_message(payload)
        return {"status": "received"}
        
    except json.JSONDecodeError as e:
        frappe.log_error(
            title="WhatsApp Webhook - JSON Parse Error",
            message=f"Error: {str(e)}\nRaw data: {raw}"
        )
        return {"status": "received"}
    
    except Exception as e:
        frappe.log_error(
            title="WhatsApp Webhook - Processing Error",
            message=frappe.get_traceback()
        )
        return {"status": "received"}


def process_whatsapp_message(payload):
    """Process WhatsApp message payload"""
    try:
        if payload.get("object") == "whatsapp_business_account":
            entries = payload.get("entry", [])
            
            for entry in entries:
                changes = entry.get("changes", [])
                
                for change in changes:
                    value = change.get("value", {})
                    
                    # Process incoming messages
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
                            media_id = message.get('audio', {}).get('id', '')
                            message_text = "Audio message received"
                        
                        elif msg_type == 'video':
                            media_id = message.get('video', {}).get('id', '')
                            message_text = "Video received"
                        
                        elif msg_type == 'location':
                            loc = message.get('location', {})
                            lat = loc.get('latitude', '')
                            lon = loc.get('longitude', '')
                            message_text = f"Location: {lat}, {lon}"
                        
                        elif msg_type == 'contacts':
                            contacts = message.get('contacts', [])
                            message_text = f"{len(contacts)} contact(s) shared"
                        
                        else:
                            message_text = f"Unknown message type: {msg_type}"
                        
                        # Check for opt-in consent message
                        from_number = message.get("from", "")
                        check_and_update_opt_in(from_number, message_text)
                        
                        # Save to database
                        save_whatsapp_message(message, message_text, media_id)
                    
                    # Process status updates
                    statuses = value.get("statuses", [])
                    for status in statuses:
                        # You can process delivery status here if needed
                        pass
                        
    except Exception as e:
        frappe.log_error(
            title="WhatsApp Message Processing Error",
            message=frappe.get_traceback()
        )
        raise


def save_whatsapp_message(message, message_text, media_id=""):
    """Save incoming WhatsApp message to database"""
    try:
        from_number = message.get("from", "")
        timestamp_unix = message.get("timestamp", "")
        
        # Convert Unix timestamp to time
        from datetime import datetime
        if timestamp_unix:
            dt = datetime.fromtimestamp(int(timestamp_unix))
            timestamp_str = dt.strftime("%H:%M:%S")
        else:
            timestamp_str = frappe.utils.now_datetime().strftime("%H:%M:%S")
        
        # Find customer by WhatsApp number
        customer_name = find_customer_by_whatsapp(from_number)
        
        # Create Whatsapp Message document
        doc = frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": from_number,
            "message_type": message.get("type", ""),
            "message": message_text,
            "media_id": media_id,
            "timestamp": timestamp_str,
            "customer": customer_name
        })
        
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
        return doc.name
        
    except Exception as e:
        frappe.log_error(
            title="WhatsApp Message Save Failed",
            message=f"Error: {str(e)}\nMessage: {json.dumps(message, indent=2)}"
        )
        raise


def find_customer_by_whatsapp(whatsapp_number):
    """Find customer by WhatsApp number"""
    if not whatsapp_number:
        return None
    
    try:
        # Clean the number
        clean_number = ''.join(filter(str.isdigit, whatsapp_number))
        
        # Try exact match
        customer = frappe.db.get_value("Customer", {"whatsapp_number": clean_number}, "name")
        if customer:
            return customer
        
        # Try with leading 0 (local format)
        if clean_number.startswith("256") and len(clean_number) == 12:
            local_format = "0" + clean_number[3:]
            customer = frappe.db.get_value("Customer", {"whatsapp_number": local_format}, "name")
            if customer:
                return customer
        
        # Try international format
        if clean_number.startswith("0") and len(clean_number) == 10:
            intl_format = "256" + clean_number[1:]
            customer = frappe.db.get_value("Customer", {"whatsapp_number": intl_format}, "name")
            if customer:
                return customer
        
        # Try without country code
        if len(clean_number) == 12:
            short_format = clean_number[-9:]
            customer = frappe.db.get_value("Customer", {"whatsapp_number": short_format}, "name")
            if customer:
                return customer
        
        return None
        
    except Exception as e:
        frappe.log_error(
            title="Customer Lookup Failed",
            message=f"Error: {str(e)}\nNumber: {whatsapp_number}"
        )
        return None


def is_duplicate_webhook(raw_data):
    """Check if webhook has already been processed"""
    global webhook_cache
    
    webhook_hash = hashlib.md5(raw_data.encode()).hexdigest()
    
    if webhook_hash in webhook_cache:
        return True
    
    webhook_cache.append(webhook_hash)
    
    if len(webhook_cache) > MAX_CACHE_SIZE:
        webhook_cache.pop(0)
    
    return False


def check_and_update_opt_in(whatsapp_number, message_text):
    """
    Check if message contains opt-in consent and update customer
    """
    if not whatsapp_number or not message_text:
        return
    
    # List of opt-in trigger phrases (case-insensitive)
    opt_in_phrases = [
        "i want to receive updates",
        "yes",
        "opt in",
        "opt-in",
        "subscribe",
        "agree",
        "accept"
    ]
    
    # Check if message contains any opt-in phrase
    message_lower = message_text.lower().strip()
    is_opt_in = any(phrase in message_lower for phrase in opt_in_phrases)
    
    if not is_opt_in:
        return
    
    try:
        # Find customer by WhatsApp number
        customer_name = find_customer_by_whatsapp(whatsapp_number)
        
        if not customer_name:
            frappe.log_error(
                title="Opt-in Failed - Customer Not Found",
                message=f"WhatsApp number: {whatsapp_number}\nMessage: {message_text}"
            )
            return
        
        # Get customer document
        customer = frappe.get_doc("Customer", customer_name)
        
        # Check if already opted in
        if customer.get("custom_opt_in"):
            return  # Already opted in
        
        # Update opt-in status
        customer.custom_opt_in = 1
        customer.save(ignore_permissions=True)
        frappe.db.commit()
        
        # Log success
        frappe.log_error(
            title="Customer Opted In Successfully",
            message=f"Customer: {customer_name}\nWhatsApp: {whatsapp_number}\nMessage: {message_text}"
        )
        
    except Exception as e:
        frappe.log_error(
            title="Opt-in Update Failed",
            message=f"Error: {str(e)}\nWhatsApp: {whatsapp_number}\nMessage: {message_text}"
        )