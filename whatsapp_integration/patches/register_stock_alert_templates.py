import frappe


TEMPLATES = (
	{
		"template_name": "stock_alert",
		"id": "1064557409725509",
		"category": "marketing",
		"language": "en",
		"status": "Approved",
		"parameter_format": "named",
		"format": "documentation",
		"body_text": (
			"⚠️ *Stock Alert*\n\n"
			"Hi {{recipient_name}},\n\n"
			"Some of our top-selling items are currently out of stock or projected "
			"to run low based on recent average daily sales.\n\n"
			"Please see the attached stock alert report for details.\n\n"
			"Thank you."
		),
		"body_parameters": (
			("recipient_name", "manager"),
		),
	},
	{
		"template_name": "new_stock_alert",
		"id": "962488042966668",
		"category": "marketing",
		"language": "en",
		"status": "Approved",
		"parameter_format": "named",
		"format": "image",
		"body_text": (
			"📦 New Stock Just Arrived!\n\n"
			"Hi {{customer_name}},\n\n"
			"We just received fresh stock of {{product_name}}\n\n"
			"Don't miss out"
		),
		"body_parameters": (
			("customer_name", "Francis Auto Parts"),
			("product_name", "Rear Shock Absorber"),
		),
	},
)


def upsert_template(values):
	docname = frappe.db.exists(
		"Whatsapp Message Template", {"template_name": values["template_name"]}
	) or frappe.db.exists("Whatsapp Message Template", {"id": values["id"]})
	doc = (
		frappe.get_doc("Whatsapp Message Template", docname)
		if docname
		else frappe.new_doc("Whatsapp Message Template")
	)
	doc.update({key: value for key, value in values.items() if key != "body_parameters"})
	doc.set("body_parameters", [])
	for parameter_name, example_value in values["body_parameters"]:
		doc.append("body_parameters", {
			"parameter_name": parameter_name,
			"example_value": example_value,
		})
	doc.save(ignore_permissions=True)


def execute():
	"""Register the approved Meta stock-alert templates in the local template DocType."""
	for values in TEMPLATES:
		upsert_template(values)
