from unittest import TestCase

from whatsapp_integration.erpnext_whatsapp.phone_utils import (
	is_supported_whatsapp_number,
	normalize_whatsapp_number,
)


class TestPhoneUtils(TestCase):
	def test_preserves_india_country_code(self):
		number = normalize_whatsapp_number("+91 76966 20071")
		self.assertEqual(number, "917696620071")
		self.assertTrue(is_supported_whatsapp_number(number))

	def test_preserves_uganda_country_code(self):
		number = normalize_whatsapp_number("+256 757 001 909")
		self.assertEqual(number, "256757001909")
		self.assertTrue(is_supported_whatsapp_number(number))

	def test_adds_uganda_code_to_local_number(self):
		self.assertEqual(normalize_whatsapp_number("0757 001 909"), "256757001909")
		self.assertEqual(normalize_whatsapp_number("757001909"), "256757001909")

	def test_does_not_guess_country_for_ten_digit_number(self):
		number = normalize_whatsapp_number("7696620071")
		self.assertEqual(number, "7696620071")
		self.assertFalse(is_supported_whatsapp_number(number))
