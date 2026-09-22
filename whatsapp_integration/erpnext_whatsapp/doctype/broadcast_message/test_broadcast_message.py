# Copyright (c) 2026, Autozone Professional Limited and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from whatsapp_integration.erpnext_whatsapp.custom_scripts.send_message_templates import (
	build_whatsapp_carousel_component,
)
from whatsapp_integration.erpnext_whatsapp.doctype.broadcast_message.broadcast_message import (
	_format_carousel_price,
)


class TestBroadCastMessage(FrappeTestCase):
	def test_carousel_price_format(self):
		self.assertEqual(_format_carousel_price(25000), "25,000")
		self.assertEqual(_format_carousel_price(12.5), "12.5")

	def test_carousel_component_uses_positional_name_and_price(self):
		component = build_whatsapp_carousel_component([
			{
				"media_id": "media-one",
				"item_code": "ITEM-001",
				"item_name": "Air Filter",
				"price_text": "25,000",
			},
			{
				"media_id": "media-two",
				"item_code": "ITEM-002",
				"item_name": "Brake Shoe",
				"price_text": "30,000",
			},
		])

		self.assertEqual(component["type"], "carousel")
		self.assertEqual(component["cards"][0]["card_index"], 0)
		self.assertEqual(
			component["cards"][0]["components"][0]["parameters"][0]["image"]["id"],
			"media-one",
		)
		self.assertEqual(
			component["cards"][0]["components"][1]["parameters"],
			[
				{"type": "text", "text": "Air Filter"},
				{"type": "text", "text": "25,000"},
			],
		)

	def test_carousel_requires_at_least_two_cards(self):
		with self.assertRaises(frappe.ValidationError):
			build_whatsapp_carousel_component([{
				"media_id": "media-one",
				"item_name": "Only one",
				"price_text": "1,000",
			}])
