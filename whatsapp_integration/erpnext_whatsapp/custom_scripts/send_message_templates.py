import frappe
import json
import requests
import re
import os
from frappe import _


@frappe.whitelist()
def send_whatsapp_template_message(phone, template_name, parameters=None, customer=None, document_url=None):
    """
    Send WhatsApp template message
    
    Args:
        phone: Phone number (with country code, e.g., +256...)
        template_name: Name of approved WhatsApp template
        parameters: Dict of parameter values {"amount": "UGX 20,000", "text": "INV-001"}
        customer: Customer name for logging
        document_url: URL of document to attach in header (optional)
    """
    
    # Load WhatsApp settings
    settings = frappe.get_single("Whatsapp Setting")
    ACCESS_TOKEN = settings.get_password("access_token") or settings.get("access_token")
    PHONE_NUMBER_ID = settings.get("phone_number_id")
    
    if not ACCESS_TOKEN or not PHONE_NUMBER_ID:
        frappe.throw("Missing Access Token or Phone Number ID in WhatsApp Settings")
    
    # Load template to get component structure
    template = frappe.db.get_value(
        "Whatsapp Message Template",
        {"template_name": template_name},
        ["name", "template_name", "status", "language", "format", "body_text", "media_example", "footer_text"],
        as_dict=1
    )
    
    if not template:
        frappe.throw(f"Template '{template_name}' not found")
    
    if template.status != "Approved":
        frappe.throw(f"Template '{template_name}' is not approved yet. Status: {template.status}")
    
    # Clean phone number and format properly
    phone = phone.strip().replace(" ", "").replace("-", "")
    
    # Remove leading + if present
    if phone.startswith("+"):
        phone = phone[1:]
    
    # Remove leading 0 if present (e.g., 0726773735 -> 726773735)
    if phone.startswith("0"):
        phone = phone[1:]
    
    # Add country code if not present (assume Uganda 256)
    if not phone.startswith("256"):
        phone = "256" + phone
    
    # Build components array
    components = []
    
    # HEADER component - Upload PDF to WhatsApp Cloud and get media ID
    header_type = (template.format or "").lower()
    if header_type in ["image", "video", "documentation"] and document_url:
        format_map = {
            "image": "image",
            "video": "video",
            "documentation": "document"
        }
        
        media_id = None
        
        try:
            # Get WhatsApp settings
            settings = frappe.get_single("Whatsapp Setting")
            ACCESS_TOKEN = settings.get_password("access_token") or settings.get("access_token")
            PHONE_NUMBER_ID = settings.get("phone_number_id")
            
            # Get file from server
            file_doc = frappe.get_doc("File", {"file_url": document_url})
            file_path = frappe.get_site_path("public", file_doc.file_url.lstrip("/"))
            
            if not os.path.exists(file_path):
                frappe.throw(f"File not found on server: {file_path}")
            
            import mimetypes
            mime_type = mimetypes.guess_type(file_doc.file_name)[0] or "application/pdf"
            
            # Use a descriptive filename for WhatsApp
            display_filename = file_doc.file_name
            
            # Upload to WhatsApp Cloud Media endpoint
            upload_url = f"https://graph.facebook.com/v24.0/{PHONE_NUMBER_ID}/media"
            
            with open(file_path, "rb") as f:
                files = {
                    'file': (display_filename, f, mime_type)
                }
                data = {
                    'messaging_product': 'whatsapp',
                    'type': mime_type
                }
                
                upload_response = requests.post(
                    upload_url,
                    files=files,
                    data=data,
                    headers={"Authorization": f"Bearer {ACCESS_TOKEN}"},
                    timeout=60
                )
            
            upload_result = upload_response.json()
            
            media_id = upload_result.get("id")
            
            if not media_id:
                error_msg = upload_result.get("error", {}).get("message", str(upload_result))
                frappe.log_error(f"Failed to upload media: {error_msg}\n\nResponse: {json.dumps(upload_result, indent=2)}", "WhatsApp Media Upload")
                frappe.throw(f"Failed to upload media to WhatsApp: {error_msg}")
            
            # Add header component with media ID and filename
            components.append({
                "type": "header",
                "parameters": [
                    {
                        "type": format_map[header_type],
                        format_map[header_type]: {
                            "id": media_id,
                            "filename": display_filename  # Add filename for proper display
                        }
                    }
                ]
            })
            
        except requests.exceptions.RequestException as e:
            frappe.log_error(f"Network error uploading to WhatsApp: {str(e)}", "WhatsApp Network Error")
            frappe.throw(f"Network error - {str(e)}")
            
        except Exception as e:
            frappe.log_error(f"Failed to upload media to WhatsApp: {str(e)}", "WhatsApp Media Upload")
            frappe.throw(f"Failed to upload document - {str(e)}")
    
    # BODY component with NAMED parameters
    if parameters and template.body_text:
        body_params = []
        
        # Extract parameter order from template body text
        param_matches = re.findall(r"\{\{([^}]+)\}\}", template.body_text)
        
        for param_name in param_matches:
            param_key = param_name.strip()
            if param_key in parameters:
                # For NAMED parameters, include parameter_name
                body_params.append({
                    "type": "text",
                    "parameter_name": param_key,
                    "text": str(parameters[param_key])
                })
            else:
                frappe.throw(f"Missing parameter value for: {param_key}")
        
        if body_params:
            components.append({
                "type": "body",
                "parameters": body_params
            })
    
    # Build message payload
    template_code = template.template_name.lower().replace(" ", "_")
    template_code = re.sub(r"[^a-z0-9_]", "_", template_code)
    
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": template_code,
            "language": {
                "code": template.language or "en_US"
            }
        }
    }
    
    if components:
        payload["template"]["components"] = components
    
    # Send message
    url = f"https://graph.facebook.com/v24.0/{PHONE_NUMBER_ID}/messages"
    
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        result = response.json()
        
        # Log the message in existing Whatsapp Message doctype
        if response.status_code == 200 and result.get("messages"):
            message_id = result["messages"][0]["id"]
            
            # Build message text for logging
            message_text = template.body_text
            if parameters:
                for key, value in parameters.items():
                    message_text = message_text.replace(f"{{{{{key}}}}}", str(value))
            
            # Add footer text if exists
            if template.footer_text:
                message_text += f"\n\n{template.footer_text}"
            
            # Create log entry with document if it's a template with header
            log_data = {
                "doctype": "Whatsapp Message",
                "from_number": phone,  # Customer's phone number, not business phone ID
                "message_type": "template",
                "custom_status": "Outgoing",
                "message": message_text,
                "message_status": "sent",
                "message_id": message_id,
                "timestamp": frappe.utils.now_datetime().strftime("%H:%M:%S"),
                "customer": customer
            }
            
            # If template has document header, add the document to log
            if document_url and header_type == "documentation":
                log_data["custom_document"] = document_url
            
            log = frappe.get_doc(log_data)
            log.insert(ignore_permissions=True)
            frappe.db.commit()
            
            return {"success": True, "message_id": message_id}
        else:
            error_msg = result.get("error", {}).get("message", str(result))
            frappe.log_error(f"WhatsApp Send Error: {error_msg}\n\nPayload: {json.dumps(payload, indent=2)}\n\nResponse: {json.dumps(result, indent=2)}", "WhatsApp Template Send")
            return {"success": False, "error": error_msg}
            
    except Exception as e:
        frappe.log_error(f"WhatsApp Send Exception: {str(e)}\n\nPayload: {json.dumps(payload, indent=2)}", "WhatsApp Template Send")
        return {"success": False, "error": str(e)}


def send_payment_whatsapp_async(doc_name):
    """
    Background job to send WhatsApp message for payment entry
    This runs asynchronously and doesn't block the submission
    """
    try:
        doc = frappe.get_doc("Payment Entry", doc_name)
        
        # Get customer's phone number
        customer = frappe.get_doc("Customer", doc.party)
        phone = customer.whatsapp_number
        
        if not phone:
            frappe.log_error(f"No WhatsApp number found for {customer.customer_name}", "Payment Entry WhatsApp")
            return
        
        # Get template name
        template_name = "payment_confirmations"
        
        # Check if template exists and is approved
        template_exists = frappe.db.exists("Whatsapp Message Template", {
            "template_name": template_name,
            "status": "Approved"
        })
        
        if not template_exists:
            frappe.log_error(f"Template '{template_name}' not found or not approved", "Payment Entry WhatsApp")
            return
        
        # Prepare parameters
        reference_text = doc.name
        if doc.references and len(doc.references) > 0:
            reference_text = doc.references[0].reference_name
        
        amount_str = doc.get_formatted("paid_amount")
        
        parameters = {
            "amount": amount_str,
            "text": reference_text
        }
        
        # Generate PDF from Payment Entry and save it as a public file
        document_url = None
        
        try:
            # Get PDF content using default print format
            pdf_content = frappe.get_print(
                doctype="Payment Entry",
                name=doc.name,
                as_pdf=True,
                letterhead=doc.letter_head
            )
            
            # Save PDF as a public file with proper naming
            filename = f"Payment-{doc.name}.pdf"
            
            file_doc = frappe.get_doc({
                "doctype": "File",
                "file_name": filename,
                "folder": "Home",
                "is_private": 0,
                "content": pdf_content,
                "attached_to_doctype": "Payment Entry",
                "attached_to_name": doc.name
            })
            file_doc.insert(ignore_permissions=True)
            frappe.db.commit()
            
            document_url = file_doc.file_url
            
        except Exception as e:
            frappe.log_error(f"Failed to generate PDF: {str(e)}", "Payment Entry PDF Generation")
            # Continue without PDF
        
        # Send WhatsApp message
        result = send_whatsapp_template_message(
            phone=phone,
            template_name=template_name,
            parameters=parameters,
            customer=doc.party,
            document_url=document_url
        )
        
        if result.get("success"):
            frappe.log_error(f"WhatsApp payment confirmation sent successfully to {customer.customer_name} for {doc.name}", "Payment Entry WhatsApp Success")
        else:
            frappe.log_error(f"Failed to send WhatsApp: {result.get('error')}", "Payment Entry WhatsApp")
            
    except Exception as e:
        frappe.log_error(f"WhatsApp Send Failed: {str(e)}", "Payment Entry WhatsApp")


def on_payment_entry_submit(doc, method):
    """
    Enqueue WhatsApp template sending when Payment Entry is submitted
    This does NOT block submission - message is sent in background
    
    Hook this in hooks.py:
    doc_events = {
        "Payment Entry": {
            "on_submit": "your_app.whatsapp.send_template.on_payment_entry_submit"
        }
    }
    """
    
    # Only send for customer payments
    if doc.party_type != "Customer":
        return
    
    # Quick validation before enqueuing
    customer = frappe.get_doc("Customer", doc.party)
    phone = customer.whatsapp_number
    
    if not phone:
        frappe.msgprint(
            _("No WhatsApp number found for {0}. Message will not be sent.").format(customer.customer_name),
            indicator="orange",
            alert=True
        )
        return
    
    # Check if template exists
    template_exists = frappe.db.exists("Whatsapp Message Template", {
        "template_name": "payment_confirmations",
        "status": "Approved"
    })
    
    if not template_exists:
        frappe.msgprint(
            _("WhatsApp template 'payment_confirmations' not found or not approved. Message will not be sent."),
            indicator="orange",
            alert=True
        )
        return
    
    # Enqueue the job to run in background
    frappe.enqueue(
        send_payment_whatsapp_async,
        doc_name=doc.name,
        queue='default',
        timeout=300,
        is_async=True,
        now=False
    )
    
    frappe.msgprint(
        _("Payment Entry submitted. WhatsApp message will be sent shortly."),
        indicator="blue",
        alert=True
    )