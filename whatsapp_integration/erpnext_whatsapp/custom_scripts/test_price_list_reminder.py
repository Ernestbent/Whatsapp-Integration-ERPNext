# Copyright (c) 2026, Autozone Professional Limited and contributors
# See license.txt

from unittest import TestCase
from unittest.mock import MagicMock, patch

import frappe

from whatsapp_integration.erpnext_whatsapp.custom_scripts import price_list_reminder


class TestPriceListReminder(TestCase):
	def test_current_price_rows_include_all_enabled_items(self):
		rows = [
			frappe._dict(item_code="ITEM-1", uom="Nos", currency="UGX", price_list_rate=120),
			frappe._dict(item_code="ITEM-2", uom="Box", currency="UGX", price_list_rate=1000),
		]

		database = MagicMock()
		database.get_single_value.return_value = "UGX"
		database.sql.return_value = rows
		with patch.object(price_list_reminder.frappe, "db", database):
			result = price_list_reminder._get_current_price_rows()

		self.assertEqual(len(result), 2)
		self.assertEqual(result[0].price_list_rate, 120)
		self.assertEqual(result[1].item_code, "ITEM-2")
		database.sql.assert_called_once()
		self.assertEqual(database.sql.call_args.args[1], {"currency": "UGX"})

	def test_whatsapp_notification_uses_positional_parameters(self):
		response = MagicMock()
		response.status_code = 200
		response.json.return_value = {"messages": [{"id": "wamid.test"}]}

		with (
			patch.object(
				price_list_reminder,
				"_get_whatsapp_credentials",
				return_value=("token", "phone-id", "v24.0"),
			),
			patch.object(price_list_reminder.requests, "post", return_value=response) as post,
			patch.object(price_list_reminder, "_log_whatsapp_message", return_value="LOG-1"),
		):
			result = price_list_reminder._send_whatsapp_notification(
				"Othieno Benedict",
				"othienobenedict8@gmail.com",
				"0757001909",
			)

		payload = post.call_args.kwargs["json"]
		parameters = payload["template"]["components"][0]["parameters"]
		self.assertTrue(result["success"])
		self.assertEqual(payload["to"], "256757001909")
		self.assertEqual(payload["template"]["name"], "price_list_reminder")
		self.assertEqual(
			parameters,
			[
				{"type": "text", "text": "Othieno Benedict"},
				{"type": "text", "text": "othienobenedict8@gmail.com"},
			],
		)

	def test_email_is_sent_before_whatsapp_notification(self):
		rows = [frappe._dict(item_code="ITEM-1")]
		calls = []

		def send_email(*args):
			calls.append("email")
			return "standard-selling-price-list.xlsx"

		def send_whatsapp(*args):
			calls.append("whatsapp")
			return {
				"success": True,
				"phone": "256757001909",
				"message_id": "wamid.test",
			}

		with (
			patch.object(price_list_reminder.frappe, "only_for"),
			patch.object(
				price_list_reminder,
				"validate_email_address",
				return_value="othienobenedict8@gmail.com",
			),
			patch.object(price_list_reminder, "_get_current_price_rows", return_value=rows),
			patch.object(
				price_list_reminder,
				"_get_whatsapp_credentials",
				return_value=("token", "phone-id", "v24.0"),
			),
			patch.object(price_list_reminder, "_build_price_list_xlsx", return_value=b"xlsx"),
			patch.object(price_list_reminder, "_send_price_list_email", side_effect=send_email),
			patch.object(price_list_reminder, "_send_whatsapp_notification", side_effect=send_whatsapp),
		):
			result = price_list_reminder.send_price_list_reminder()

		self.assertEqual(calls, ["email", "whatsapp"])
		self.assertTrue(result["success"])
		self.assertEqual(result["item_count"], 1)
