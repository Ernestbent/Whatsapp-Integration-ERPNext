import hashlib
import re
from contextlib import suppress
from datetime import timedelta

import frappe
from frappe.utils import add_days, cint, flt, now_datetime, today

from whatsapp_integration.erpnext_whatsapp.custom_scripts.send_message_templates import (
	send_whatsapp_template_message,
)


SETTINGS_DOCTYPE = "Stock Alert Settings"
STATE_DOCTYPE = "Stock Alert State"
SEND_LOCK_TIMEOUT = 60 * 30


def _get_enabled_settings(settings_name=None):
	"""Return one enabled settings document in a deterministic way."""
	if not frappe.db.exists("DocType", SETTINGS_DOCTYPE):
		return None

	filters = {"enable_stock_alerts": 1}
	if settings_name:
		filters["name"] = settings_name

	settings_rows = frappe.get_all(
		SETTINGS_DOCTYPE,
		filters=filters,
		fields=["name"],
		order_by="creation asc",
		limit=2,
	)
	if not settings_rows:
		return None

	if len(settings_rows) > 1 and not settings_name:
		frappe.logger().warning(
			"Stock Alert: Multiple enabled settings records found; using %s.",
			settings_rows[0].name,
		)

	return frappe.get_doc(SETTINGS_DOCTYPE, settings_rows[0].name)


def _calculate_alerts(settings):
	analysis_period = max(cint(settings.analysis_period or 30), 1)
	top_selling_items = max(cint(settings.top_selling_items or 100), 1)
	daily_average_threshold = max(flt(settings.daily_average_threshold), 0)
	stock_days_threshold = max(flt(settings.stock_days_threshold or 7), 0)
	critical_stock_days = min(
		max(flt(settings.critical_stock_days or 3), 0),
		stock_days_threshold,
	)
	warehouse = settings.warehouse
	include_zero_stock = cint(settings.include_zero_stock)

	if not warehouse:
		frappe.log_error(
			"Warehouse is not configured in Stock Alert Settings.",
			"Stock Alert Configuration Error",
		)
		return []

	end_date = today()
	# Both endpoints are inclusive, so a 30-day period begins 29 days ago.
	start_date = add_days(end_date, 1 - analysis_period)

	# Returns are explicitly excluded. Sales are restricted to the warehouse
	# whose current Bin quantity is used below, so demand and stock have the
	# same scope and unit of measure.
	top_items = frappe.db.sql(
		"""
		SELECT
			dni.item_code,
			MAX(dni.item_name) AS item_name,
			SUM(dni.stock_qty) AS total_sold
		FROM `tabDelivery Note Item` dni
		INNER JOIN `tabDelivery Note` dn
			ON dn.name = dni.parent
		WHERE
			dn.docstatus = 1
			AND IFNULL(dn.is_return, 0) = 0
			AND dn.posting_date >= %(start_date)s
			AND dn.posting_date <= %(end_date)s
			AND dni.warehouse = %(warehouse)s
			AND dni.item_code IS NOT NULL
			AND dni.stock_qty > 0
		GROUP BY
			dni.item_code
		HAVING
			total_sold > 0
		ORDER BY
			total_sold DESC
		LIMIT %(top_selling_items)s
		""",
		{
			"start_date": start_date,
			"end_date": end_date,
			"warehouse": warehouse,
			"top_selling_items": top_selling_items,
		},
		as_dict=True,
	)

	alerts = []
	for item in top_items:
		total_sold = flt(item.total_sold)
		daily_average = total_sold / analysis_period

		if daily_average < daily_average_threshold:
			continue

		current_stock = flt(
			frappe.db.get_value(
				"Bin",
				{"item_code": item.item_code, "warehouse": warehouse},
				"actual_qty",
			)
		)
		if current_stock <= 0 and not include_zero_stock:
			continue

		days_remaining = 0 if current_stock <= 0 else current_stock / daily_average
		if days_remaining <= critical_stock_days:
			status = "CRITICAL"
		elif days_remaining <= stock_days_threshold:
			status = "LOW"
		else:
			continue

		alerts.append(
			{
				"item_code": item.item_code,
				"item_name": item.item_name,
				"warehouse": warehouse,
				"total_sold": round(total_sold, 2),
				"daily_average": round(daily_average, 2),
				"current_stock": round(current_stock, 2),
				"days_remaining": round(days_remaining, 2),
				"recovery_stock_qty": round(daily_average * stock_days_threshold, 2),
				"status": status,
			}
		)

	alerts.sort(key=lambda row: row["days_remaining"])
	return alerts


def check_fast_moving_stock(settings_name=None):
	"""Calculate current fast-moving stock alerts without sending messages."""
	settings = _get_enabled_settings(settings_name)
	if not settings:
		frappe.logger().info("Stock Alert: No enabled Stock Alert Settings found.")
		return []

	alerts = _calculate_alerts(settings)
	frappe.logger().info(
		"Stock Alert: Found %s items requiring attention for %s.",
		len(alerts),
		settings.name,
	)
	return alerts


def _normalize_phone(phone):
	digits = re.sub(r"\D", "", str(phone or ""))
	if digits.startswith("0"):
		digits = digits[1:]
	if digits and not digits.startswith("256"):
		digits = f"256{digits}"
	return digits


def _get_recipient_numbers(settings):
	# The existing custom field is misspelled as `reciepients`; also accept the
	# corrected spelling so the code keeps working after that field is cleaned up.
	rows = settings.get("reciepients") or settings.get("recipients") or []
	return sorted(
		{
			phone
			for row in rows
			if (phone := _normalize_phone(row.get("whatsapp_number")))
		}
	)


def _state_key(settings_name, warehouse, item_code, phone):
	value = "\0".join((settings_name, warehouse, item_code, _normalize_phone(phone)))
	return hashlib.sha256(value.encode()).hexdigest()


def _notification_is_active(settings, alert, phone):
	return bool(
		frappe.db.exists(
			STATE_DOCTYPE,
			{
				"state_key": _state_key(
					settings.name,
					alert["warehouse"],
					alert["item_code"],
					phone,
				),
				"active": 1,
			},
		)
	)


def _mark_notification_sent(settings, alert, phone):
	state_key = _state_key(
		settings.name,
		alert["warehouse"],
		alert["item_code"],
		phone,
	)
	values = {
		"settings_name": settings.name,
		"item_code": alert["item_code"],
		"warehouse": alert["warehouse"],
		"whatsapp_number": _normalize_phone(phone),
		"active": 1,
		"alert_status": alert["status"],
		"recovery_stock_qty": alert["recovery_stock_qty"],
		"last_notified_on": now_datetime(),
	}

	state_name = frappe.db.exists(STATE_DOCTYPE, {"state_key": state_key})
	if state_name:
		frappe.db.set_value(STATE_DOCTYPE, state_name, values, update_modified=False)
	else:
		frappe.get_doc(
			{
				"doctype": STATE_DOCTYPE,
				"state_key": state_key,
				**values,
			}
		).insert(ignore_permissions=True)

	# Persist immediately after a confirmed WhatsApp send. This keeps an error
	# on a later recipient from causing already-sent messages to be repeated.
	frappe.db.commit()


def _clear_recovered_states(settings, current_alerts):
	"""Re-arm an item only after stock has recovered above its alert quantity."""
	if not frappe.db.exists("DocType", STATE_DOCTYPE):
		return

	current_item_codes = {alert["item_code"] for alert in current_alerts}
	active_states = frappe.get_all(
		STATE_DOCTYPE,
		filters={
			"settings_name": settings.name,
			"warehouse": settings.warehouse,
			"active": 1,
		},
		fields=["name", "item_code", "recovery_stock_qty"],
	)
	stock_by_item = {}

	for state in active_states:
		# If it is still an alert, it is the same shortage episode.
		if state.item_code in current_item_codes:
			continue

		if state.item_code not in stock_by_item:
			stock_by_item[state.item_code] = flt(
				frappe.db.get_value(
					"Bin",
					{"item_code": state.item_code, "warehouse": settings.warehouse},
					"actual_qty",
				)
			)

		if stock_by_item[state.item_code] > flt(state.recovery_stock_qty):
			frappe.db.set_value(
				STATE_DOCTYPE,
				state.name,
				{"active": 0, "alert_status": ""},
				update_modified=False,
			)


def _send_time_is_due(send_time, current_time=None):
	current_time = current_time or now_datetime()
	if isinstance(send_time, timedelta):
		send_hour = send_time.seconds // 3600
	elif hasattr(send_time, "hour"):
		send_hour = send_time.hour
	else:
		with suppress(ValueError, TypeError):
			send_hour = int(str(send_time or "08:00:00").split(":", 1)[0])
			return current_time.hour == send_hour
		return False
	return current_time.hour == send_hour


def _send_pending_alerts(settings, alerts):
	recipients = _get_recipient_numbers(settings)
	if not recipients:
		frappe.log_error(
			f"No WhatsApp recipients are configured in {SETTINGS_DOCTYPE} {settings.name}.",
			"Stock Alert Configuration Error",
		)
		return {"sent": 0, "skipped": 0, "failed": []}

	template_name = settings.whatsapp_template
	if template_name:
		template_name = (
			frappe.db.get_value("Whatsapp Message Template", template_name, "template_name")
			or template_name
		)
	if not template_name:
		frappe.log_error(
			f"No WhatsApp template is configured in {SETTINGS_DOCTYPE} {settings.name}.",
			"Stock Alert Configuration Error",
		)
		return {"sent": 0, "skipped": 0, "failed": []}

	sent = 0
	skipped = 0
	failed = []
	for alert in alerts:
		for phone in recipients:
			# The approved `stock_alert` template explicitly says the item is out
			# of stock. Do not use it for LOW/CRITICAL items that still have stock.
			if template_name == "stock_alert" and flt(alert["current_stock"]) > 0:
				skipped += 1
				continue

			if _notification_is_active(settings, alert, phone):
				skipped += 1
				continue

			try:
				result = send_whatsapp_template_message(
					phone=phone,
					template_name=template_name,
					parameters={
						"item_name": alert["item_name"],
						"item_code": alert["item_code"],
					},
				)
			except Exception:
				result = {"success": False, "error": frappe.get_traceback()}

			if result.get("success"):
				_mark_notification_sent(settings, alert, phone)
				sent += 1
			else:
				error = result.get("error") or "Unknown WhatsApp send error"
				failed.append({"item_code": alert["item_code"], "phone": phone, "error": error})

	if failed:
		frappe.log_error(
			"\n".join(
				f"{row['item_code']} -> {row['phone']}: {row['error']}" for row in failed
			),
			"Stock Alert WhatsApp Send",
		)

	return {"sent": sent, "skipped": skipped, "failed": failed}


def run_stock_alert_notifications(force=False):
	"""Scheduled entry point: calculate, de-duplicate and send stock alerts."""
	settings = _get_enabled_settings()
	if not settings or not frappe.db.exists("DocType", STATE_DOCTYPE):
		return {"sent": 0, "skipped": 0, "failed": []}

	lock = frappe.cache.lock(
		f"stock-alert-notifications:{settings.name}",
		timeout=SEND_LOCK_TIMEOUT,
		blocking=False,
	)
	if not lock.acquire(blocking=False):
		frappe.logger().info("Stock Alert: A notification run is already in progress.")
		return {"sent": 0, "skipped": 0, "failed": []}

	try:
		alerts = _calculate_alerts(settings)
		_clear_recovered_states(settings, alerts)
		if not force and not _send_time_is_due(settings.send_time):
			return {"sent": 0, "skipped": 0, "failed": []}
		return _send_pending_alerts(settings, alerts)
	finally:
		with suppress(Exception):
			lock.release()
