# Copyright (c) 2026, Autozone Professional Limited and contributors
# For license information, please see license.txt

import json
import re

import frappe
from frappe.model.document import Document
from frappe import _

from whatsapp_integration.erpnext_whatsapp.custom_scripts.send_message_templates import (
	send_whatsapp_carousel_template_message,
	send_whatsapp_template_message,
	upload_whatsapp_template_media,
)


CAROUSEL_TEMPLATE_NAME = "product_carousel"
CAROUSEL_MAX_CARDS = 10
PRODUCT_CAROUSEL_CARD_COUNT = 10


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
	if doc.get("is_carousel") and (template.template_name or "").lower() != CAROUSEL_TEMPLATE_NAME:
		frappe.throw(_("Carousel broadcasts require the {0} template.").format(CAROUSEL_TEMPLATE_NAME))

	if (
		(template.format or "").lower() in ("image", "video", "documentation")
		and not doc.get("is_carousel")
		and not doc.attach_blia
	):
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


def _format_carousel_price(rate):
	rate = frappe.utils.flt(rate)
	if rate == int(rate):
		return f"{int(rate):,}"
	return f"{rate:,.2f}".rstrip("0").rstrip(".")


def _parse_list(value):
	if isinstance(value, str):
		value = frappe.parse_json(value)
	return list(dict.fromkeys(value or []))


def _get_carousel_item_data(item_codes, price_list=None):
	item_codes = _parse_list(item_codes)
	price_list = price_list or frappe.db.get_single_value("Selling Settings", "selling_price_list")
	if not price_list:
		price_list = "Standard Selling"
	if not item_codes:
		return {"items": [], "skipped": [], "price_list": price_list, "currency": ""}
	if len(item_codes) > CAROUSEL_MAX_CARDS:
		frappe.throw(_("Select no more than {0} carousel items.").format(CAROUSEL_MAX_CARDS))
	price_list_details = frappe.db.get_value(
		"Price List", price_list, ["enabled", "selling"], as_dict=True
	)
	if not price_list_details or not price_list_details.enabled or not price_list_details.selling:
		frappe.throw(_("Select an enabled selling Price List."))

	items = frappe.get_all(
		"Item",
		filters={"name": ["in", item_codes], "disabled": 0},
		fields=["name", "item_name", "image", "stock_uom"],
		limit_page_length=0,
	)
	item_by_code = {item.name: item for item in items}
	file_urls = list({item.image for item in items if item.image})
	available_files = set(frappe.get_all(
		"File",
		filters={"file_url": ["in", file_urls]},
		pluck="file_url",
		limit_page_length=0,
	)) if file_urls else set()
	prices = frappe.get_all(
		"Item Price",
		filters={
			"item_code": ["in", item_codes],
			"price_list": price_list,
			"selling": 1,
		},
		fields=[
			"item_code", "uom", "price_list_rate", "currency", "valid_from", "valid_upto",
			"customer", "batch_no", "modified",
		],
		order_by="valid_from desc, modified desc",
		limit_page_length=0,
	)

	today = frappe.utils.getdate()
	prices_by_item = {}
	for price in prices:
		if price.customer or price.batch_no:
			continue
		if price.valid_from and frappe.utils.getdate(price.valid_from) > today:
			continue
		if price.valid_upto and frappe.utils.getdate(price.valid_upto) < today:
			continue
		prices_by_item.setdefault(price.item_code, []).append(price)

	result = []
	skipped = []
	for item_code in item_codes:
		item = item_by_code.get(item_code)
		if not item:
			skipped.append({"item_code": item_code, "reason": _("Item is missing or disabled")})
			continue
		if not item.image:
			skipped.append({"item_code": item_code, "reason": _("Item has no image")})
			continue
		if item.image not in available_files:
			skipped.append({
				"item_code": item_code,
				"reason": _("Item image is not stored in File Manager"),
			})
			continue

		candidates = prices_by_item.get(item_code, [])
		price = next((row for row in candidates if row.uom == item.stock_uom), None)
		price = price or next((row for row in candidates if not row.uom), None)
		price = price or (candidates[0] if candidates else None)
		if not price:
			skipped.append({
				"item_code": item_code,
				"reason": _("No active price in {0}").format(price_list),
			})
			continue

		result.append({
			"item_code": item.name,
			"item_name": item.item_name or item.name,
			"image": item.image,
			"price_list_rate": frappe.utils.flt(price.price_list_rate),
			"price_text": _format_carousel_price(price.price_list_rate),
			"currency": price.currency or "UGX",
			"uom": price.uom or item.stock_uom,
		})

	currency = result[0]["currency"] if result else ""
	return {"items": result, "skipped": skipped, "price_list": price_list, "currency": currency}


def _get_saved_carousel_items(doc):
	try:
		items = json.loads(doc.carousel_items or "[]")
	except (TypeError, ValueError):
		frappe.throw(_("The saved carousel item data is invalid."))
	if len(items) != PRODUCT_CAROUSEL_CARD_COUNT:
		frappe.throw(
			_("The approved {0} template requires exactly {1} products.").format(
				CAROUSEL_TEMPLATE_NAME, PRODUCT_CAROUSEL_CARD_COUNT
			)
		)
	return items


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
		fields=["name", "customer_name", "whatsapp_number", "region", "district", "location"],
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
def get_carousel_items(item_codes, price_list=None):
	"""Return Item images and active selling prices in the requested card order."""
	frappe.has_permission("Item", "read", throw=True)
	frappe.has_permission("Item Price", "read", throw=True)
	return _get_carousel_item_data(item_codes, price_list)


@frappe.whitelist()
def get_carousel_settings():
	frappe.has_permission("Item", "read", throw=True)
	frappe.has_permission("Price List", "read", throw=True)
	default_price_list = frappe.db.get_single_value("Selling Settings", "selling_price_list") or "Standard Selling"
	price_lists = frappe.get_all(
		"Price List",
		filters={"selling": 1, "enabled": 1},
		fields=["name", "currency"],
		order_by="name asc",
		limit_page_length=0,
	)
	return {"default_price_list": default_price_list, "price_lists": price_lists}


@frappe.whitelist()
def create_and_enqueue_broadcast(
	campaign_name,
	template_name,
	customer_names,
	document_url=None,
	carousel_item_codes=None,
	price_list=None,
):
	frappe.has_permission("BroadCast Message", "create", throw=True)
	customer_names = _parse_list(customer_names)
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

	carousel_item_codes = _parse_list(carousel_item_codes)
	is_carousel = bool(carousel_item_codes)
	carousel_data = None
	if is_carousel:
		if (template.template_name or "").lower() != CAROUSEL_TEMPLATE_NAME:
			frappe.throw(
				_("The selected products can only be sent with the approved {0} template.").format(
					CAROUSEL_TEMPLATE_NAME
				)
			)
		if len(carousel_item_codes) != PRODUCT_CAROUSEL_CARD_COUNT:
			frappe.throw(
				_("The approved {0} template requires exactly {1} products.").format(
					CAROUSEL_TEMPLATE_NAME, PRODUCT_CAROUSEL_CARD_COUNT
				)
			)
		carousel_data = _get_carousel_item_data(carousel_item_codes, price_list)
		if carousel_data["skipped"]:
			details = "; ".join(
				f"{row['item_code']}: {row['reason']}" for row in carousel_data["skipped"]
			)
			frappe.throw(_("Some products cannot be sent: {0}").format(details))
		if len(carousel_data["items"]) != len(carousel_item_codes):
			frappe.throw(_("Could not load every selected carousel product."))
	elif (template.template_name or "").lower() == CAROUSEL_TEMPLATE_NAME:
		frappe.throw(
			_("Select exactly {0} products for the approved carousel.").format(
				PRODUCT_CAROUSEL_CARD_COUNT
			)
		)

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

	content_type = "Image" if is_carousel else {
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
		"attach_blia": carousel_data["items"][0]["image"] if is_carousel else document_url,
		"is_carousel": is_carousel,
		"carousel_price_list": carousel_data["price_list"] if is_carousel else None,
		"carousel_items": frappe.as_json(carousel_data["items"]) if is_carousel else None,
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
		carousel_items = []
		if doc.get("is_carousel"):
			carousel_items = _get_saved_carousel_items(doc)
			for card in carousel_items:
				uploaded = upload_whatsapp_template_media(card["image"])
				card["media_id"] = uploaded["id"]
		elif (template.format or "").lower() in ("image", "video", "documentation"):
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

		try:
			if doc.get("is_carousel"):
				result = send_whatsapp_carousel_template_message(
					phone=normalized_phone,
					template_name=template.template_name,
					cards=carousel_items,
					customer=row.customer,
				)
			else:
				parameters = _get_template_parameters(template.body_text or "", doc, row, customer)
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
