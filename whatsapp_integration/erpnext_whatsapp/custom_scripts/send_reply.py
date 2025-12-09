# File: whatsapp_integration/erpnext_whatsapp/custom_scripts/send_reply.py
import frappe
import requests
import base64
import mimetypes
from urllib.parse import urlparse
import os

@frappe.whitelist()
def send_whatsapp_reply(to_number, message_body, reply_to_message_id=None):
    # Get credentials from Whatsapp Setting
    settings = frappe.get_single("Whatsapp Setting")
    phone_id = settings.get("phone_number_id")
    token = settings.get("access_token")
    version = settings.get("api_version", "v24.0")

    if not phone_id or not token:
        return {"success": False, "error": "Missing Phone Number ID or Access Token"}

    url = f"https://graph.facebook.com/{version}/{phone_id}/messages"

    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": message_body}
    }
    if reply_to_message_id:
        payload["context"] = {"message_id": reply_to_message_id}

    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        sent_msg_id = result["messages"][0]["id"]

        # Get current time safely
        now = frappe.utils.now()
        if isinstance(now, str):
            current_time = now.split(" ")[-1][:8]
        else:
            current_time = now.strftime("%H:%M:%S")

        # SAVE AS OUTGOING — AUTOMATICALLY
        frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": to_number,
            "message": message_body,
            "message_type": "text",
            "timestamp": current_time,
            "customer": frappe.db.get_value("Customer", {"whatsapp_number": ["like", f"%{to_number[-9:]}%"]}, "name") or "",
            "custom_status": "Outgoing"   # OUTGOING BY DEFAULT WHEN YOU SEND
        }).insert(ignore_permissions=True)

        return {"success": True, "message_id": sent_msg_id}

    except Exception as e:
        error_msg = str(e)
        try:
            error_detail = response.json().get("error", {}).get("message", "")
            if error_detail:
                error_msg = error_detail
        except:
            pass

        frappe.log_error(
            title="WhatsApp Send Failed",
            message=f"To: {to_number}\nError: {error_msg}"
        )
        return {"success": False, "error": error_msg}


@frappe.whitelist()
def send_whatsapp_attachment(to_number, file_data=None, filename=None, file_type=None, url=None, caption=None):
    """
    Send WhatsApp attachment (image, video, document, audio)
    
    Parameters:
    - to_number: recipient phone number
    - file_data: base64 encoded file data (alternative to url)
    - filename: name of the file
    - file_type: MIME type of the file
    - url: direct URL to the file (alternative to file_data)
    - caption: optional caption for the file
    """
    
    # Get credentials from Whatsapp Setting
    settings = frappe.get_single("Whatsapp Setting")
    phone_id = settings.get("phone_number_id")
    token = settings.get("access_token")
    version = settings.get("api_version", "v24.0")

    if not phone_id or not token:
        return {"success": False, "error": "Missing Phone Number ID or Access Token"}

    # Determine file type and WhatsApp message type
    if file_data:
        # Decode base64 data
        try:
            binary_data = base64.b64decode(file_data)
        except Exception as e:
            return {"success": False, "error": f"Invalid file data: {str(e)}"}
        
        # Get file extension from filename or determine from MIME type
        if filename:
            extension = os.path.splitext(filename)[1].lower().lstrip('.')
        elif file_type:
            # Try to guess extension from MIME type
            extension = mimetypes.guess_extension(file_type) or ''
            if extension:
                extension = extension.lstrip('.')
        else:
            extension = ''
        
        # Upload file to WhatsApp servers first
        upload_url = f"https://graph.facebook.com/{version}/{phone_id}/media"
        
        # Prepare file upload
        files = {
            'file': (filename or f"attachment.{extension}", binary_data, file_type),
            'messaging_product': (None, 'whatsapp'),
            'type': (None, file_type)
        }
        
        try:
            # Upload file
            upload_response = requests.post(
                upload_url,
                files=files,
                headers={"Authorization": f"Bearer {token}"},
                timeout=60
            )
            upload_response.raise_for_status()
            media_id = upload_response.json().get("id")
            
            if not media_id:
                return {"success": False, "error": "Failed to get media ID from upload"}
            
            # Now send the media message
            return send_whatsapp_media_message(to_number, media_id, filename, file_type, caption, settings)
            
        except Exception as e:
            error_msg = str(e)
            try:
                error_detail = upload_response.json().get("error", {}).get("message", "")
                if error_detail:
                    error_msg = error_detail
            except:
                pass
            
            frappe.log_error(
                title="WhatsApp Attachment Upload Failed",
                message=f"To: {to_number}\nFilename: {filename}\nError: {error_msg}"
            )
            return {"success": False, "error": error_msg}
    
    elif url:
        # Use direct URL method (only for images and documents up to 5MB)
        return send_whatsapp_attachment_by_url(to_number, url, filename, file_type, caption, settings)
    
    else:
        return {"success": False, "error": "Either file_data or url must be provided"}


def send_whatsapp_media_message(to_number, media_id, filename, file_type, caption, settings):
    """Send a media message using media ID"""
    
    phone_id = settings.get("phone_number_id")
    token = settings.get("access_token")
    version = settings.get("api_version", "v24.0")
    
    url = f"https://graph.facebook.com/{version}/{phone_id}/messages"
    
    # Determine WhatsApp message type based on MIME type
    if file_type.startswith('image/'):
        msg_type = "image"
    elif file_type.startswith('video/'):
        msg_type = "video"
    elif file_type.startswith('audio/'):
        msg_type = "audio"
    elif file_type == 'application/pdf':
        msg_type = "document"
    elif file_type.startswith('application/') or file_type.startswith('text/'):
        msg_type = "document"
    else:
        msg_type = "document"
    
    # Prepare payload
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_number,
        "type": msg_type,
        msg_type: {
            "id": media_id
        }
    }
    
    # Add caption if provided
    if caption and msg_type in ["image", "video", "document"]:
        payload[msg_type]["caption"] = caption
    
    # Add filename for documents
    if msg_type == "document" and filename:
        payload[msg_type]["filename"] = filename
    
    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        sent_msg_id = result["messages"][0]["id"]
        
        # Get current time
        now = frappe.utils.now()
        if isinstance(now, str):
            current_time = now.split(" ")[-1][:8]
        else:
            current_time = now.strftime("%H:%M:%S")
        
        # Save to Whatsapp Message doctype
        frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": to_number,
            "message": caption or f"Sent {filename or 'attachment'}",
            "message_type": msg_type,
            "timestamp": current_time,
            "custom_document": filename or "Attachment",
            "customer": frappe.db.get_value("Customer", {"whatsapp_number": ["like", f"%{to_number[-9:]}%"]}, "name") or "",
            "custom_status": "Outgoing"
        }).insert(ignore_permissions=True)
        
        return {"success": True, "message_id": sent_msg_id}
        
    except Exception as e:
        error_msg = str(e)
        try:
            error_detail = response.json().get("error", {}).get("message", "")
            if error_detail:
                error_msg = error_detail
        except:
            pass
        
        frappe.log_error(
            title="WhatsApp Media Send Failed",
            message=f"To: {to_number}\nType: {msg_type}\nError: {error_msg}"
        )
        return {"success": False, "error": error_msg}


def send_whatsapp_attachment_by_url(to_number, file_url, filename, file_type, caption, settings):
    """Send attachment using direct URL (for smaller files)"""
    
    phone_id = settings.get("phone_number_id")
    token = settings.get("access_token")
    version = settings.get("api_version", "v24.0")
    
    url = f"https://graph.facebook.com/{version}/{phone_id}/messages"
    
    # Determine WhatsApp message type based on MIME type
    if file_type.startswith('image/'):
        msg_type = "image"
    elif file_type.startswith('video/'):
        msg_type = "video"
    elif file_type.startswith('audio/'):
        msg_type = "audio"
    elif file_type == 'application/pdf':
        msg_type = "document"
    else:
        msg_type = "document"
    
    # Prepare payload
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_number,
        "type": msg_type,
        msg_type: {
            "link": file_url
        }
    }
    
    # Add caption if provided
    if caption and msg_type in ["image", "video", "document"]:
        payload[msg_type]["caption"] = caption
    
    # Add filename for documents
    if msg_type == "document" and filename:
        payload[msg_type]["filename"] = filename
    
    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        sent_msg_id = result["messages"][0]["id"]
        
        # Get current time
        now = frappe.utils.now()
        if isinstance(now, str):
            current_time = now.split(" ")[-1][:8]
        else:
            current_time = now.strftime("%H:%M:%S")
        
        # Save to Whatsapp Message doctype
        frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": to_number,
            "message": caption or f"Sent {filename or 'attachment'}",
            "message_type": msg_type,
            "timestamp": current_time,
            "custom_document": file_url,
            "customer": frappe.db.get_value("Customer", {"whatsapp_number": ["like", f"%{to_number[-9:]}%"]}, "name") or "",
            "custom_status": "Outgoing"
        }).insert(ignore_permissions=True)
        
        return {"success": True, "message_id": sent_msg_id}
        
    except Exception as e:
        error_msg = str(e)
        try:
            error_detail = response.json().get("error", {}).get("message", "")
            if error_detail:
                error_msg = error_detail
        except:
            pass
        
        frappe.log_error(
            title="WhatsApp URL Attachment Send Failed",
            message=f"To: {to_number}\nURL: {file_url}\nError: {error_msg}"
        )
        return {"success": False, "error": error_msg}


@frappe.whitelist()
def send_whatsapp_template(to_number, template_name, language_code="en", components=None):
    """
    Send WhatsApp template message
    """
    settings = frappe.get_single("Whatsapp Setting")
    phone_id = settings.get("phone_number_id")
    token = settings.get("access_token")
    version = settings.get("api_version", "v24.0")
    
    if not phone_id or not token:
        return {"success": False, "error": "Missing Phone Number ID or Access Token"}
    
    url = f"https://graph.facebook.com/{version}/{phone_id}/messages"
    
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {
                "code": language_code
            }
        }
    }
    
    if components:
        payload["template"]["components"] = components
    
    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        sent_msg_id = result["messages"][0]["id"]
        
        return {"success": True, "message_id": sent_msg_id}
        
    except Exception as e:
        error_msg = str(e)
        try:
            error_detail = response.json().get("error", {}).get("message", "")
            if error_detail:
                error_msg = error_detail
        except:
            pass
        
        frappe.log_error(
            title="WhatsApp Template Send Failed",
            message=f"To: {to_number}\nTemplate: {template_name}\nError: {error_msg}"
        )
        return {"success": False, "error": error_msg}