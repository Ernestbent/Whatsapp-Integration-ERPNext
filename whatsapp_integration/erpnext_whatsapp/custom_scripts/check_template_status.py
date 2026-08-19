import frappe
import requests


@frappe.whitelist()
def check_whatsapp_template_status(docname):
    
    # Load template document
    doc = frappe.get_doc("Whatsapp Message Template", docname)

    if not doc.id:
        frappe.throw("Template Meta ID is missing. Submit the template first.")

    # Load WhatsApp settings
    settings = frappe.get_single("Whatsapp Setting")
    ACCESS_TOKEN = settings.get_password("access_token") or settings.get("access_token")

    if not ACCESS_TOKEN:
        frappe.throw("WhatsApp Access Token is missing")

    # Meta API endpoint
    url = f"https://graph.facebook.com/v24.0/{doc.id}"
    params = {"fields": "status,name,language,category,parameter_format"}
    headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}

    # API Call
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        res = response.json()
    except Exception as e:
        frappe.log_error(
            title="WhatsApp Template Status Check Failed",
            message=str(e)
        )
        frappe.throw("Failed to check template status. See error log.")

    meta_status = res.get("status")

    if not meta_status:
        frappe.throw(f"Unexpected response from Meta: {res}")

    # Map Meta status → ERPNext status
    status_map = {
        "APPROVED": "Approved",
        "PENDING": "Pending",
        "REJECTED": "Rejected",
        "PAUSED": "Submitted",
        "DISABLED": "Rejected"
    }

    erp_status = status_map.get(meta_status, meta_status)

    updates = {"status": erp_status}
    if res.get("language"):
        updates["language"] = res["language"]
    if res.get("category"):
        updates["category"] = res["category"].lower()
    if res.get("parameter_format"):
        updates["parameter_format"] = res["parameter_format"].lower()

    frappe.db.set_value(
        "Whatsapp Message Template",
        doc.name,
        updates,
        update_modified=True,
    )

    return {
        "success": True,
        "template_id": doc.id,
        "meta_status": meta_status,
        "status": erp_status,
        "language": updates.get("language", doc.language),
        "category": updates.get("category", doc.category),
        "parameter_format": updates.get("parameter_format", doc.parameter_format),
    }
