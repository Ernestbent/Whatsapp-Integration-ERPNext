from datetime import datetime, timedelta
from unittest import TestCase
from unittest.mock import Mock, patch

import frappe

from whatsapp_integration.erpnext_whatsapp.custom_scripts import stock_alerts


class TestStockAlertState(TestCase):
	def test_calculation_excludes_returns_and_uses_selected_warehouse(self):
		settings = frappe._dict(
			{
				"analysis_period": 30,
				"top_selling_items": 100,
				"daily_average_threshold": 5,
				"stock_days_threshold": 7,
				"critical_stock_days": 3,
				"warehouse": "Main Loc - APL",
				"include_zero_stock": 1,
			}
		)
		top_items = [
			frappe._dict(
				item_code="ITEM-001",
				item_name="Brake Pad",
				total_sold=300,
			)
		]

		database = Mock()
		database.sql.return_value = top_items
		database.get_value.return_value = 20
		with (
			patch.object(stock_alerts.frappe, "db", database),
			patch.object(stock_alerts, "today", return_value="2026-09-22"),
		):
			alerts = stock_alerts._calculate_alerts(settings)

		query, values = database.sql.call_args.args[:2]
		self.assertIn("IFNULL(dn.is_return, 0) = 0", query)
		self.assertIn("dni.warehouse = %(warehouse)s", query)
		self.assertEqual(values["warehouse"], "Main Loc - APL")
		self.assertEqual(alerts[0]["status"], "CRITICAL")
		self.assertEqual(alerts[0]["days_remaining"], 2)

	def test_active_alert_is_not_sent_again(self):
		settings = frappe._dict(
			{
				"name": "SETTINGS-1",
				"whatsapp_template": "stock_alert",
				"reciepients": [frappe._dict(whatsapp_number="0757 001 909")],
			}
		)
		alerts = [
			{
				"item_code": "ITEM-001",
				"item_name": "Brake Pad",
				"warehouse": "Main Loc - APL",
				"status": "LOW",
				"current_stock": 0,
				"recovery_stock_qty": 70,
			}
		]

		database = Mock()
		database.get_value.return_value = "stock_alert"
		with (
			patch.object(stock_alerts.frappe, "db", database),
			patch.object(stock_alerts, "_notification_is_active", return_value=True),
			patch.object(stock_alerts, "send_whatsapp_template_message") as send,
		):
			result = stock_alerts._send_pending_alerts(settings, alerts)

		send.assert_not_called()
		self.assertEqual(result, {"sent": 0, "skipped": 1, "failed": []})

	def test_recovered_stock_rearms_the_alert(self):
		settings = frappe._dict(name="SETTINGS-1", warehouse="Main Loc - APL")
		states = [
			frappe._dict(
				name="STATE-1",
				item_code="ITEM-001",
				recovery_stock_qty=70,
			)
		]
		database = Mock()
		database.exists.return_value = True
		database.get_value.return_value = 80

		with (
			patch.object(stock_alerts.frappe, "db", database),
			patch.object(stock_alerts.frappe, "get_all", return_value=states),
		):
			stock_alerts._clear_recovered_states(settings, current_alerts=[])

		database.set_value.assert_called_once_with(
			stock_alerts.STATE_DOCTYPE,
			"STATE-1",
			{"active": 0, "alert_status": ""},
			update_modified=False,
		)

	def test_stock_alert_template_sends_document_report_for_low_stock(self):
		settings = frappe._dict(
			{
				"name": "SETTINGS-1",
				"warehouse": "Main Loc - APL",
				"whatsapp_template": "stock_alert",
				"reciepients": [
					frappe._dict(person="Stock Manager", whatsapp_number="0757001909")
				],
			}
		)
		alerts = [
			{
				"item_code": "ITEM-001",
				"item_name": "Brake Pad",
				"warehouse": "Main Loc - APL",
				"status": "LOW",
				"current_stock": 10,
				"daily_average": 5,
				"days_remaining": 2,
				"recovery_stock_qty": 70,
			}
		]
		database = Mock()
		database.get_value.return_value = "stock_alert"

		with (
			patch.object(stock_alerts.frappe, "db", database),
			patch.object(stock_alerts, "_notification_is_active", return_value=False),
			patch.object(stock_alerts, "_mark_notification_sent") as mark_sent,
			patch.object(
				stock_alerts,
				"_create_stock_alert_report",
				return_value=frappe._dict(file_url="/private/files/stock-alert.pdf"),
			),
			patch.object(
				stock_alerts,
				"upload_whatsapp_template_media",
				return_value={"id": "media-1", "filename": "stock-alert.pdf"},
			),
			patch.object(
				stock_alerts,
				"send_whatsapp_template_message",
				return_value={"success": True},
			) as send,
		):
			result = stock_alerts._send_pending_alerts(settings, alerts)

		send.assert_called_once_with(
			phone="256757001909",
			template_name="stock_alert",
			parameters={"recipient_name": "Stock Manager"},
			document_url="/private/files/stock-alert.pdf",
			media_id="media-1",
			media_filename="stock-alert.pdf",
		)
		mark_sent.assert_called_once_with(settings, alerts[0], "256757001909")
		self.assertEqual(result, {"sent": 1, "skipped": 0, "failed": []})

	def test_phone_normalization_makes_state_key_stable(self):
		local_key = stock_alerts._state_key(
			"SETTINGS-1", "Main Loc - APL", "ITEM-001", "0757 001 909"
		)
		international_key = stock_alerts._state_key(
			"SETTINGS-1", "Main Loc - APL", "ITEM-001", "+256757001909"
		)
		self.assertEqual(local_key, international_key)

	def test_send_time_is_checked_by_hour(self):
		current_time = datetime(2026, 9, 22, 8, 0, 0)
		self.assertTrue(
			stock_alerts._send_time_is_due(timedelta(hours=8), current_time)
		)
		self.assertFalse(
			stock_alerts._send_time_is_due(timedelta(hours=9), current_time)
		)
