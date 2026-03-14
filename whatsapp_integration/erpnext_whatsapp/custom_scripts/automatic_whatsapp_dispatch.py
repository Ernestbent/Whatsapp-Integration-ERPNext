import frappe
import requests
import os
from frappe.utils.pdf import get_pdf
from datetime import datetime


def get_whatsapp_config() -> dict:
    """Fetch all WhatsApp credentials from Whatsapp Setting doctype."""
    settings        = frappe.get_single("Whatsapp Setting")
    PHONE_NUMBER_ID = settings.get("phone_number_id")
    WHATSAPP_TOKEN  = settings.get("access_token")
    API_VERSION     = settings.get("app_version") or "v24.0"

    if not PHONE_NUMBER_ID or not WHATSAPP_TOKEN:
        frappe.log_error("WhatsApp credentials missing in Whatsapp Setting", "WhatsApp Config")
        frappe.throw("WhatsApp credentials missing. Please configure Whatsapp Setting.")

    return {
        "phone_number_id": PHONE_NUMBER_ID,
        "token":           WHATSAPP_TOKEN,
        "api_version":     API_VERSION,
        "base_url":        f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}",
        "headers":         {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    }


def generate_report_pdf(report_name: str, filters: dict) -> tuple:
    """
    Run the Script/Query Report, build HTML from its data,
    convert to PDF. Returns (pdf_bytes, filename).
    """
    today    = frappe.utils.today()
    time_now = datetime.now().strftime("%H:%M")

    # Run the report
    report        = frappe.get_doc("Report", report_name)
    columns, data = report.get_data(
        filters = filters,
        user    = frappe.session.user,
        as_dict = True
    )

    # Build column headers
    col_headers = ""
    for col in columns:
        if isinstance(col, dict):
            label = col.get("label") or col.get("fieldname", "")
        else:
            label = str(col).split(":")[0]
        col_headers += f"<th>{label}</th>"

    # Build rows
    rows = ""
    for row in data:
        cells = ""
        for col in columns:
            if isinstance(col, dict):
                fieldname = col.get("fieldname", "")
                value     = row.get(fieldname, "") if isinstance(row, dict) else ""
            else:
                fieldname = str(col).split(":")[0].lower().replace(" ", "_")
                value     = row.get(fieldname, "") if isinstance(row, dict) else ""
            cells += f"<td>{value if value is not None else ''}</td>"
        rows += f"<tr>{cells}</tr>"

    # Step 4: Build HTML
    html = f"""
    <html>
    <head>
        <style>
            body  {{ font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }}
            h2    {{ color: #333; margin-bottom: 4px; }}
            p     {{ color: #666; margin: 2px 0 16px 0; font-size: 10px; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th    {{ background: #f0f0f0; padding: 7px 8px; border: 1px solid #ccc;
                     text-align: left; font-size: 11px; }}
            td    {{ padding: 6px 8px; border: 1px solid #ddd; font-size: 10px; }}
            tr:nth-child(even) {{ background: #fafafa; }}
        </style>
    </head>
    <body>
        <h2>{report_name}</h2>
        <p>Date: {today} | Generated at: {time_now}</p>
        <table>
            <thead><tr>{col_headers}</tr></thead>
            <tbody>{rows}</tbody>
        </table>
    </body>
    </html>
    """

    # Step 5: Convert to PDF bytes
    pdf_bytes = get_pdf(html)
    filename  = f"{report_name.replace(' ', '_')}_{today.replace('-', '')}.pdf"

    return pdf_bytes, filename


def save_pdf_to_file_doctype(pdf_bytes: bytes, filename: str) -> str:
    """
    Save PDF to Frappe File doctype for audit trail.
    Returns file_url or None if it fails.
    """
    try:
        file_doc = frappe.get_doc({
            "doctype":    "File",
            "file_name":  filename,
            "folder":     "Home",
            "is_private": 0,
            "content":    pdf_bytes
        })
        file_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        frappe.logger().info(f"[WhatsApp] File saved -> {file_doc.file_url}")
        return file_doc.file_url
    except Exception as e:
        frappe.log_error(f"File save failed: {str(e)}", "WhatsApp File Save Error")
        return None


def upload_document_to_whatsapp(pdf_bytes: bytes, filename: str) -> str:
    """
    Upload PDF bytes to WhatsApp Cloud media endpoint.
    Returns media_id.
    """
    config = get_whatsapp_config()

    files = {
        "file":              (filename, pdf_bytes, "application/pdf"),
        "type":              (None, "document"),
        "messaging_product": (None, "whatsapp")
    }

    try:
        response = requests.post(
            f"{config['base_url']}/media",
            headers=config["headers"],
            files=files,
            timeout=60
        )
        response.raise_for_status()
        media_id = response.json().get("id")

        if not media_id:
            raise Exception("No media ID returned from WhatsApp")

        frappe.logger().info(f"[WhatsApp] Uploaded -> media_id: {media_id}")
        return media_id

    except Exception as e:
        error_msg = f"WhatsApp media upload failed: {str(e)}"
        if 'response' in locals():
            error_msg += f"\nResponse: {response.text}"
        frappe.log_error(error_msg, "WhatsApp Upload Failed")
        frappe.throw(error_msg)


def send_document_to_recipient(recipient: str, media_id: str, caption: str, filename: str) -> str:
    """
    Send an already-uploaded document to a WhatsApp number.
    Returns the WhatsApp message ID.
    """
    config  = get_whatsapp_config()
    payload = {
        "messaging_product": "whatsapp",
        "to":   recipient,
        "type": "document",
        "document": {
            "id":       media_id,
            "caption":  caption,
            "filename": filename
        }
    }

    try:
        response = requests.post(
            f"{config['base_url']}/messages",
            headers={**config["headers"], "Content-Type": "application/json"},
            json=payload,
            timeout=60
        )
        response.raise_for_status()
        whatsapp_msg_id = response.json().get("messages", [{}])[0].get("id", "")
        frappe.logger().info(f"[WhatsApp] Sent to {recipient} -> msg_id: {whatsapp_msg_id}")
        return whatsapp_msg_id

    except Exception as e:
        error_msg = f"WhatsApp send failed: {str(e)}"
        if 'response' in locals():
            error_msg += f"\nResponse: {response.text}"
        frappe.log_error(error_msg, "WhatsApp Send Failed")
        frappe.throw(error_msg)


def log_whatsapp_message(from_number, message_type, message, media_id,
                         message_status, whatsapp_message_id, customer=None, file_url=None):
    """
    Log outgoing WhatsApp message to Whatsapp Message doctype.
    Mirrors the same pattern used in upload_media_whatsapp_cloud.py.
    """
    try:
        current_time = datetime.now().strftime("%H:%M:%S")

        msg_doc = frappe.get_doc({
            "doctype":             "Whatsapp Message",
            "from_number":         from_number,
            "message_type":        message_type,
            "message":             message,
            "media_id":            media_id,
            "timestamp":           current_time,
            "customer":            customer or "",
            "custom_status":       "Outgoing",
            "message_status":      message_status,
            "whatsapp_message_id": whatsapp_message_id or "",
        })
        msg_doc.insert(ignore_permissions=True)

        if file_url:
            frappe.db.set_value("Whatsapp Message", msg_doc.name, "custom_document", file_url)

        frappe.db.commit()

        # Trigger realtime update so chat UI refreshes instantly
        frappe.publish_realtime("whatsapp_new_message", {
            "contact_number": from_number,
            "message_name":   msg_doc.name,
            "timestamp":      current_time
        }, after_commit=True)

        frappe.logger().info(f"[WhatsApp] Message logged -> {msg_doc.name}")

    except Exception as e:
        frappe.log_error(
            f"Failed to log WhatsApp message: {str(e)}",
            "WhatsApp Message Log Error"
        )


def send_report_job(recipients: list, report_name: str, filters: dict = None):
    """
    Generate report PDF and send to all recipients via WhatsApp.

    Args:
        recipients  : list of phone numbers e.g. ['256757001909']
        report_name : exact ERPNext report name e.g. 'Dispatched Report'
        filters     : optional - defaults to today's date range

    Usage (Frappe console):
        from whatsapp_integration.erpnext_whatsapp.custom_scripts.automatic_whatsapp_dispatch import send_report_job
        send_report_job(['256757001909'], 'Dispatched Report')
    """
    today   = frappe.utils.today()
    filters = filters or {
        "from_date": today,
        "to_date":   today
    }

    time_now = datetime.now().strftime("%H:%M")
    caption  = (
        f"Dispatched Report\n"
        f"Date: {today}\n"
        f"Generated at: {time_now}"
    )

    try:
        # Generate PDF bytes from report
        pdf_bytes, filename = generate_report_pdf(report_name, filters)

        # Save to File doctype for audit trail
        file_url = save_pdf_to_file_doctype(pdf_bytes, filename)

        # Upload to WhatsApp once — reuse media_id for all recipients
        media_id = upload_document_to_whatsapp(pdf_bytes, filename)

        # Send to each recipient and log individually
        for phone in recipients:
            try:
                whatsapp_msg_id = send_document_to_recipient(phone, media_id, caption, filename)

                # Log success to Whatsapp Message doctype
                log_whatsapp_message(
                    from_number         = phone,
                    message_type        = "document",
                    message             = f"Dispatched Report for {today} sent successfully",
                    media_id            = media_id,
                    message_status      = "sent",
                    whatsapp_message_id = whatsapp_msg_id,
                    customer            = None,
                    file_url            = file_url
                )

            except Exception:
                # Log failure to Whatsapp Message doctype
                log_whatsapp_message(
                    from_number         = phone,
                    message_type        = "document",
                    message             = f"Dispatched Report for {today} - Send failed",
                    media_id            = media_id,
                    message_status      = "failed",
                    whatsapp_message_id = "",
                    customer            = None,
                    file_url            = file_url
                )
                frappe.log_error(
                    title   = "WhatsApp Report - Send Failed",
                    message = frappe.get_traceback()
                )

        frappe.logger().info(f"[WhatsApp] Done. {len(recipients)} recipient(s) processed.")

    except Exception:
        frappe.log_error(
            title   = "WhatsApp Report - Error",
            message = frappe.get_traceback()
        )


def run_scheduled_report():
    """
    Entry point called by Frappe scheduler via hooks.py.
    Runs every night at 11:00 PM automatically.
    """
    send_report_job(
        recipients  = ["256757001909"],
        report_name = "Dispatched Report"
    )