import frappe
import json
import requests
import re
import os
import mimetypes


@frappe.whitelist()
def create_whatsapp_template(docname):
    # Load template + WhatsApp settings
    doc = frappe.get_doc("Whatsapp Message Template", docname)
    settings = frappe.get_single("Whatsapp Setting")

    ACCESS_TOKEN = settings.get_password("access_token") or settings.get("access_token")
    WABA_ID = settings.get("business_account_id")  # Business Account ID
    APP_ID = settings.get("app_id")  # Meta App ID (REQUIRED)

    if not ACCESS_TOKEN or not WABA_ID or not APP_ID:
        frappe.throw("Missing Access Token, Business Account ID or App ID")

    template_url = f"https://graph.facebook.com/v24.0/{WABA_ID}/message_templates"
    upload_url = f"https://graph.facebook.com/v24.0/{APP_ID}/uploads"

    components = []

    # HEADER COMPONENT (TEXT / IMAGE / VIDEO / DOCUMENT)
    header_type = (doc.format or "").lower()
    if header_type and header_type != "none":
        if header_type == "text":
            if not doc.text:
                frappe.throw("Header text is required")
            components.append({
                "type": "header",
                "format": "TEXT",
                "text": doc.text.strip()
            })
        elif header_type in ["image", "video", "documentation"]:
            if not doc.media_example:
                frappe.throw("Media file is required for header")

            file_doc = frappe.get_doc("File", {"file_url": doc.media_example})
            if file_doc.is_private:
                file_doc.is_private = 0
                file_doc.save(ignore_permissions=True)
                frappe.db.commit()

            file_path = frappe.get_site_path("public", file_doc.file_url.lstrip("/"))
            filename = file_doc.file_name

            if not os.path.exists(file_path):
                frappe.throw("Media file not found on server")

            mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
            file_size = os.path.getsize(file_path)

            # Upload media
            upload_headers = {
                "Authorization": f"Bearer {ACCESS_TOKEN}",
                "Content-Type": "application/json"
            }
            upload_payload = {
                "file_length": file_size,
                "file_type": mime_type
            }
            upload_session = requests.post(upload_url, headers=upload_headers, json=upload_payload, timeout=30).json()
            if not upload_session.get("id"):
                frappe.throw(f"Upload session failed: {upload_session}")

            upload_id = upload_session["id"]
            with open(file_path, "rb") as f:
                upload_result = requests.post(
                    f"https://graph.facebook.com/v24.0/{upload_id}",
                    headers={"Authorization": f"Bearer {ACCESS_TOKEN}", "Content-Type": mime_type},
                    data=f,
                    timeout=60
                ).json()

            media_handle = upload_result.get("h")
            if not media_handle:
                frappe.throw(f"Media upload failed: {upload_result}")

            format_map = {"image": "IMAGE", "video": "VIDEO", "documentation": "DOCUMENT"}
            components.append({
                "type": "header",
                "format": format_map[header_type],
                "example": {"header_handle": [media_handle]}
            })

    # BODY COMPONENT
    body = {"type": "body", "text": doc.body_text}
    params = re.findall(r"\{\{([^}]+)\}\}", doc.body_text or "")
    params = [p.strip() for p in params]

    if params:
        if not doc.body_parameters:
            frappe.throw("Body parameters missing")

        examples = []
        seen = set()
        for row in doc.body_parameters:
            if not row.parameter_name or not row.example_value:
                continue
            if row.parameter_name in seen:
                frappe.throw(f"Duplicate parameter: {row.parameter_name}")
            seen.add(row.parameter_name)
            examples.append({
                "param_name": row.parameter_name,
                "example": row.example_value
            })

        missing = [p for p in params if p not in seen]
        if missing:
            frappe.throw(f"Missing examples for: {', '.join(missing)}")

        body["example"] = {"body_text_named_params": examples}

    components.append(body)

    # FOOTER
    if doc.footer_text:
        components.append({
            "type": "footer",
            "text": doc.footer_text.strip()
        })

    # BUTTONS - This was the main issue before (now fixed with correct field)
    if doc.table_pkhd:
        print(f"Found {len(doc.table_pkhd)} buttons. Processing...")
        buttons = []
        for btn in doc.table_pkhd:
            raw_type = (btn.type or "").strip()
            # Normalize: remove spaces and uppercase
            normalized_type = raw_type.replace(" ", "").upper()

            if normalized_type == "QUICKREPLY":
                if not btn.text:
                    frappe.throw("Quick Reply button text is required")
                buttons.append({
                    "type": "QUICK_REPLY",
                    "text": btn.text.strip()
                })
                print(f"Added Quick Reply button: {btn.text}")
            elif normalized_type == "URL":
                if not btn.url:
                    frappe.throw(f"URL missing for button: {btn.text}")
                buttons.append({
                    "type": "URL",
                    "text": btn.text.strip(),
                    "url": btn.url
                })
                print(f"Added URL button: {btn.text}")
            elif normalized_type == "PHONENUMBER":
                if not btn.phone_number:
                    frappe.throw(f"Phone number missing for button: {btn.text}")
                buttons.append({
                    "type": "PHONE_NUMBER",
                    "text": btn.text.strip(),
                    "phone_number": btn.phone_number
                })
                print(f"Added Phone Number button: {btn.text}")
            else:
                print(f"Skipped button with unrecognized type: {raw_type}")

        if buttons:
            components.append({
                "type": "buttons",
                "buttons": buttons
            })
            print(f"Successfully added {len(buttons)} buttons to payload.")
        else:
            print("No valid buttons added after processing.")

    # FINAL PAYLOAD
    payload = {
        "name": re.sub(r"[^a-z0-9_]", "_", doc.template_name.lower()),
        "language": doc.language or "en_US",
        "category": (doc.category or "UTILITY").upper(),
        "parameter_format": "named",
        "components": components
    }

    print("\n=== WHATSAPP TEMPLATE PAYLOAD ===")
    print(json.dumps(payload, indent=2))

    # SUBMIT TO WHATSAPP
    response = requests.post(
        template_url,
        headers={
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "Content-Type": "application/json"
        },
        json=payload,
        timeout=30
    )
    res = response.json()
    print("\n=== WHATSAPP API RESPONSE ===")
    print(json.dumps(res, indent=2))

    if response.status_code == 200 and res.get("id"):
        doc.db_set("id", res["id"])
        doc.db_set("status", res.get("status", "PENDING"))
        frappe.msgprint("Template submitted successfully! Check WhatsApp Manager for approval.", indicator="green")
        return {"success": True, "template_id": res["id"]}

    frappe.log_error("WhatsApp Template Creation Failed", json.dumps(res, indent=2))
    frappe.throw(f"Failed to create template: {res.get('error', {}).get('message', 'Unknown error')}")