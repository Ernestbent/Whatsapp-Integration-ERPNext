import os
import re

import frappe
import requests
from frappe.utils import cint, formatdate, now_datetime, nowdate
from frappe.utils.file_manager import save_file
from frappe.utils.pdf import get_pdf

from whatsapp_integration.erpnext_whatsapp.custom_scripts.sales_user_comment_notifications import (
    _normalize_phone,
)
from whatsapp_integration.erpnext_whatsapp.custom_scripts.send_message_template_in_transit import (
    _log_whatsapp_error,
    _upload_media,
)
from whatsapp_integration.erpnext_whatsapp.custom_scripts.send_salesperson_outstanding_reports import (
    MIN_OUTSTANDING_AGE_DAYS,
    _build_salesperson_invoice_map,
    _build_salesperson_report,
    _format_amount,
    _get_file_path,
    _get_whatsapp_credentials,
    _round_amount,
)


TEMPLATE_NAME = "outstanding_report_manager"
TEMPLATE_LANGUAGE = "en"
REPORT_CURRENCY = "UGX"
MIN_MANAGER_INVOICE_OUTSTANDING = 1000.0
EXCLUDED_MANAGER_SALESPEOPLE = {"office"}
MANAGER_RECIPIENT_EMAILS = (
    "ernestben69@gmail.com",
    "admin@autozonepro.org",
    "developer@autozonepro.org",
    "davisorford5@gmail.com",
    "outstanding@autozonepro.org",
)
ADDITIONAL_MANAGER_RECIPIENTS = (
    ("Boss", "256755829642"),
)
TEMPLATE_BODY = (
    "60+ Days Outstanding Report\n\n"
    "Hello {{1}},\n\n"
    "Here is the current outstanding summary for invoices aged 60 days and above.\n\n"
    "Total Outstanding: UGX {{2}}\n"
    "Sales Persons: {{3}}\n"
    "Customers: {{4}}\n"
    "Invoices: {{5}}\n\n"
    "Kindly review and follow up with the respective salespersons to improve collections.\n\n"
    "Thank you"
)
TEMPLATE_FOOTER = "Autozone Professional Limited"


def _get_template_api_name():
    return re.sub(r"[^a-z0-9_]", "_", TEMPLATE_NAME.lower())


def _filter_manager_invoice_rows(salesperson_invoices):
    salesperson_invoices = {
        salesperson: invoice_rows
        for salesperson, invoice_rows in salesperson_invoices.items()
        if str(salesperson or "").strip().casefold() not in EXCLUDED_MANAGER_SALESPEOPLE
    }
    invoice_totals = {}
    for invoice_rows in salesperson_invoices.values():
        for row in invoice_rows:
            invoice_number = row.get("invoice_number")
            if not invoice_number:
                continue
            invoice_totals[invoice_number] = invoice_totals.get(invoice_number, 0.0) + float(
                row.get("outstanding_amount") or 0
            )

    eligible_invoices = {
        invoice_number
        for invoice_number, outstanding in invoice_totals.items()
        if _round_amount(outstanding) >= MIN_MANAGER_INVOICE_OUTSTANDING
    }
    return {
        salesperson: [
            row for row in invoice_rows if row.get("invoice_number") in eligible_invoices
        ]
        for salesperson, invoice_rows in salesperson_invoices.items()
        if any(row.get("invoice_number") in eligible_invoices for row in invoice_rows)
    }


def _build_manager_report():
    salesperson_invoices = _filter_manager_invoice_rows(_build_salesperson_invoice_map())
    salesperson_reports = []
    invoice_numbers = set()
    customers = set()

    for salesperson, invoice_rows in salesperson_invoices.items():
        report = _build_salesperson_report(salesperson, invoice_rows)
        if not report or not report["invoice_count"]:
            continue

        report["oldest_ageing"] = max(cint(row.get("age_days")) for row in invoice_rows)
        salesperson_reports.append(report)
        invoice_numbers.update(
            row.get("invoice_number") for row in invoice_rows if row.get("invoice_number")
        )
        customers.update(row.get("customer") for row in invoice_rows if row.get("customer"))

    salesperson_reports.sort(
        key=lambda report: (-report["total_outstanding"], report["sales_person"] or "")
    )
    total_outstanding = _round_amount(
        sum(report["total_outstanding"] for report in salesperson_reports)
    )

    return {
        "currency": REPORT_CURRENCY,
        "minimum_age_days": MIN_OUTSTANDING_AGE_DAYS,
        "minimum_outstanding": MIN_MANAGER_INVOICE_OUTSTANDING,
        "minimum_outstanding_label": _format_amount(MIN_MANAGER_INVOICE_OUTSTANDING),
        "total_outstanding": total_outstanding,
        "total_outstanding_label": _format_amount(total_outstanding),
        "salesperson_count": len(salesperson_reports),
        "customer_count": len(customers),
        "invoice_count": len(invoice_numbers),
        "salespeople": salesperson_reports,
    }


def _get_report_totals(report):
    return {
        "outstanding": report["total_outstanding"],
        "salespeople": report["salesperson_count"],
        "customers": report["customer_count"],
        "invoices": report["invoice_count"],
    }


def _render_report_html(report):
    return frappe.render_template(
        """
        <html>
        <head>
            <style>
                @page { size: A4 landscape; margin: 12mm; }
                body {
                    color: #17202a;
                    font-family: Arial, sans-serif;
                    font-size: 10px;
                    line-height: 1.35;
                }
                h1 { font-size: 23px; margin: 0 0 3px; }
                h2 { font-size: 17px; margin: 0; }
                h3 { font-size: 13px; margin: 0; }
                .muted { color: #64748b; }
                .report-header {
                    border-bottom: 3px solid #0f766e;
                    margin-bottom: 14px;
                    padding-bottom: 10px;
                }
                .summary-grid {
                    border-collapse: separate;
                    border-spacing: 8px 0;
                    margin: 0 -8px 16px;
                    table-layout: fixed;
                    width: calc(100% + 16px);
                }
                .summary-grid td {
                    background: #f0fdfa;
                    border: 1px solid #99f6e4;
                    padding: 10px;
                }
                .summary-label {
                    color: #475569;
                    font-size: 9px;
                    text-transform: uppercase;
                }
                .summary-value {
                    color: #115e59;
                    font-size: 18px;
                    font-weight: bold;
                    margin-top: 3px;
                }
                table.data {
                    border-collapse: collapse;
                    table-layout: fixed;
                    width: 100%;
                }
                table.data th, table.data td {
                    border: 1px solid #dbe3ea;
                    padding: 5px 6px;
                }
                table.data th {
                    background: #e2e8f0;
                    font-weight: bold;
                    text-align: left;
                }
                table.invoice-table th,
                table.invoice-table td {
                    font-size: 9px;
                    white-space: nowrap;
                    vertical-align: middle;
                }
                table.invoice-table th {
                    font-size: 8px;
                }
                .number { text-align: right; }
                .salesperson-detail { page-break-before: always; }
                .salesperson-head {
                    border-bottom: 2px solid #0f766e;
                    margin-bottom: 10px;
                    padding-bottom: 7px;
                }
                .customer-block {
                    margin-bottom: 13px;
                    page-break-inside: avoid;
                }
                .customer-head {
                    background: #f8fafc;
                    border: 1px solid #dbe3ea;
                    border-bottom: 0;
                    padding: 6px;
                }
            </style>
        </head>
        <body>
            <div class="report-header">
                <h1>{{ report.minimum_age_days }}+ Days Outstanding Report</h1>
                <div class="muted">
                    Invoices with at least {{ report.currency }} {{ report.minimum_outstanding_label }} outstanding |
                    Generated {{ generated_on }}
                </div>
            </div>

            <table class="summary-grid">
                <tr>
                    <td>
                        <div class="summary-label">Total Outstanding</div>
                        <div class="summary-value">{{ report.currency }} {{ report.total_outstanding_label }}</div>
                    </td>
                    <td>
                        <div class="summary-label">Sales Persons</div>
                        <div class="summary-value">{{ report.salesperson_count }}</div>
                    </td>
                    <td>
                        <div class="summary-label">Customers</div>
                        <div class="summary-value">{{ report.customer_count }}</div>
                    </td>
                    <td>
                        <div class="summary-label">Invoices</div>
                        <div class="summary-value">{{ report.invoice_count }}</div>
                    </td>
                </tr>
            </table>

            <h2 style="margin-bottom: 8px;">Salesperson Summary</h2>
            <table class="data">
                <thead>
                    <tr>
                        <th style="width: 32%;">Sales Person</th>
                        <th class="number" style="width: 22%;">Outstanding</th>
                        <th class="number">Customers</th>
                        <th class="number">Invoices</th>
                        <th class="number">Oldest Age</th>
                    </tr>
                </thead>
                <tbody>
                    {% for salesperson in report.salespeople %}
                    <tr>
                        <td>{{ salesperson.sales_person }}</td>
                        <td class="number">{{ report.currency }} {{ salesperson.total_outstanding_label }}</td>
                        <td class="number">{{ salesperson.customer_count }}</td>
                        <td class="number">{{ salesperson.invoice_count }}</td>
                        <td class="number">{{ salesperson.oldest_ageing }} days</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>

            {% for salesperson in report.salespeople %}
            <div class="salesperson-detail">
                <div class="salesperson-head">
                    <h2>{{ salesperson.sales_person }}</h2>
                    <div class="muted">
                        {{ report.currency }} {{ salesperson.total_outstanding_label }} |
                        {{ salesperson.customer_count }} customers |
                        {{ salesperson.invoice_count }} invoice{% if salesperson.invoice_count != 1 %}s{% endif %}
                    </div>
                </div>

                {% for customer in salesperson.customers %}
                <div class="customer-block">
                    <div class="customer-head">
                        <h3>{{ customer.customer_name }}</h3>
                        <span class="muted">
                            {{ report.currency }} {{ customer.outstanding_total_label }} |
                            {{ customer.invoice_count }} invoice{% if customer.invoice_count != 1 %}s{% endif %} |
                            oldest {{ customer.oldest_ageing }} days
                        </span>
                    </div>
                    <table class="data invoice-table">
                        <thead>
                            <tr>
                                <th style="width: 24%;">Invoice</th>
                                <th style="width: 13%;">Due Date</th>
                                <th class="number" style="width: 8%;">Age</th>
                                <th class="number" style="width: 28%;">Allocated Outstanding</th>
                                <th class="number" style="width: 27%;">Invoice Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {% for invoice in customer.invoices %}
                            <tr>
                                <td>{{ invoice.invoice_number }}</td>
                                <td>{{ invoice.due_date_label }}</td>
                                <td class="number">{{ invoice.age_days }} days</td>
                                <td class="number">{{ report.currency }} {{ invoice.outstanding_amount_label }}</td>
                                <td class="number">{{ report.currency }} {{ invoice.invoice_total_label }}</td>
                            </tr>
                            {% endfor %}
                        </tbody>
                    </table>
                </div>
                {% endfor %}
            </div>
            {% endfor %}
        </body>
        </html>
        """,
        {"report": report, "generated_on": formatdate(nowdate())},
    )


def _create_report_file(report):
    pdf_content = get_pdf(_render_report_html(report))
    return save_file(
        fname=f"Manager_60_Plus_Outstanding_Report_{nowdate()}.pdf",
        content=pdf_content,
        dt=None,
        dn=None,
        folder="Home/Attachments",
        is_private=1,
    )


def _resolve_manager_recipients():
    recipients = []
    skipped = []
    seen_numbers = set()

    for email in MANAGER_RECIPIENT_EMAILS:
        user = frappe.db.get_value(
            "User",
            email,
            ["name", "first_name", "full_name", "mobile_no", "phone", "enabled"],
            as_dict=True,
        )
        if not user:
            skipped.append({"user": email, "status": "skipped", "detail": "User does not exist"})
            continue
        if not cint(user.enabled):
            skipped.append({"user": email, "status": "skipped", "detail": "User is disabled"})
            continue

        phone = _normalize_phone(user.mobile_no or user.phone)
        if not phone:
            skipped.append(
                {
                    "user": email,
                    "status": "skipped",
                    "detail": "User has no mobile_no or phone",
                }
            )
            continue
        if phone in seen_numbers:
            skipped.append(
                {
                    "user": email,
                    "status": "skipped",
                    "detail": "Phone number is already in the recipient list",
                }
            )
            continue

        recipients.append(
            {
                "user": user.name,
                "recipient_name": user.first_name or user.full_name or user.name.split("@", 1)[0],
                "phone": phone,
            }
        )
        seen_numbers.add(phone)

    for recipient_name, raw_phone in ADDITIONAL_MANAGER_RECIPIENTS:
        phone = _normalize_phone(raw_phone)
        if not phone:
            skipped.append(
                {
                    "phone": raw_phone,
                    "status": "skipped",
                    "detail": "Additional recipient has an invalid phone number",
                }
            )
            continue
        if phone in seen_numbers:
            continue

        recipients.append(
            {
                "user": "",
                "recipient_name": recipient_name,
                "phone": phone,
            }
        )
        seen_numbers.add(phone)

    return recipients, skipped


def _build_template_components(file_doc, media_id, report, recipient_name):
    parameters = [
        recipient_name,
        _format_amount(report["total_outstanding"]),
        str(report["salesperson_count"]),
        str(report["customer_count"]),
        str(report["invoice_count"]),
    ]
    components = [
        {
            "type": "header",
            "parameters": [
                {
                    "type": "document",
                    "document": {"id": media_id, "filename": file_doc.file_name},
                }
            ],
        },
        {
            "type": "body",
            "parameters": [{"type": "text", "text": value} for value in parameters],
        },
    ]
    return parameters, components


def _render_logged_message(parameters):
    message = TEMPLATE_BODY
    for index, value in enumerate(parameters, start=1):
        message = message.replace(f"{{{{{index}}}}}", str(value or ""))
    return f"{message}\n\n{TEMPLATE_FOOTER}"


def _log_outgoing_message(
    recipient,
    file_doc,
    parameters,
    message_status,
    message_id="",
    media_id="",
    error="",
):
    message = _render_logged_message(parameters)
    if error:
        message = f"{message}\n\nError: {error}"

    meta = frappe.get_meta("Whatsapp Message")
    log_data = {
        "doctype": "Whatsapp Message",
        "from_number": recipient["phone"],
        "message_type": "template",
        "custom_status": "Outgoing",
        "message": message,
        "message_status": message_status,
        "message_id": message_id or "",
        "timestamp": now_datetime().strftime("%H:%M:%S"),
    }
    if (
        meta.has_field("custom_user")
        and recipient.get("user")
        and frappe.db.exists("User", recipient["user"])
    ):
        log_data["custom_user"] = recipient["user"]
    if meta.has_field("custom_document"):
        log_data["custom_document"] = file_doc.file_url
    if meta.has_field("media_id"):
        log_data["media_id"] = media_id or ""
    if meta.has_field("whatsapp_message_id"):
        log_data["whatsapp_message_id"] = message_id or ""

    frappe.get_doc(log_data).insert(ignore_permissions=True)
    frappe.db.commit()


def _send_to_recipient(recipient, file_doc, media_id, report, access_token, phone_number_id):
    parameters, components = _build_template_components(
        file_doc, media_id, report, recipient["recipient_name"]
    )
    payload = {
        "messaging_product": "whatsapp",
        "to": recipient["phone"],
        "type": "template",
        "template": {
            "name": _get_template_api_name(),
            "language": {"code": TEMPLATE_LANGUAGE},
            "components": components,
        },
    }

    try:
        response = requests.post(
            f"https://graph.facebook.com/v24.0/{phone_number_id}/messages",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        try:
            result = response.json()
        except ValueError:
            result = {"raw_response": response.text}

        if response.status_code == 200 and result.get("messages"):
            message_id = result["messages"][0]["id"]
            _log_outgoing_message(
                recipient,
                file_doc,
                parameters,
                "sent",
                message_id=message_id,
                media_id=media_id,
            )
            return {
                "user": recipient["user"],
                "phone": recipient["phone"],
                "status": "sent",
                "message_id": message_id,
            }

        error = result.get("error", {}).get("message", str(result))
        _log_whatsapp_error(
            "Manager Outstanding Report WhatsApp Send Failed",
            f"Failed to send manager report to {recipient['user']}: {error}",
            payload=payload,
            response=result,
        )
        _log_outgoing_message(
            recipient,
            file_doc,
            parameters,
            "failed",
            media_id=media_id,
            error=error,
        )
        return {
            "user": recipient["user"],
            "phone": recipient["phone"],
            "status": "failed",
            "detail": error,
        }
    except Exception as exc:
        _log_whatsapp_error(
            "Manager Outstanding Report WhatsApp Exception",
            f"Failed to send manager report to {recipient['user']}",
            payload=payload,
            exc=exc,
        )
        _log_outgoing_message(
            recipient,
            file_doc,
            parameters,
            "failed",
            media_id=media_id,
            error=str(exc),
        )
        return {
            "user": recipient["user"],
            "phone": recipient["phone"],
            "status": "failed",
            "detail": str(exc),
        }


def _run_manager_outstanding_reports():
    report = _build_manager_report()
    if not report["invoice_count"]:
        return {
            "processed": 0,
            "sent": 0,
            "failed": 0,
            "skipped": 1,
            "detail": (
                f"No invoices aged {MIN_OUTSTANDING_AGE_DAYS} days or more with outstanding "
                f"of at least {_format_amount(MIN_MANAGER_INVOICE_OUTSTANDING)}"
            ),
        }

    recipients, details = _resolve_manager_recipients()
    if not recipients:
        return {
            "processed": len(details),
            "sent": 0,
            "failed": 0,
            "skipped": len(details),
            "details": details,
            "totals": _get_report_totals(report),
        }

    file_doc = _create_report_file(report)
    _, access_token, phone_number_id = _get_whatsapp_credentials()
    file_path = _get_file_path(file_doc)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found on server: {file_path}")

    media_id = _upload_media(file_path, file_doc.file_name, access_token, phone_number_id)
    if not media_id:
        raise frappe.ValidationError("WhatsApp media upload failed")

    for recipient in recipients:
        details.append(
            _send_to_recipient(
                recipient,
                file_doc,
                media_id,
                report,
                access_token,
                phone_number_id,
            )
        )

    return {
        "processed": len(details),
        "sent": sum(row["status"] == "sent" for row in details),
        "failed": sum(row["status"] == "failed" for row in details),
        "skipped": sum(row["status"] == "skipped" for row in details),
        "generated_file": {
            "name": file_doc.name,
            "file_name": file_doc.file_name,
            "file_url": file_doc.file_url,
        },
        "totals": _get_report_totals(report),
        "details": details,
    }


def _send_manager_outstanding_reports_background():
    try:
        summary = _run_manager_outstanding_reports()
        frappe.log_error(
            title="Manager Outstanding Report Background Summary",
            message=frappe.as_json(summary, indent=2),
        )
    except Exception:
        frappe.log_error(
            title="Manager Outstanding Report Background Error",
            message=frappe.get_traceback(),
        )


def run_scheduled_manager_outstanding_reports():
    frappe.enqueue(
        _send_manager_outstanding_reports_background,
        queue="default",
        timeout=1800,
        is_async=True,
        now=False,
        enqueue_after_commit=True,
    )


@frappe.whitelist()
def send_manager_outstanding_reports(enqueue=False):
    if cint(enqueue):
        frappe.enqueue(
            _send_manager_outstanding_reports_background,
            queue="default",
            timeout=1800,
            is_async=True,
            now=False,
            enqueue_after_commit=True,
        )
        return {"queued": True, "message": "Manager outstanding report has been queued."}

    return _run_manager_outstanding_reports()
