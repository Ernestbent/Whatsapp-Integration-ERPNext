import frappe
import json
import requests
import re

@frappe.whitelist()
def create_whatsapp_template(docname):
    doc = frappe.get_doc("Whatsapp Message Template", docname)
    settings = frappe.get_single("Whatsapp Setting")

    ACCESS_TOKEN = settings.get_password("access_token") or settings.get("access_token")
    WABA_ID = settings.get("business_account_id")
    if not ACCESS_TOKEN or not WABA_ID:
        frappe.throw("Missing Access Token or WABA ID")

    url = f"https://graph.facebook.com/v24.0/{WABA_ID}/message_templates"
    components = []

    # Header
    if doc.get("type") and doc.type.lower() != "none":
        if not doc.text or not doc.text.strip():
            frappe.throw("Header Text required")
        components.append({
            "type": "header",
            "format": "TEXT",
            "text": doc.text.strip()
        })

    # Body
    body = {"type": "body", "text": doc.body_text}

    # Extract parameter names from {{...}}
    param_names = [m.strip() for m in re.findall(r"\{\{([^}]+)\}\}", doc.body_text)]

    if param_names:
        if not doc.body_parameters:
            frappe.throw("Body has parameters but no examples in table")

        # Build array of { "param_name": "...", "example": "..." }
        named_examples = []
        seen = set()
        for row in doc.body_parameters:
            pname = row.parameter_name.strip() if row.parameter_name else ""
            pval = row.example_value.strip() if row.example_value else ""
            if not pname or not pval:
                continue
            if pname in seen:
                frappe.throw(f"Duplicate parameter_name: {pname}")
            seen.add(pname)
            named_examples.append({
                "param_name": pname,
                "example": pval
            })

        # Validate all text parameters have examples
        missing = [p for p in param_names if p not in seen]
        if missing:
            frappe.throw(f"Missing examples for: {', '.join(missing)}")

        # Add examples to body component
        body["example"] = {
            "body_text_named_params": named_examples
        }

    components.append(body)

    # Footer
    if doc.footer_text:
        components.append({"type": "footer", "text": doc.footer_text.strip()})

    # Payload
    payload = {
        "name": re.sub(r"[^a-z0-9_]", "_", doc.template_name.lower()),
        "language": doc.language or "en_US",
        "category": (doc.category or "UTILITY").upper(),
        "parameter_format": "named",
        "components": components
    }

    print("\nPAYLOAD:\n", json.dumps(payload, indent=2))

    try:
        response = requests.post(
            url,
            headers={"Authorization": f"Bearer {ACCESS_TOKEN}", "Content-Type": "application/json"},
            json=payload,
            timeout=30
        )
        res = response.json()
    except Exception as e:
        frappe.throw(f"Request failed: {e}")

    print("\nRESPONSE:\n", json.dumps(res, indent=2))

    if response.status_code == 200 and res.get("id"):
        doc.db_set("id", res["id"])
        doc.db_set("status", res.get("status", "PENDING"))
        frappe.msgprint(f"Template created! ID: <b>{res['id']}</b>", indicator="green")
        return {"success": True, "template_id": res["id"]}
    else:
        frappe.log_error(
            title=f"WhatsApp Template Failed: {docname}",
            message=f"Payload:\n{json.dumps(payload, indent=2)}\n\nResponse:\n{json.dumps(res, indent=2)}"
        )
        frappe.msgprint("Failed – check Error Log", indicator="red")
        return {"success": False, "error": res}