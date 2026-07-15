import os
from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import re

import frappe
import requests
from frappe import _
from frappe.utils import cint, formatdate, getdate, now_datetime, nowdate
from frappe.utils.file_manager import save_file
from frappe.utils.pdf import get_pdf

from whatsapp_integration.erpnext_whatsapp.custom_scripts.sales_user_comment_notifications import (
    _normalize_phone,
)
from whatsapp_integration.erpnext_whatsapp.custom_scripts.send_message_template_in_transit import (
    _log_whatsapp_error,
    _upload_media,
)


TEMPLATE_NAME = "outstanding_reminder_with_pdf"
TEMPLATE_LANGUAGE = "en"
MIN_OUTSTANDING_AGE_DAYS = 60
TEMPLATE_BODY = (
    "📊 Outstanding Summary\n\n"
    "Hello {{1}},\n\n"
    "Here is your current outstanding summary.\n\n"
    "💰 Outstanding: UGX {{2}}\n"
    "👥 Customers: {{3}}\n"
    "🧾 Invoices: {{4}}\n\n"
    "Kindly follow up with your customers to improve collections.\n\n"
    "Thank you."
)
TEMPLATE_FOOTER = "Autozone Professional Limited"
PDF_DECIMAL_PLACES = Decimal("0.01")
SALES_PERSON_USER_OVERRIDES = {
    "jolie": "estimates@autozonepro.org",
    "moses": "moyabira3@gmail.com",
    "rhoda": "rhodahnakku6@gmail.com",
    "rhodah": "rhodahnakku6@gmail.com",
    "rony": "ronniebbaale252@gmail.com",
}


def _round_amount(value):
    return float(Decimal(str(value or 0)).quantize(PDF_DECIMAL_PLACES, rounding=ROUND_HALF_UP))


def _format_amount(value):
    return f"{_round_amount(value):,.2f}".rstrip("0").rstrip(".")


def _format_currency(value, currency="UGX"):
    return f"{currency} {_format_amount(value)}"


def _get_template_api_name():
    return re.sub(r"[^a-z0-9_]", "_", TEMPLATE_NAME.lower())


def _render_hardcoded_template_message(parameters):
    message = TEMPLATE_BODY
    for key, value in parameters.items():
        message = message.replace(f"{{{{{key}}}}}", str(value))
    return f"{message}\n\n{TEMPLATE_FOOTER}"


def _get_file_path(file_doc):
    file_url = file_doc.file_url or ""
    if file_url.startswith("/private/"):
        return frappe.get_site_path(file_url.lstrip("/"))
    if file_url.startswith("/files/"):
        return frappe.get_site_path("public", file_url.lstrip("/"))
    return frappe.get_site_path(file_url.lstrip("/"))


def _build_summary(status, salesperson, detail=None, **extra):
    payload = {
        "sales_person": salesperson,
        "status": status,
    }
    if detail:
        payload["detail"] = detail
    payload.update(extra)
    return payload


def _get_whatsapp_credentials():
    settings = frappe.get_single("Whatsapp Setting")
    access_token = settings.get_password("access_token") or settings.get("access_token")
    phone_number_id = settings.get("phone_number_id")

    if not access_token or not phone_number_id:
        frappe.throw(_("Missing Access Token or Phone Number ID in WhatsApp Settings"))

    return settings, access_token, phone_number_id


def _fetch_outstanding_invoice_rows():
    return frappe.db.sql(
        """
        SELECT
            si.name AS invoice_number,
            si.customer,
            si.customer_name,
            si.posting_date,
            si.due_date,
            si.grand_total,
            si.outstanding_amount,
            si.currency,
            st.sales_person,
            COALESCE(st.allocated_percentage, 0) AS allocated_percentage,
            COALESCE(st.allocated_amount, 0) AS allocated_amount
        FROM `tabSales Invoice` si
        INNER JOIN `tabSales Team` st
            ON st.parent = si.name
        WHERE
            si.docstatus = 1
            AND si.outstanding_amount > 0
            AND st.parenttype = 'Sales Invoice'
            AND IFNULL(st.sales_person, '') != ''
        ORDER BY st.sales_person, si.customer, si.due_date, si.posting_date, si.name
        """,
        as_dict=True,
    )


def _group_invoice_allocations(rows):
    invoices = {}

    for row in rows:
        invoice = invoices.setdefault(
            row.invoice_number,
            {
                "invoice_number": row.invoice_number,
                "customer": row.customer,
                "customer_name": row.customer_name,
                "posting_date": row.posting_date,
                "due_date": row.due_date,
                "grand_total": float(row.grand_total or 0),
                "outstanding_amount": float(row.outstanding_amount or 0),
                "currency": row.currency or "UGX",
                "sales_people": defaultdict(lambda: {"allocated_percentage": 0.0, "allocated_amount": 0.0}),
            },
        )

        salesperson_bucket = invoice["sales_people"][row.sales_person]
        salesperson_bucket["allocated_percentage"] += float(row.allocated_percentage or 0)
        salesperson_bucket["allocated_amount"] += float(row.allocated_amount or 0)

    return invoices


def _distribute_invoice(invoice):
    outstanding_amount = float(invoice["outstanding_amount"] or 0)
    grand_total = float(invoice["grand_total"] or 0)
    sales_people = invoice["sales_people"]

    if not outstanding_amount or not sales_people:
        return {}

    total_percentage = sum(max(0.0, values["allocated_percentage"]) for values in sales_people.values())
    total_allocated_amount = sum(max(0.0, values["allocated_amount"]) for values in sales_people.values())
    distinct_sales_people = list(sales_people.keys())
    distributed = {}

    if total_percentage > 0:
        for salesperson, values in sales_people.items():
            share_ratio = max(0.0, values["allocated_percentage"]) / total_percentage
            distributed[salesperson] = outstanding_amount * share_ratio
    elif total_allocated_amount > 0 and grand_total > 0:
        for salesperson, values in sales_people.items():
            share_ratio = max(0.0, values["allocated_amount"]) / total_allocated_amount
            distributed[salesperson] = outstanding_amount * share_ratio
    elif len(distinct_sales_people) == 1:
        distributed[distinct_sales_people[0]] = outstanding_amount
    else:
        equal_share = outstanding_amount / len(distinct_sales_people)
        for salesperson in distinct_sales_people:
            distributed[salesperson] = equal_share

    return {salesperson: _round_amount(amount) for salesperson, amount in distributed.items() if amount > 0}


def _build_salesperson_invoice_map(target_salesperson=None):
    salesperson_map = defaultdict(list)
    target_salesperson = (target_salesperson or "").strip()

    for invoice in _group_invoice_allocations(_fetch_outstanding_invoice_rows()).values():
        due_date = getdate(invoice["due_date"] or invoice["posting_date"])
        posting_date = getdate(invoice["posting_date"])
        age_days = max((date.today() - due_date).days, 0) if due_date else 0
        if age_days < MIN_OUTSTANDING_AGE_DAYS:
            continue

        for salesperson, share_amount in _distribute_invoice(invoice).items():
            if target_salesperson and salesperson != target_salesperson:
                continue
            salesperson_map[salesperson].append(
                {
                    "invoice_number": invoice["invoice_number"],
                    "customer": invoice["customer"],
                    "customer_name": invoice["customer_name"] or invoice["customer"],
                    "posting_date": posting_date,
                    "due_date": due_date,
                    "age_days": age_days,
                    "invoice_total": _round_amount(invoice["grand_total"]),
                    "outstanding_amount": share_amount,
                    "currency": invoice["currency"] or "UGX",
                    "sales_person": salesperson,
                }
            )

    return salesperson_map


def _build_salesperson_report(salesperson, invoice_rows):
    if not invoice_rows:
        return None

    currency = invoice_rows[0]["currency"] or "UGX"
    customers = {}

    for row in invoice_rows:
        customer_entry = customers.setdefault(
            row["customer"],
            {
                "customer": row["customer"],
                "customer_name": row["customer_name"],
                "outstanding_total": 0.0,
                "oldest_ageing": 0,
                "invoice_count": 0,
                "invoices": [],
            },
        )
        customer_entry["outstanding_total"] += float(row["outstanding_amount"] or 0)
        customer_entry["oldest_ageing"] = max(customer_entry["oldest_ageing"], cint(row["age_days"]))
        customer_entry["invoice_count"] += 1
        customer_entry["invoices"].append(row)

    customer_sections = []
    for customer_entry in customers.values():
        customer_entry["outstanding_total"] = _round_amount(customer_entry["outstanding_total"])
        customer_entry["invoices"].sort(
            key=lambda row: (
                row["due_date"] or date.max,
                row["posting_date"] or date.max,
                row["invoice_number"] or "",
            )
        )
        for invoice in customer_entry["invoices"]:
            invoice["posting_date_label"] = formatdate(invoice["posting_date"])
            invoice["due_date_label"] = formatdate(invoice["due_date"])
            invoice["outstanding_amount_label"] = _format_amount(invoice["outstanding_amount"])
            invoice["invoice_total_label"] = _format_amount(invoice["invoice_total"])
        customer_entry["outstanding_total_label"] = _format_amount(customer_entry["outstanding_total"])
        customer_sections.append(customer_entry)

    customer_sections.sort(key=lambda row: (-row["outstanding_total"], row["customer_name"] or row["customer"]))

    total_outstanding = _round_amount(sum(customer["outstanding_total"] for customer in customer_sections))
    total_invoices = sum(customer["invoice_count"] for customer in customer_sections)

    return {
        "sales_person": salesperson,
        "currency": currency,
        "total_outstanding": total_outstanding,
        "total_outstanding_label": _format_amount(total_outstanding),
        "customer_count": len(customer_sections),
        "invoice_count": total_invoices,
        "customers": customer_sections,
    }


def _render_report_html(report_data):
    return frappe.render_template(
        """
        <html>
        <head>
            <style>
                @page { size: A4; margin: 16mm 12mm; }
                body {
                    font-family: Arial, sans-serif;
                    color: #1f2937;
                    font-size: 11px;
                    line-height: 1.4;
                }
                .header {
                    border-bottom: 2px solid #d1d5db;
                    padding-bottom: 10px;
                    margin-bottom: 18px;
                }
                .title {
                    font-size: 22px;
                    font-weight: 700;
                    margin: 0 0 4px 0;
                }
                .subtitle, .meta {
                    color: #6b7280;
                    margin: 0;
                }
                .summary {
                    margin-top: 12px;
                }
                .summary-amount {
                    font-size: 20px;
                    font-weight: 700;
                    margin: 0 0 4px 0;
                }
                .customer-section {
                    page-break-inside: avoid;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 16px;
                }
                .customer-head {
                    display: table;
                    width: 100%;
                    margin-bottom: 10px;
                }
                .customer-head > div {
                    display: table-cell;
                    vertical-align: top;
                }
                .customer-name {
                    font-size: 14px;
                    font-weight: 700;
                }
                .customer-total {
                    text-align: right;
                    font-size: 14px;
                    font-weight: 700;
                }
                .customer-meta {
                    color: #6b7280;
                    font-size: 10px;
                    margin-top: 4px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }
                th, td {
                    border: 1px solid #e5e7eb;
                    padding: 6px 7px;
                    font-size: 10px;
                }
                th {
                    background: #f9fafb;
                    text-align: left;
                    font-weight: 700;
                }
                td.amount, th.amount {
                    text-align: right;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <p class="title">{{ report.sales_person }}</p>
                <p class="summary-amount">{{ currency_label }} {{ report.total_outstanding_label }}</p>
                <p class="subtitle">{{ report.customer_count }} customers | {{ report.invoice_count }} invoices</p>
                <p class="meta">Generated on {{ generated_on }}</p>
            </div>

            {% for customer in report.customers %}
            <div class="customer-section">
                <div class="customer-head">
                    <div>
                        <div class="customer-name">{{ customer.customer_name }}</div>
                        <div class="customer-meta">
                            Oldest ageing: {{ customer.oldest_ageing }}d | {{ customer.invoice_count }} invoice{% if customer.invoice_count != 1 %}s{% endif %}
                        </div>
                    </div>
                    <div class="customer-total">{{ currency_label }} {{ customer.outstanding_total_label }}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Invoice</th>
                            <th>Date</th>
                            <th>Due</th>
                            <th>Age</th>
                            <th class="amount">Outstanding</th>
                            <th class="amount">Invoice Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for invoice in customer.invoices %}
                        <tr>
                            <td>{{ invoice.invoice_number }}</td>
                            <td>{{ invoice.posting_date_label }}</td>
                            <td>{{ invoice.due_date_label }}</td>
                            <td>{{ invoice.age_days }}d</td>
                            <td class="amount">{{ currency_label }} {{ invoice.outstanding_amount_label }}</td>
                            <td class="amount">{{ currency_label }} {{ invoice.invoice_total_label }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
            {% endfor %}
        </body>
        </html>
        """,
        {
            "report": report_data,
            "generated_on": formatdate(nowdate()),
            "currency_label": report_data["currency"],
        },
    )


def _save_report_file(salesperson, pdf_content):
    filename = f"Outstanding_Report_{frappe.scrub(salesperson).replace('_', ' ').title().replace(' ', '_')}_{nowdate()}.pdf"
    file_doc = save_file(
        fname=filename,
        content=pdf_content,
        dt="Sales Person",
        dn=salesperson,
        folder="Home/Attachments",
        is_private=1,
    )
    if hasattr(file_doc, "db_set"):
        if frappe.get_meta("File").has_field("attached_to_doctype"):
            file_doc.db_set("attached_to_doctype", "Sales Person", update_modified=False)
        if frappe.get_meta("File").has_field("attached_to_name"):
            file_doc.db_set("attached_to_name", salesperson, update_modified=False)
    return file_doc


def _create_report_file(salesperson, report_data):
    html = _render_report_html(report_data)
    pdf_content = get_pdf(html)
    return _save_report_file(salesperson, pdf_content)


def _normalize_match_value(value):
    return " ".join((value or "").strip().lower().split())


def _get_salesperson_identity(salesperson):
    values = frappe.db.get_value(
        "Sales Person",
        salesperson,
        ["name", "sales_person_name"],
        as_dict=True,
    ) or {}

    return {
        "name": values.get("name") or salesperson,
        "sales_person_name": values.get("sales_person_name") or salesperson,
    }


def _find_user_from_salesperson_name(salesperson):
    identity = _get_salesperson_identity(salesperson)
    targets = {
        _normalize_match_value(identity["name"]),
        _normalize_match_value(identity["sales_person_name"]),
    }
    targets.discard("")

    user_rows = frappe.get_all(
        "User",
        filters={"enabled": 1},
        fields=["name", "full_name", "first_name", "mobile_no", "phone", "enabled"],
        limit_page_length=0,
    )

    matches = []
    for user_row in user_rows:
        candidates = {
            _normalize_match_value(user_row.get("name")),
            _normalize_match_value(user_row.get("full_name")),
            _normalize_match_value(user_row.get("first_name")),
            _normalize_match_value((user_row.get("name") or "").split("@")[0]),
        }
        candidates.discard("")

        if targets.intersection(candidates):
            matches.append(user_row)

    if len(matches) == 1:
        user_doc = frappe._dict(matches[0])
        phone = _normalize_phone(user_doc.get("mobile_no") or user_doc.get("phone"))
        if not phone:
            raise frappe.ValidationError(f"User.mobile_no is empty for {user_doc.name}")
        return user_doc, phone

    if len(matches) > 1:
        raise frappe.ValidationError(
            f"Multiple enabled Users matched Sales Person '{identity['sales_person_name']}'. "
            "Please add Sales Person.custom_user for an exact mapping."
        )

    raise frappe.ValidationError(
        f"No enabled User found for Sales Person '{identity['sales_person_name']}'. "
        "Create Sales Person.custom_user or align the User name/full_name with the Sales Person."
    )


def _resolve_salesperson_user(salesperson):
    sales_person_meta = frappe.get_meta("Sales Person")
    custom_user = None

    if sales_person_meta.has_field("custom_user"):
        custom_user = frappe.db.get_value("Sales Person", salesperson, "custom_user")

    if not custom_user:
        identity = _get_salesperson_identity(salesperson)
        for value in (identity["name"], identity["sales_person_name"]):
            custom_user = SALES_PERSON_USER_OVERRIDES.get(_normalize_match_value(value))
            if custom_user:
                break

    if not custom_user:
        return _find_user_from_salesperson_name(salesperson)

    user_doc = frappe.db.get_value(
        "User",
        custom_user,
        ["name", "full_name", "mobile_no", "phone", "enabled"],
        as_dict=True,
    )

    if not user_doc:
        raise frappe.DoesNotExistError(f"Linked User does not exist: {custom_user}")
    if not cint(user_doc.enabled):
        raise frappe.ValidationError(f"Linked User is disabled: {custom_user}")

    phone = _normalize_phone(user_doc.mobile_no or user_doc.phone)
    if not phone:
        raise frappe.ValidationError(f"User.mobile_no is empty for {custom_user}")

    return user_doc, phone


def _build_template_components(file_doc, media_id, report_data):
    parameters = {
        "1": report_data["sales_person"],
        "2": _format_amount(report_data["total_outstanding"]),
        "3": str(report_data["customer_count"]),
        "4": str(report_data["invoice_count"]),
    }

    return parameters, [
        {
            "type": "header",
            "parameters": [
                {
                    "type": "document",
                    "document": {
                        "id": media_id,
                        "filename": file_doc.file_name,
                    },
                }
            ],
        },
        {
            "type": "body",
            "parameters": [{"type": "text", "text": parameters[key]} for key in ["1", "2", "3", "4"]],
        },
    ]


def _log_outgoing_message(phone, user_name, file_doc, report_data, message_id, message_status, media_id="", error_text=""):
    message_text = _render_hardcoded_template_message(
        {
            "1": report_data["sales_person"],
            "2": _format_amount(report_data["total_outstanding"]),
            "3": report_data["customer_count"],
            "4": report_data["invoice_count"],
        }
    )

    if error_text:
        message_text = f"{message_text}\n\nError: {error_text}"

    meta = frappe.get_meta("Whatsapp Message")
    log_doc = {
        "doctype": "Whatsapp Message",
        "from_number": phone,
        "message_type": "template",
        "custom_status": "Outgoing",
        "message": message_text,
        "message_status": message_status,
        "message_id": message_id or "",
        "timestamp": now_datetime().strftime("%H:%M:%S"),
    }

    if meta.has_field("custom_document"):
        log_doc["custom_document"] = file_doc.file_url
    if meta.has_field("custom_user"):
        log_doc["custom_user"] = user_name
    if meta.has_field("media_id"):
        log_doc["media_id"] = media_id or ""
    if meta.has_field("whatsapp_message_id"):
        log_doc["whatsapp_message_id"] = message_id or ""

    frappe.get_doc(log_doc).insert(ignore_permissions=True)
    frappe.db.commit()


def _send_template_with_pdf(phone, file_doc, report_data):
    _, access_token, phone_number_id = _get_whatsapp_credentials()
    file_path = _get_file_path(file_doc)

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found on server: {file_path}")

    media_id = _upload_media(file_path, file_doc.file_name, access_token, phone_number_id)
    if not media_id:
        raise frappe.ValidationError("WhatsApp media upload failed")

    parameters, components = _build_template_components(file_doc, media_id, report_data)
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": _get_template_api_name(),
            "language": {"code": TEMPLATE_LANGUAGE},
            "components": components,
        },
    }

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
        return {
            "success": True,
            "media_id": media_id,
            "message_id": result["messages"][0]["id"],
            "response": result,
            "parameters": parameters,
        }

    error_message = result.get("error", {}).get("message", str(result))
    _log_whatsapp_error(
        "Outstanding Report WhatsApp Send Failed",
        f"WhatsApp send failed for {report_data['sales_person']}: {error_message}",
        payload=payload,
        response=result,
    )
    return {
        "success": False,
        "media_id": media_id,
        "error": error_message,
        "response": result,
        "parameters": parameters,
    }


def _process_single_salesperson(salesperson, invoice_rows):
    if not invoice_rows:
        return _build_summary("skipped", salesperson, "No outstanding invoices")

    report_data = _build_salesperson_report(salesperson, invoice_rows)
    if not report_data or not report_data["invoice_count"]:
        return _build_summary("skipped", salesperson, "No outstanding invoices")

    try:
        user_doc, phone = _resolve_salesperson_user(salesperson)
    except Exception as exc:
        _log_whatsapp_error(
            "Outstanding Report Recipient Resolution",
            f"Failed to resolve recipient for {salesperson}",
            exc=exc,
        )
        return _build_summary("skipped", salesperson, str(exc))

    try:
        file_doc = _create_report_file(salesperson, report_data)
    except Exception as exc:
        _log_whatsapp_error(
            "Outstanding Report PDF Generation",
            f"Failed to generate PDF for {salesperson}",
            exc=exc,
        )
        return _build_summary(
            "failed",
            salesperson,
            "PDF generation failed",
            recipient_user=user_doc.name,
            phone=phone,
            error=str(exc),
        )

    try:
        send_result = _send_template_with_pdf(phone, file_doc, report_data)
        if send_result.get("success"):
            _log_outgoing_message(
                phone=phone,
                user_name=user_doc.name,
                file_doc=file_doc,
                report_data=report_data,
                message_id=send_result.get("message_id"),
                message_status="sent",
                media_id=send_result.get("media_id"),
            )
            return _build_summary(
                "sent",
                salesperson,
                "Outstanding report sent",
                recipient_user=user_doc.name,
                recipient_name=user_doc.full_name,
                phone=phone,
                generated_file={
                    "name": file_doc.name,
                    "file_name": file_doc.file_name,
                    "file_url": file_doc.file_url,
                },
                whatsapp_response=send_result.get("response"),
                message_id=send_result.get("message_id"),
                media_id=send_result.get("media_id"),
                totals={
                    "outstanding": report_data["total_outstanding"],
                    "customers": report_data["customer_count"],
                    "invoices": report_data["invoice_count"],
                },
            )

        _log_outgoing_message(
            phone=phone,
            user_name=user_doc.name,
            file_doc=file_doc,
            report_data=report_data,
            message_id="",
            message_status="failed",
            media_id=send_result.get("media_id"),
            error_text=send_result.get("error"),
        )
        return _build_summary(
            "failed",
            salesperson,
            "WhatsApp sending failed",
            recipient_user=user_doc.name,
            recipient_name=user_doc.full_name,
            phone=phone,
            generated_file={
                "name": file_doc.name,
                "file_name": file_doc.file_name,
                "file_url": file_doc.file_url,
            },
            error=send_result.get("error"),
            whatsapp_response=send_result.get("response"),
            media_id=send_result.get("media_id"),
            totals={
                "outstanding": report_data["total_outstanding"],
                "customers": report_data["customer_count"],
                "invoices": report_data["invoice_count"],
            },
        )

    except Exception as exc:
        _log_whatsapp_error(
            "Outstanding Report WhatsApp Exception",
            f"Failed to send outstanding report for {salesperson}",
            exc=exc,
        )
        _log_outgoing_message(
            phone=phone,
            user_name=user_doc.name,
            file_doc=file_doc,
            report_data=report_data,
            message_id="",
            message_status="failed",
            error_text=str(exc),
        )
        return _build_summary(
            "failed",
            salesperson,
            "WhatsApp upload/send failed",
            recipient_user=user_doc.name,
            recipient_name=user_doc.full_name,
            phone=phone,
            generated_file={
                "name": file_doc.name,
                "file_name": file_doc.file_name,
                "file_url": file_doc.file_url,
            },
            error=str(exc),
            totals={
                "outstanding": report_data["total_outstanding"],
                "customers": report_data["customer_count"],
                "invoices": report_data["invoice_count"],
            },
        )


def _run_salesperson_outstanding_reports(target_salesperson=None):
    target_salesperson = (target_salesperson or "").strip()
    salesperson_invoices = _build_salesperson_invoice_map(target_salesperson=target_salesperson)
    details = []

    if target_salesperson and target_salesperson not in salesperson_invoices:
        return {
            "processed": 1,
            "sent": 0,
            "failed": 0,
            "skipped": 1,
            "details": [
                _build_summary("skipped", target_salesperson, "No outstanding invoices"),
            ],
        }

    for salesperson in sorted(salesperson_invoices.keys()):
        details.append(_process_single_salesperson(salesperson, salesperson_invoices.get(salesperson) or []))

    return {
        "processed": len(details),
        "sent": sum(1 for row in details if row["status"] == "sent"),
        "failed": sum(1 for row in details if row["status"] == "failed"),
        "skipped": sum(1 for row in details if row["status"] == "skipped"),
        "details": details,
    }


def _send_salesperson_outstanding_reports_background(salesperson=None):
    try:
        summary = _run_salesperson_outstanding_reports(target_salesperson=salesperson)
        frappe.log_error(
            title="Outstanding Report WhatsApp Background Summary",
            message=frappe.as_json(summary, indent=2),
        )
    except Exception:
        frappe.log_error(
            title="Outstanding Report WhatsApp Background Error",
            message=frappe.get_traceback(),
        )


def run_scheduled_salesperson_outstanding_reports():
    frappe.enqueue(
        _send_salesperson_outstanding_reports_background,
        queue="default",
        timeout=900,
        is_async=True,
        now=False,
        enqueue_after_commit=True,
    )


@frappe.whitelist()
def send_salesperson_outstanding_reports(enqueue=False, salesperson=None):
    enqueue = cint(enqueue)
    salesperson = (salesperson or "").strip()
    if enqueue:
        frappe.enqueue(
            _send_salesperson_outstanding_reports_background,
            salesperson=salesperson or None,
            queue="default",
            timeout=900,
            is_async=True,
            now=False,
            enqueue_after_commit=True,
        )
        return {
            "queued": True,
            "message": (
                f"Outstanding report send has been queued for {salesperson}."
                if salesperson
                else "Outstanding report send has been queued."
            ),
        }

    return _run_salesperson_outstanding_reports(target_salesperson=salesperson)
