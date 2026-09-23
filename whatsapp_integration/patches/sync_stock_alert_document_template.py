from whatsapp_integration.patches.register_stock_alert_templates import TEMPLATES, upsert_template


def execute():
	stock_alert = next(
		values for values in TEMPLATES if values["template_name"] == "stock_alert"
	)
	upsert_template(stock_alert)
