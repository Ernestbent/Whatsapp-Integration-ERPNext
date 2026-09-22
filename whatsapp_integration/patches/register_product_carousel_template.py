import frappe


TEMPLATE_NAME = "product_carousel"
META_TEMPLATE_ID = "1613216160434518"
BODY_TEXT = (
	"Check out our latest motorbike spare parts and prices. "
	"Swipe through the products below to see what's available."
)


def execute():
	"""Register the already-approved Meta carousel so Broadcast can select it."""
	if frappe.db.exists("Whatsapp Message Template", {"template_name": TEMPLATE_NAME}):
		return
	if frappe.db.exists("Whatsapp Message Template", {"id": META_TEMPLATE_ID}):
		return

	frappe.get_doc({
		"doctype": "Whatsapp Message Template",
		"template_name": TEMPLATE_NAME,
		"id": META_TEMPLATE_ID,
		"category": "marketing",
		"language": "en",
		"status": "Approved",
		"parameter_format": "numbered",
		"format": "image",
		"body_text": BODY_TEXT,
	}).insert(ignore_permissions=True)
