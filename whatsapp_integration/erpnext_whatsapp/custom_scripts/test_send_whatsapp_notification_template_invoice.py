from unittest import TestCase
from unittest.mock import MagicMock, patch

import frappe

from whatsapp_integration.erpnext_whatsapp.custom_scripts import (
	send_whatsapp_notification_template_invoice as invoice_notification,
)


class TestSendWhatsappInvoiceNotification(TestCase):
	def call_send_invoice_notification(self, *args, **kwargs):
		return invoice_notification.send_invoice_notification.__wrapped__(*args, **kwargs)

	def test_return_invoice_is_not_enqueued_from_submit_hook(self):
		doc = frappe._dict(name="SINV-RETURN-1", is_return=1)

		with patch.object(invoice_notification.frappe, "enqueue") as enqueue:
			result = self.call_send_invoice_notification(doc, "on_submit")

		self.assertEqual(
			result,
			{"success": False, "skipped": True, "reason": "return_invoice"},
		)
		enqueue.assert_not_called()

	def test_return_invoice_is_not_enqueued_from_direct_call(self):
		database = MagicMock()
		database.get_value.return_value = 1
		with (
			patch.object(invoice_notification.frappe, "db", database),
			patch.object(invoice_notification.frappe, "enqueue") as enqueue,
		):
			result = self.call_send_invoice_notification(
				sales_invoice="SINV-RETURN-1"
			)

		self.assertTrue(result["skipped"])
		enqueue.assert_not_called()

	def test_standard_invoice_is_enqueued(self):
		doc = frappe._dict(name="SINV-1", is_return=0)

		with patch.object(invoice_notification.frappe, "enqueue") as enqueue:
			result = self.call_send_invoice_notification(doc, "on_submit")

		self.assertEqual(result, {"success": True})
		enqueue.assert_called_once_with(
			invoice_notification._send_invoice_whatsapp_async,
			sales_invoice="SINV-1",
			queue="default",
			timeout=300,
			is_async=True,
			now=False,
			enqueue_after_commit=True,
		)

	def test_worker_ignores_return_invoice(self):
		return_invoice = frappe._dict(name="SINV-RETURN-1", is_return=1)

		with (
			patch.object(invoice_notification.frappe, "get_doc", return_value=return_invoice) as get_doc,
			patch.object(invoice_notification.requests, "post") as post,
			patch.object(invoice_notification.frappe, "log_error") as log_error,
		):
			invoice_notification._send_invoice_whatsapp_async("SINV-RETURN-1")

		get_doc.assert_called_once_with("Sales Invoice", "SINV-RETURN-1")
		post.assert_not_called()
		log_error.assert_not_called()
