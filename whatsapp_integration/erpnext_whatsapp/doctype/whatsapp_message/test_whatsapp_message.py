# Copyright (c) 2025, Autozone Professional Limited and Contributors
# See license.txt

from unittest import TestCase
from unittest.mock import MagicMock, patch

import frappe

from whatsapp_integration.whatsapp_webhook import webhook


class TestWhatsappMessage(TestCase):
	def test_opt_in_phrase_is_detected_after_normalization(self):
		message = (
			"I would like to receive exclusive deals & order updates "
			"from Autozone Professional Limited."
		)

		self.assertTrue(webhook.check_for_optin_message(message))
		self.assertFalse(webhook.check_for_optin_message("Please send me my order update"))

	def test_customer_link_detects_opt_in_from_stored_message(self):
		message = frappe._dict(
			name="WHATSAPP-MESSAGE-0001",
			message=(
				"I would like to receive exclusive deals and order updates "
				"from Autozone Professional Limited"
			),
		)
		customer = frappe._dict(
			name="TEST-CUSTOMER",
			whatsapp_number="256700000000",
			custom_opt_in=0,
		)
		database = MagicMock()
		database.get_all.return_value = [message]
		mock_frappe = MagicMock(db=database)

		with (
			patch.object(webhook, "frappe", mock_frappe),
			patch.object(webhook, "emit_whatsapp_event"),
		):
			webhook.link_whatsapp_messages_to_customer(customer)

		database.get_all.assert_called_once()
		self.assertEqual(database.get_all.call_args.kwargs["fields"], ["name", "message"])
		database.set_value.assert_called_once_with(
			"Whatsapp Message",
			message.name,
			"customer",
			customer.name,
			update_modified=False,
		)
		database.sql.assert_called_once()
