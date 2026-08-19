# Copyright (c) 2026, Autozone Professional Limited and contributors
# For license information, please see license.txt

import re

import frappe
from frappe.model.document import Document
from frappe import _

from whatsapp_integration.erpnext_whatsapp.custom_scripts.send_message_templates import (
	send_whatsapp_template_message,
	upload_whatsapp_template_media,
)


class BroadCastMessage(Document):
	pass


def _get_template_name(doc):
	if not doc.name1:
		frappe.throw(_("Please select a WhatsApp Message Template."))

	template_name = frappe.db.get_value("Whatsapp Message Template", doc.name1, "template_name")
	if not template_name:
		frappe.throw(_("Template name is missing for {0}.").format(doc.name1))

	return template_name


def _get_template(doc):
	template_name = _get_template_name(doc)
	template = frappe.db.get_value(
		"Whatsapp Message Template",
		{"template_name": template_name},
		["template_name", "status", "format", "body_text"],
		as_dict=True,
	)

	if not template or template.status != "Approved":
		frappe.throw(_("Template {0} must be approved before sending.").format(template_name))

	if (template.format or "").lower() in ("image", "video", "documentation") and not doc.attach_blia:
		frappe.throw(_("Please upload the media required by template {0}.").format(template_name))

	return template


def _get_customer_details(row):
	if not row.customer:
		return {}

	return frappe.db.get_value(
		"Customer",
		row.customer,
		["name", "customer_name", "whatsapp_number", "custom_opt_in", "disabled"],
		as_dict=True,
	) or {}


def _get_phone(row, customer):
	return row.phone_number or customer.get("whatsapp_number")


def _get_template_parameters(body_text, doc, row, customer):
	parameter_names = [param.strip() for param in re.findall(r"\{\{([^}]+)\}\}", body_text)]

	customer_name = customer.get("customer_name") or row.customer or ""
	values = {
		"customer": row.customer or "",
		"customer_name": customer_name,
		"name": customer_name,
		"phone": _get_phone(row, customer) or "",
		"phone_number": _get_phone(row, customer) or "",
		"whatsapp_number": _get_phone(row, customer) or "",
		"broadcast_name": doc.broadcast_name or doc.name,
		"campaign_name": doc.broadcast_name or doc.name,
		"description": doc.description or "",
	}
	unsupported = [parameter_name for parameter_name in parameter_names if parameter_name not in values]
	if unsupported:
		frappe.throw(
			_("Unsupported template parameter(s): {0}").format(", ".join(unsupported))
		)

	return {parameter_name: values[parameter_name] for parameter_name in parameter_names}


def _normalize_phone(phone):
	phone = re.sub(r"\D", "", phone or "")
	if phone.startswith("0"):
		phone = phone[1:]
	if phone and not phone.startswith("256"):
		phone = "256" + phone
	return phone


def _is_valid_phone(phone):
	return phone.startswith("256") and len(phone) == 12


@frappe.whitelist()
def get_eligible_customers():
	frappe.has_permission("Customer", "read", throw=True)
	customers = frappe.get_all(
		"Customer",
		filters={
			"disabled": 0,
			"custom_opt_in": 1,
			"whatsapp_number": ["is", "set"],
		},
		fields=["name", "customer_name", "whatsapp_number"],
		order_by="customer_name asc",
	)

	eligible = []
	seen_phones = set()
	for customer in customers:
		normalized_phone = _normalize_phone(customer.whatsapp_number)
		if not _is_valid_phone(normalized_phone) or normalized_phone in seen_phones:
			continue
		seen_phones.add(normalized_phone)
		eligible.append(customer)

	return {"customers": eligible, "count": len(eligible)}


@frappe.whitelist()
def create_and_enqueue_broadcast(campaign_name, template_name, customer_names, document_url=None):
	frappe.has_permission("BroadCast Message", "create", throw=True)
	customer_names = frappe.parse_json(customer_names) if isinstance(customer_names, str) else customer_names
	customer_names = list(dict.fromkeys(customer_names or []))
	if not customer_names:
		frappe.throw(_("Select at least one customer."))

	template = frappe.db.get_value(
		"Whatsapp Message Template",
		{"template_name": template_name},
		["name", "template_name", "status", "format"],
		as_dict=True,
	)
	if not template or template.status != "Approved":
		frappe.throw(_("Select an approved WhatsApp template."))

	customers = frappe.get_all(
		"Customer",
		filters={
			"name": ["in", customer_names],
			"disabled": 0,
			"custom_opt_in": 1,
			"whatsapp_number": ["is", "set"],
		},
		fields=["name", "customer_name", "whatsapp_number"],
	)
	eligible = []
	seen_phones = set()
	for customer in customers:
		normalized_phone = _normalize_phone(customer.whatsapp_number)
		if not _is_valid_phone(normalized_phone) or normalized_phone in seen_phones:
			continue
		seen_phones.add(normalized_phone)
		eligible.append(customer)

	if not eligible:
		frappe.throw(_("The selected group has no eligible WhatsApp recipients."))

	content_type = {
		"documentation": "Document",
		"image": "Image",
		"video": "Video",
	}.get((template.format or "").lower(), "Document")
	doc = frappe.get_doc({
		"doctype": "BroadCast Message",
		"broadcast_name": campaign_name or template.template_name,
		"description": _("Created from Whatsapp BroadCast page"),
		"enabled": 1,
		"content_type": content_type,
		"attach_blia": document_url,
		"name1": template.name,
		"recipient_count": len(eligible),
		"send_status": "Draft",
	})
	for customer in eligible:
		doc.append("customers", {
			"customer": customer.name,
			"phone_number": customer.whatsapp_number,
		})
	doc.insert()

	result = enqueue_broadcast(doc.name)
	result.update({
		"docname": doc.name,
		"recipient_count": len(eligible),
		"excluded_count": len(customer_names) - len(eligible),
	})
	return result


@frappe.whitelist()
def enqueue_broadcast(docname):
	doc = frappe.get_doc("BroadCast Message", docname)
	doc.check_permission("write")

	if doc.is_new():
		frappe.throw(_("Please save the broadcast before sending."))

	if not doc.enabled:
		frappe.throw(_("Please enable this broadcast before sending."))

	template = _get_template(doc)
	recipients = [row for row in doc.customers if row.customer or row.phone_number]
	if not recipients:
		frappe.throw(_("Add at least one customer before sending."))

	job_id = f"whatsapp-broadcast-{doc.name}"
	from frappe.utils.background_jobs import is_job_enqueued
	if is_job_enqueued(job_id):
		frappe.throw(_("This broadcast is already queued or sending."))

	frappe.enqueue(
		"whatsapp_integration.erpnext_whatsapp.doctype.broadcast_message.broadcast_message.send_broadcast",
		queue="long",
		timeout=1500,
		job_id=job_id,
		deduplicate=True,
		enqueue_after_commit=True,
		docname=doc.name,
	)
	frappe.db.set_value(
		"BroadCast Message",
		doc.name,
		{
			"send_status": "Queued",
			"recipient_count": len(recipients),
			"queued_on": frappe.utils.now(),
			"completed_on": None,
			"sent_count": 0,
			"failed_count": 0,
			"skipped_count": 0,
		},
		update_modified=False,
	)

	return {
		"success": True,
		"message": _("Broadcast queued for {0} customer(s) using template {1}.").format(
			len(recipients),
			template.template_name,
		),
	}


def send_broadcast(docname):
	doc = frappe.get_doc("BroadCast Message", docname)
	if not doc.enabled:
		frappe.throw(_("This broadcast was disabled before sending started."))
	frappe.db.set_value("BroadCast Message", doc.name, "send_status", "Sending", update_modified=False)
	try:
		template = _get_template(doc)
		media = None
		if (template.format or "").lower() in ("image", "video", "documentation"):
			media = upload_whatsapp_template_media(doc.attach_blia)
	except Exception:
		frappe.db.set_value(
			"BroadCast Message",
			doc.name,
			{"send_status": "Failed", "completed_on": frappe.utils.now()},
			update_modified=False,
		)
		raise

	sent = 0
	failed = []
	skipped = []
	seen_phones = set()

	for row in doc.customers:
		customer = _get_customer_details(row)
		if not customer:
			skipped.append(f"{row.customer or row.idx} (customer not found)")
			continue
		if customer.get("disabled"):
			skipped.append(f"{row.customer} (disabled)")
			continue
		if not customer.get("custom_opt_in"):
			skipped.append(f"{row.customer} (not opted in)")
			continue
		phone = _get_phone(row, customer)

		if not phone:
			skipped.append(row.customer or row.idx)
			continue
		normalized_phone = _normalize_phone(phone)
		if not _is_valid_phone(normalized_phone):
			skipped.append(f"{row.customer} (invalid WhatsApp number)")
			continue
		if normalized_phone in seen_phones:
			skipped.append(f"{row.customer or row.idx} (duplicate phone)")
			continue
		seen_phones.add(normalized_phone)

		parameters = _get_template_parameters(template.body_text or "", doc, row, customer)
		try:
			result = send_whatsapp_template_message(
				phone=normalized_phone,
				template_name=template.template_name,
				parameters=parameters,
				customer=row.customer,
				document_url=doc.attach_blia,
				media_id=media and media["id"],
				media_filename=media and media["filename"],
			)
		except Exception as exc:
			result = {"success": False, "error": str(exc)}

		if result.get("success"):
			sent += 1
		else:
			failed.append({
				"customer": row.customer,
				"phone": phone,
				"error": result.get("error"),
			})

	if failed or skipped:
		frappe.log_error(
			title=_("WhatsApp Broadcast Completed With Issues"),
			message=frappe.as_json({
				"broadcast": doc.name,
				"sent": sent,
				"failed": failed,
				"skipped": skipped,
			}, indent=2),
		)

	frappe.db.set_value(
		"BroadCast Message",
		doc.name,
		{
			"send_status": "Completed with issues" if failed or skipped else "Completed",
			"completed_on": frappe.utils.now(),
			"sent_count": sent,
			"failed_count": len(failed),
			"skipped_count": len(skipped),
		},
		update_modified=False,
	)

	return {"sent": sent, "failed": failed, "skipped": skipped}
