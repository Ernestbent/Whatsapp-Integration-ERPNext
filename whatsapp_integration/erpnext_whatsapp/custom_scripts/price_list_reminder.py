# Copyright (c) 2026, Autozone Professional Limited and contributors
# For license information, please see license.txt

import json
import re

import frappe
import requests
from frappe import _
from frappe.utils import cint, escape_html, flt, nowdate, validate_email_address
from frappe.utils.xlsxutils import make_xlsx

from whatsapp_integration.erpnext_whatsapp.phone_utils import (
	is_supported_whatsapp_number,
	normalize_whatsapp_number,
)


PRICE_LIST = "Standard Selling"
TEMPLATE_NAME = "price_list_reminder"
TEMPLATE_LANGUAGE = "en"

DEFAULT_RECIPIENT_NAME = "Othieno Benedict"
DEFAULT_RECIPIENT_EMAIL = "othienobenedict8@gmail.com"
DEFAULT_RECIPIENT_PHONE = "0757001909"

TEMPLATE_BODY = (
	"Hello {{1}},\n\n"
	"Our latest weekly price list has been sent to your email at *{{2}}*.\n\n"
	"Please check your inbox for the updated prices and stock availability.\n\n"
	"Thank you,"
)


def _get_current_price_rows(price_list=PRICE_LIST):
	"""Return every enabled Item with its standard selling rate and current stock."""
	currency = frappe.db.get_single_value("Global Defaults", "default_currency") or "UGX"
	return frappe.db.sql(
		"""
		SELECT
			i.name AS item_code,
			i.item_name,
			i.brand,
			i.stock_uom AS uom,
			COALESCE(i.standard_rate, 0) AS price_list_rate,
			%(currency)s AS currency,
			COALESCE(stock.actual_qty, 0) AS available_qty
		FROM `tabItem` i
		LEFT JOIN (
			SELECT item_code, SUM(actual_qty) AS actual_qty
			FROM `tabBin`
			GROUP BY item_code
		) stock ON stock.item_code = i.name
		WHERE i.disabled = 0
		ORDER BY i.name
		""",
		{"currency": currency},
		as_dict=True,
	)


def _build_price_list_xlsx(rows, price_list=PRICE_LIST):
	data = [
		[
			"Item Code",
			"Item Name",
			"Brand",
			"UOM",
			"Standard Selling Rate",
			"Currency",
			"Current Stock",
		]
	]
	for row in rows:
		data.append(
			[
				row.item_code,
				row.item_name or row.item_code,
				row.brand or "",
				row.uom or "",
				flt(row.price_list_rate),
				row.currency or "",
				flt(row.available_qty),
			]
		)

	return make_xlsx(
		data,
		price_list,
		column_widths=[18, 38, 20, 12, 22, 12, 18],
	).getvalue()


def _send_price_list_email(recipient_name, recipient_email, rows, xlsx_content):
	filename = f"standard-selling-price-list-{nowdate()}.xlsx"
	frappe.sendmail(
		recipients=[recipient_email],
		subject=_("Latest Standard Selling Price List"),
		message=_(
			"""
			<p>Hello {0},</p>
			<p>Please find our latest <strong>Standard Selling</strong> price list attached.</p>
			<p>The workbook contains {1} current item price(s) and their available stock.</p>
			<p>Thank you.</p>
			"""
		).format(escape_html(recipient_name), len(rows)),
		attachments=[
			{
				"fname": filename,
				"fcontent": xlsx_content,
				"content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}
		],
		delayed=False,
	)
	return filename


def _get_whatsapp_credentials():
	settings = frappe.get_single("Whatsapp Setting")
	access_token = settings.get_password("access_token") or settings.get("access_token")
	phone_number_id = settings.get("phone_number_id")
	api_version = str(settings.get("app_version") or "v24.0").strip()
	if not api_version.startswith("v"):
		api_version = f"v{api_version}"

	if not access_token or not phone_number_id:
		frappe.throw(_("Missing Access Token or Phone Number ID in WhatsApp Settings"))

	return access_token, phone_number_id, api_version


def _render_template_message(recipient_name, recipient_email):
	return TEMPLATE_BODY.replace("{{1}}", recipient_name).replace("{{2}}", recipient_email)


def _log_whatsapp_message(phone, message, message_id):
	log = frappe.get_doc(
		{
			"doctype": "Whatsapp Message",
			"from_number": phone,
			"message_type": "template",
			"custom_status": "Outgoing",
			"message": message,
			"message_status": "sent",
			"message_id": message_id,
			"timestamp": frappe.utils.now_datetime().strftime("%H:%M:%S"),
		}
	)
	log.insert(ignore_permissions=True)
	return log.name


def _send_whatsapp_notification(recipient_name, recipient_email, recipient_phone):
	phone = normalize_whatsapp_number(recipient_phone)
	if not is_supported_whatsapp_number(phone):
		frappe.throw(_("Invalid WhatsApp number. Use a Uganda (+256) or India (+91) number."))

	access_token, phone_number_id, api_version = _get_whatsapp_credentials()
	template_code = re.sub(r"[^a-z0-9_]", "_", TEMPLATE_NAME.lower())
	payload = {
		"messaging_product": "whatsapp",
		"to": phone,
		"type": "template",
		"template": {
			"name": template_code,
			"language": {"code": TEMPLATE_LANGUAGE},
			"components": [
				{
					"type": "body",
					"parameters": [
						{"type": "text", "text": recipient_name},
						{"type": "text", "text": recipient_email},
					],
				}
			],
		},
	}

	try:
		response = requests.post(
			f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages",
			headers={
				"Authorization": f"Bearer {access_token}",
				"Content-Type": "application/json",
			},
			json=payload,
			timeout=30,
		)
		result = response.json()
	except (requests.RequestException, ValueError) as exc:
		frappe.log_error(
			title="Price List Reminder WhatsApp Error",
			message=f"Phone: {phone}\nError: {exc}",
		)
		return {"success": False, "error": str(exc)}

	if response.status_code != 200 or not result.get("messages"):
		error = result.get("error", {}).get("message", str(result))
		frappe.log_error(
			title="Price List Reminder WhatsApp Failed",
			message=(
				f"Phone: {phone}\nError: {error}\n"
				f"Payload: {json.dumps(payload, indent=2)}\n"
				f"Response: {json.dumps(result, indent=2)}"
			),
		)
		return {"success": False, "error": error}

	message_id = result["messages"][0]["id"]
	log_name = _log_whatsapp_message(
		phone,
		_render_template_message(recipient_name, recipient_email),
		message_id,
	)
	return {
		"success": True,
		"phone": phone,
		"message_id": message_id,
		"log_name": log_name,
	}


def _send_price_list_reminder(
	recipient_name=DEFAULT_RECIPIENT_NAME,
	recipient_email=DEFAULT_RECIPIENT_EMAIL,
	recipient_phone=DEFAULT_RECIPIENT_PHONE,
):
	recipient_name = str(recipient_name or "").strip()
	recipient_email = validate_email_address(recipient_email, throw=True)
	recipient_phone = str(recipient_phone or "").strip()

	if not recipient_name:
		frappe.throw(_("Recipient name is required."))

	rows = _get_current_price_rows()
	if not rows:
		frappe.throw(_("No enabled Items were found for the Standard Selling price list."))

	# Validate WhatsApp configuration before sending the email. The notification
	# itself still runs only after the synchronous email send succeeds.
	_get_whatsapp_credentials()
	xlsx_content = _build_price_list_xlsx(rows)
	filename = _send_price_list_email(recipient_name, recipient_email, rows, xlsx_content)

	# This deliberately happens after the synchronous email send above.
	whatsapp_result = _send_whatsapp_notification(
		recipient_name,
		recipient_email,
		recipient_phone,
	)
	if not whatsapp_result.get("success"):
		frappe.throw(
			_("Price list email was sent, but the WhatsApp notification failed: {0}").format(
				whatsapp_result.get("error") or _("Unknown error")
			)
		)

	return {
		"success": True,
		"recipient_name": recipient_name,
		"recipient_email": recipient_email,
		"recipient_phone": whatsapp_result["phone"],
		"price_list": PRICE_LIST,
		"item_count": len(rows),
		"attachment": filename,
		"whatsapp_message_id": whatsapp_result["message_id"],
	}


@frappe.whitelist()
def send_price_list_reminder(
	recipient_name=DEFAULT_RECIPIENT_NAME,
	recipient_email=DEFAULT_RECIPIENT_EMAIL,
	recipient_phone=DEFAULT_RECIPIENT_PHONE,
):
	"""Manually email the workbook, then send its WhatsApp reminder."""
	frappe.only_for("System Manager")
	return _send_price_list_reminder(
		recipient_name=recipient_name,
		recipient_email=recipient_email,
		recipient_phone=recipient_phone,
	)


def run_scheduled_price_list_reminder():
	"""Weekly scheduler entry point with optional site_config recipient overrides."""
	if cint(frappe.conf.get("disable_price_list_reminder")):
		return {"success": False, "skipped": True, "reason": "disabled"}

	return _send_price_list_reminder(
		recipient_name=frappe.conf.get("price_list_reminder_recipient_name")
		or DEFAULT_RECIPIENT_NAME,
		recipient_email=frappe.conf.get("price_list_reminder_recipient_email")
		or DEFAULT_RECIPIENT_EMAIL,
		recipient_phone=frappe.conf.get("price_list_reminder_recipient_phone")
		or DEFAULT_RECIPIENT_PHONE,
	)
