import frappe


TEMPLATES = (
	{
		"template_name": "stock_alert",
		"id": "1064557409725509",
		"category": "utility",
		"language": "en",
		"status": "Approved",
		"parameter_format": "named",
		"format": "text",
		"body_text": (
			"*Stock Alert*\n\n"
			"The following item is now out of stock:\n\n"
			"*Item:* {{item_name}}\n"
			"*Item Code:* {{item_code}}\n\n"
			"Please take note and plan accordingly."
		),
		"body_parameters": (
			("item_name", "Endurance=Rear Shocker Absorber=BM100KS"),
			("item_code", "S130107701"),
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


def execute():
	"""Register the approved Meta stock-alert templates in the local template DocType."""
	for values in TEMPLATES:
		if frappe.db.exists(
			"Whatsapp Message Template", {"template_name": values["template_name"]}
		):
			continue
		if frappe.db.exists("Whatsapp Message Template", {"id": values["id"]}):
			continue

		doc = frappe.get_doc({
			"doctype": "Whatsapp Message Template",
			**{key: value for key, value in values.items() if key != "body_parameters"},
		})
		for parameter_name, example_value in values["body_parameters"]:
			doc.append("body_parameters", {
				"parameter_name": parameter_name,
				"example_value": example_value,
			})
		doc.insert(ignore_permissions=True)
