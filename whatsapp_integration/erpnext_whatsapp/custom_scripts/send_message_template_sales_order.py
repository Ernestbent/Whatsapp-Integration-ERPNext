import frappe
import json
import requests
import re
import os
from frappe import _


def _normalize_template_key(value):
    return (value or "").strip().lower()


def _normalize_phone(value):
    if not value:
        return ""
    return re.sub(r"\D", "", str(value))


def _collect_customer_recipient_numbers(customer_doc):
    numbers = []
    seen = set()

    primary_phone = getattr(customer_doc, "whatsapp_number", None)
    primary_key = _normalize_phone(primary_phone)
    if primary_key and primary_key not in seen:
        numbers.append(str(primary_phone).strip())
        seen.add(primary_key)

    for row in getattr(customer_doc, "custom_contacts", []) or []:
        phone_number = getattr(row, "phone_number", None)
        phone_key = _normalize_phone(phone_number)
        if phone_key and phone_key not in seen:
            numbers.append(str(phone_number).strip())
            seen.add(phone_key)

    return numbers


def _get_approved_template_doc(template_key):
    """
    Resolve template by either `name` or `template_name`, but only approved ones.
    """
    target = _normalize_template_key(template_key)
    if not target:
        return None

    templates = frappe.get_all(
        "Whatsapp Message Template",
        fields=[
            "name",
            "template_name",
            "status",
            "language",
            "format",
            "body_text",
            "media_example",
            "footer_text",
        ],
        filters={"status": ["in", ["Approved", "APPROVED"]]},
        limit_page_length=0,
    )

    for tpl in templates:
        name_key = _normalize_template_key(tpl.get("name"))
        template_name_key = _normalize_template_key(tpl.get("template_name"))
        if target in {name_key, template_name_key}:
            return tpl

    return None


@frappe.whitelist()
def send_whatsapp_template_message(phone, template_name, parameters=None, customer=None, document_url=None):

    # Load WhatsApp settings
    settings = frappe.get_single("Whatsapp Setting")
    ACCESS_TOKEN = settings.get_password("access_token") or settings.get("access_token")
    PHONE_NUMBER_ID = settings.get("phone_number_id")
    
    if not ACCESS_TOKEN or not PHONE_NUMBER_ID:
        frappe.throw("Missing Access Token or Phone Number ID in WhatsApp Settings")
    
    # Load approved template to get component structure
    template = _get_approved_template_doc(template_name)

    if not template:
        frappe.throw(f"Approved template '{template_name}' not found")
    
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
                            "filename": display_filename
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
                "from_number": phone,
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


def send_sales_order_whatsapp_async(doc_name):
    """
    Background job to send WhatsApp message for sales order
    This runs asynchronously and doesn't block the submission
    """
    try:
        doc = frappe.get_doc("Sales Order", doc_name)
        
        customer = frappe.get_doc("Customer", doc.customer)
        recipient_numbers = _collect_customer_recipient_numbers(customer)

        if not recipient_numbers:
            frappe.log_error(
                f"No WhatsApp recipient numbers found for {customer.customer_name}",
                "Sales Order WhatsApp",
            )
            return
        
        # Template name for sales orders
        template_name = "order_confirmationzz"
        
        # Check if template exists and is approved
        template_exists = frappe.db.exists("Whatsapp Message Template", {
            "template_name": template_name,
            "status": "Approved"
        })
        
        if not template_exists:
            frappe.log_error(f"Template '{template_name}' not found or not approved", "Sales Order WhatsApp")
            return
        
        # Prepare parameters based on your template
        # Template body: "Hi {{name}}, Your order has been successfully placed... Your order number is {{text}}."
        parameters = {
            "name": customer.customer_name,
            "text": doc.name  # Sales Order number
        }
        
        # Generate PDF from Sales Order and save it as a public file
        document_url = None
        
        try:
            # Get PDF content using default print format
            pdf_content = frappe.get_print(
                doctype="Sales Order",
                name=doc.name,
                as_pdf=True,
                letterhead=doc.letter_head
            )
            
            # Save PDF as a public file with proper naming
            filename = f"SalesOrder_{doc.name}.pdf"
            
            file_doc = frappe.get_doc({
                "doctype": "File",
                "file_name": filename,
                "folder": "Home",
                "is_private": 0,
                "content": pdf_content,
                "attached_to_doctype": "Sales Order",
                "attached_to_name": doc.name
            })
            file_doc.insert(ignore_permissions=True)
            frappe.db.commit()
            
            document_url = file_doc.file_url
            
        except Exception as e:
            frappe.log_error(f"Failed to generate PDF: {str(e)}", "Sales Order PDF Generation")
            # Continue without PDF
        
        # Send WhatsApp message to all recipients (main customer + child table numbers)
        success_count = 0
        failed = []
        for recipient in recipient_numbers:
            result = send_whatsapp_template_message(
                phone=recipient,
                template_name=template_name,
                parameters=parameters,
                customer=doc.customer,
                document_url=document_url
            )

            if result.get("success"):
                success_count += 1
            else:
                failed.append(f"{recipient}: {result.get('error')}")

        if success_count:
            frappe.log_error(
                f"WhatsApp order confirmation sent to {success_count}/{len(recipient_numbers)} recipients for {doc.name}",
                "Sales Order WhatsApp Success",
            )
        if failed:
            frappe.log_error(
                "Failed recipients:\n" + "\n".join(failed),
                "Sales Order WhatsApp",
            )
            
    except Exception as e:
        frappe.log_error(f"WhatsApp Send Failed: {str(e)}", "Sales Order WhatsApp")


def on_sales_order_workflow_change(doc, method=None):
    """
    Trigger WhatsApp notification only when workflow transitions to Approved.
    Expected transition: Pending Credit Approval -> Approved
    """
    current_state = (getattr(doc, "workflow_state", None) or "").strip()
    if current_state != "Approved":
        return

    previous_state = None
    try:
        previous_doc = doc.get_doc_before_save()
        previous_state = ((getattr(previous_doc, "workflow_state", None) or "").strip() if previous_doc else None)
    except Exception:
        previous_state = None

    # Strict trigger: only send for Pending Credit Approval -> Approved
    if previous_state != "Pending Credit Approval":
        return

    customer = frappe.get_doc("Customer", doc.customer)
    recipient_numbers = _collect_customer_recipient_numbers(customer)

    if not recipient_numbers:
        frappe.msgprint(
            _("No WhatsApp recipient numbers found for {0}. Message will not be sent.").format(customer.customer_name),
            indicator="orange",
            alert=True
        )
        return
    
    # Check if template exists
    template_exists = frappe.db.exists("Whatsapp Message Template", {
        "template_name": "order_confirmationzz",
        "status": "Approved"
    })
    
    if not template_exists:
        frappe.msgprint(
            _("WhatsApp template 'order_confirmationzz' not found or not approved. Message will not be sent."),
            indicator="orange",
            alert=True
        )
        return
    
    # Enqueue the job to run in background
    frappe.enqueue(
        send_sales_order_whatsapp_async,
        doc_name=doc.name,
        queue='default',
        timeout=300,
        is_async=True,
        now=False
    )
    
    frappe.msgprint(
        _("Sales Order approved. WhatsApp message will be sent shortly."),
        indicator="blue",
        alert=True
    )


# Backward compatibility for any older direct references
def on_sales_order_submit(doc, method):
    return on_sales_order_workflow_change(doc, method)
