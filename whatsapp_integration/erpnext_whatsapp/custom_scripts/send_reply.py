import frappe
import requests
import base64
import mimetypes
import os
from datetime import datetime

from whatsapp_integration.erpnext_whatsapp.custom_scripts.reaction_state import update_message_reaction


CHAT_ROLES = ("CRM", "System Manager")
SUPPORTED_REACTIONS = {"", "👍", "❤️", "😂", "😮", "😢", "🙏"}


def _get_reply_metadata(reply_to_message_id):
    """Return the local quote information for a WhatsApp context message."""
    if not reply_to_message_id:
        return {}

    original = frappe.db.get_value(
        "Whatsapp Message",
        {"message_id": reply_to_message_id},
        ["name", "message", "custom_status", "customer", "from_number"],
        as_dict=True,
    )
    if not original:
        return {}

    sender = "You" if original.custom_status != "Incoming" else (
        original.customer or original.from_number or "Contact"
    )
    return {
        "custom_reply_to_name": original.name,
        "custom_reply_to_sender": sender,
        "custom_reply_to_text": (original.message or "Attachment")[:240],
    }


## Real-time Event Emitter for Send Reply
def emit_whatsapp_send_event(
    to_number,
    message_id,
    doc_name,
    message_type="text",
    media_url=None,
    preview_text=None,
    message_status="pending"
):
    """
    Emit real-time events when sending messages
    """
    try:
        # Get customer info
        customer = frappe.db.get_value("Customer", 
            {"whatsapp_number": ["like", f"%{to_number[-9:]}%"]}, 
            "name") or ""
        
        # Emit new message event
        frappe.publish_realtime(
            event="whatsapp_new_message",
            message={
                "contact_number": to_number,
                "message_name": doc_name,
                "message_id": message_id,
                "message_type": "outgoing",
                "whatsapp_type": message_type,
                "message_text": preview_text or "",
                "customer": customer,
                "media_url": media_url,
                "message_status": message_status,
                "timestamp": datetime.now().isoformat(),
                "action": "new_outgoing_message"
            },
            user=None,
            after_commit=True
        )
        
        # Log for debugging
        frappe.log_error(
            title="WhatsApp Send Event Emitted",
            message=f"To: {to_number}, Message ID: {message_id}, Doc: {doc_name}"
        )
        
    except Exception as e:
        frappe.log_error("Send Event Error", str(e))


@frappe.whitelist()
def send_whatsapp_reply(to_number, message_body, reply_to_message_id=None):
    # Get credentials from Whatsapp Setting
    settings = frappe.get_single("Whatsapp Setting")
    phone_id = settings.get("phone_number_id")
    token = settings.get("access_token")
    version = settings.get("app_version") or "v24.0"

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
        current_time = now.strftime("%H:%M:%S") if hasattr(now, "strftime") else now.split(" ")[-1][:8]

        # Get customer
        customer = frappe.db.get_value("Customer", 
            {"whatsapp_number": ["like", f"%{to_number[-9:]}%"]}, 
            "name") or ""

        # SAVE AS OUTGOING WITH MESSAGE_ID
        doc_data = {
            "doctype": "Whatsapp Message",
            "from_number": to_number,
            "message": message_body,
            "message_type": "text",
            "timestamp": current_time,
            "customer": customer,
            "custom_status": "Outgoing",
            "message_status": "pending",
            "message_id": sent_msg_id  # CRITICAL: Save WhatsApp message ID
        }
        doc_data.update(_get_reply_metadata(reply_to_message_id))
        doc = frappe.get_doc(doc_data)
        doc.insert(ignore_permissions=True)
        frappe.db.commit()

        # ✅ EMIT REAL-TIME EVENT
        emit_whatsapp_send_event(
            to_number=to_number,
            message_id=sent_msg_id,
            doc_name=doc.name,
            message_type="text",
            preview_text=message_body,
            message_status="pending"
        )

        return {"success": True, "message_id": sent_msg_id, "doc_name": doc.name}

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
def send_whatsapp_reaction(message_id, emoji=""):
    """React to an incoming WhatsApp message, or remove our reaction."""
    frappe.only_for(CHAT_ROLES)
    message_id = str(message_id or "").strip()
    emoji = str(emoji or "")
    if not message_id:
        return {"success": False, "error": "A WhatsApp message ID is required"}
    if emoji not in SUPPORTED_REACTIONS:
        return {"success": False, "error": "Unsupported reaction"}

    targets = frappe.get_all(
        "Whatsapp Message",
        filters={"message_id": message_id},
        fields=["name", "custom_status", "from_number"],
        limit_page_length=2,
    )
    if not targets:
        return {"success": False, "error": "Message not found"}
    if len(targets) != 1:
        frappe.log_error(
            title="Duplicate WhatsApp Message ID",
            message=f"Cannot attach reaction: {message_id} matches multiple records.",
        )
        return {"success": False, "error": "Message ID is not unique"}

    target = targets[0]
    if target.custom_status != "Incoming":
        return {"success": False, "error": "Only incoming messages can be reacted to"}

    settings = frappe.get_single("Whatsapp Setting")
    phone_id = settings.get("phone_number_id")
    token = settings.get("access_token")
    version = settings.get("app_version") or "v24.0"
    if not phone_id or not token:
        return {"success": False, "error": "Missing Phone Number ID or Access Token"}

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": target.from_number,
        "type": "reaction",
        "reaction": {"message_id": message_id, "emoji": emoji or ""},
    }

    try:
        response = requests.post(
            f"https://graph.facebook.com/{version}/{phone_id}/messages",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        response.raise_for_status()
        update_message_reaction(target.name, "me", emoji)
        frappe.publish_realtime(
            event="whatsapp_message_reaction_changed",
            message={
                "message_name": target.name,
                "contact_number": target.from_number,
                "emoji": emoji,
                "from": "me",
            },
            user=None,
            after_commit=True,
        )
        frappe.db.commit()
        return {"success": True}
    except Exception as exc:
        error_message = str(exc)
        try:
            error_message = response.json().get("error", {}).get("message") or error_message
        except Exception:
            pass
        frappe.log_error(title="WhatsApp Reaction Failed", message=error_message)
        return {"success": False, "error": error_message}


@frappe.whitelist()
def send_notification_message(to_number, message_body, customer_name=None):
    """
    Send WhatsApp notification message (for automated notifications)
    This is a wrapper around send_whatsapp_reply specifically for notifications
    """
    return send_whatsapp_reply(to_number, message_body, reply_to_message_id=None)


@frappe.whitelist()
def send_whatsapp_attachment(to_number, file_data=None, filename=None, file_type=None, url=None, caption=None):
    """
    Send WhatsApp attachment (image, video, document, audio)
    """
    settings = frappe.get_single("Whatsapp Setting")
    phone_id = settings.get("phone_number_id")
    token = settings.get("access_token")
    version = settings.get("app_version") or "v24.0"

    if not phone_id or not token:
        return {"success": False, "error": "Missing Phone Number ID or Access Token"}

    local_file_url = None  # Will hold the local public file URL for preview

    if file_data:
        try:
            binary_data = base64.b64decode(file_data)
        except Exception as e:
            return {"success": False, "error": f"Invalid file data: {str(e)}"}

        # --- Save file locally first (public) for consistent preview ---
        if not filename:
            filename = "attachment"

        # Ensure proper extension
        extension = os.path.splitext(filename)[1].lower().lstrip('.')
        if not extension and file_type:
            extension_map = {
                'application/pdf': 'pdf',
                'image/jpeg': 'jpg',
                'image/png': 'png',
                'image/gif': 'gif',
                'image/webp': 'webp',
                'video/mp4': 'mp4',
                'audio/mp3': 'mp3',
                'audio/ogg': 'ogg',
            }
            extension = extension_map.get(file_type, 'bin')

        if extension and '.' not in filename:
            filename = f"{filename}.{extension}"

        try:
            file_doc = frappe.get_doc({
                "doctype": "File",
                "file_name": filename,
                "folder": "Home",  # Organized folder
                "is_private": 0,  # Set to public for direct access
                "content": binary_data
            })
            file_doc.insert(ignore_permissions=True)
            frappe.db.commit()
            local_file_url = file_doc.file_url
        except Exception as e:
            frappe.log_error(f"Failed to save local file: {str(e)}", "WhatsApp Local File Save")

        # Upload to WhatsApp 
        upload_url = f"https://graph.facebook.com/{version}/{phone_id}/media"

        files = {
            'file': (filename, binary_data, file_type)
        }
        data = {
            'messaging_product': 'whatsapp',
            'type': file_type
        }

        try:
            upload_response = requests.post(
                upload_url,
                files=files,
                data=data,
                headers={"Authorization": f"Bearer {token}"},
                timeout=60
            )
            upload_response.raise_for_status()
            media_id = upload_response.json().get("id")

            if not media_id:
                return {"success": False, "error": "Failed to get media ID from upload"}

            return send_whatsapp_media_message(
                to_number=to_number,
                media_id=media_id,
                filename=filename,
                file_type=file_type,
                caption=caption,
                settings=settings,
                local_file_url=local_file_url
            )

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
        return send_whatsapp_attachment_by_url(
            to_number, url, filename, file_type, caption, settings
        )
    else:
        return {"success": False, "error": "Either file_data or url must be provided"}


def send_whatsapp_media_message(to_number, media_id, filename, file_type, caption, settings, local_file_url=None):
    """Send a media message using media ID"""
    phone_id = settings.get("phone_number_id")
    token = settings.get("access_token")
    version = settings.get("app_version") or "v24.0"
    url = f"https://graph.facebook.com/{version}/{phone_id}/messages"

    # Determine message type
    if file_type.startswith('image/'):
        msg_type = "image"
    elif file_type.startswith('video/'):
        msg_type = "video"
    elif file_type.startswith('audio/'):
        msg_type = "audio"
    else:
        msg_type = "document"

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_number,
        "type": msg_type,
        msg_type: {
            "id": media_id
        }
    }

    if caption and msg_type in ["image", "video", "document"]:
        payload[msg_type]["caption"] = caption
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

        now = frappe.utils.now()
        current_time = now.strftime("%H:%M:%S") if hasattr(now, "strftime") else now.split(" ")[-1][:8]

        # Get customer
        customer = frappe.db.get_value("Customer", 
            {"whatsapp_number": ["like", f"%{to_number[-9:]}%"]}, 
            "name") or ""

        # Save with local_file_url for preview AND message_id
        doc = frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": to_number,
            "message": caption or f"{filename or 'attachment'}",
            "message_type": msg_type,
            "timestamp": current_time,
            "custom_document": local_file_url or "Attachment",
            "customer": customer,
            "custom_status": "Outgoing",
            "message_status": "pending",
            "message_id": sent_msg_id  # Save WhatsApp message ID
        })
        doc.insert(ignore_permissions=True)
        frappe.db.commit()

        # ✅ EMIT REAL-TIME EVENT
        emit_whatsapp_send_event(
            to_number=to_number,
            message_id=sent_msg_id,
            doc_name=doc.name,
            message_type=msg_type,
            media_url=local_file_url,
            preview_text=caption or filename or msg_type,
            message_status="pending"
        )

        return {"success": True, "message_id": sent_msg_id, "doc_name": doc.name}

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
    """Send attachment using direct URL (fallback)"""
    phone_id = settings.get("phone_number_id")
    token = settings.get("access_token")
    version = settings.get("app_version") or "v24.0"
    url = f"https://graph.facebook.com/{version}/{phone_id}/messages"

    if file_type.startswith('image/'):
        msg_type = "image"
    elif file_type.startswith('video/'):
        msg_type = "video"
    elif file_type.startswith('audio/'):
        msg_type = "audio"
    else:
        msg_type = "document"

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_number,
        "type": msg_type,
        msg_type: {
            "link": file_url
        }
    }

    if caption and msg_type in ["image", "video", "document"]:
        payload[msg_type]["caption"] = caption
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

        now = frappe.utils.now()
        current_time = now.strftime("%H:%M:%S") if hasattr(now, "strftime") else now.split(" ")[-1][:8]

        # Get customer
        customer = frappe.db.get_value("Customer", 
            {"whatsapp_number": ["like", f"%{to_number[-9:]}%"]}, 
            "name") or ""

        doc = frappe.get_doc({
            "doctype": "Whatsapp Message",
            "from_number": to_number,
            "message": caption or f"{filename or 'attachment'}",
            "message_type": msg_type,
            "timestamp": current_time,
            "custom_document": file_url,  # fall back to original url
            "customer": customer,
            "custom_status": "Outgoing",
            "message_status": "pending",
            "message_id": sent_msg_id  # Save WhatsApp message ID
        })
        doc.insert(ignore_permissions=True)
        frappe.db.commit()

        # ✅ EMIT REAL-TIME EVENT
        emit_whatsapp_send_event(
            to_number=to_number,
            message_id=sent_msg_id,
            doc_name=doc.name,
            message_type=msg_type,
            media_url=file_url,
            preview_text=caption or filename or msg_type,
            message_status="pending"
        )

        return {"success": True, "message_id": sent_msg_id, "doc_name": doc.name}

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


## Test Real-time Events
@frappe.whitelist()
def test_realtime_event(contact_number):
    """
    Test real-time event emission
    """
    try:
        emit_whatsapp_send_event(
            to_number=contact_number,
            message_id=f"test_{datetime.now().timestamp()}",
            doc_name=f"TEST_{datetime.now().timestamp()}",
            message_type="text",
            preview_text="Realtime test message",
            message_status="pending"
        )
        
        return {"success": True, "message": "Test event sent"}
    except Exception as e:
        return {"success": False, "error": str(e)}
