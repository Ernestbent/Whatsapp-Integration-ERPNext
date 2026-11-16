from unittest import TestCase
from unittest.mock import MagicMock, patch

import frappe

from whatsapp_integration.erpnext_whatsapp.custom_scripts import (
    central_sales_order_notifications as notification,
)


class TestSalesOrderNotificationRouting(TestCase):
    def setUp(self):
        config = patch.object(notification.frappe, "conf", frappe._dict())
        config.start()
        self.addCleanup(config.stop)

    def order(self, central=False, **values):
        doc = frappe._dict(
            name="SO-NOTIFICATION-TEST",
            owner="rhoda@autozonepro.org" if central else "other-sales@example.com",
            customer="Test Customer",
            docstatus=1,
            workflow_state="Approved",
        )
        doc.update(values)
        return doc

    def test_central_order_has_one_generic_boss_notification_and_two_central_recipients(self):
        self.assertEqual(
            notification._get_recipient_templates(self.order(central=True)),
            {
                "256750229862": "central_sales_order",
                "256758116526": "central_sales_order",
                "256755829642": "all_sales_orders",
            },
        )

    def test_other_region_order_only_goes_to_boss(self):
        self.assertEqual(
            notification._get_recipient_templates(self.order()),
            {"256755829642": "all_sales_orders"},
        )

    def test_test_recipient_override_replaces_boss_in_every_region(self):
        notification.frappe.conf.whatsapp_test_recipient = "+256 700 000 001"
        for central in (True, False):
            with self.subTest(central=central):
                recipients = notification._get_recipient_templates(self.order(central=central))
                self.assertNotIn("256755829642", recipients)
                self.assertEqual(recipients["256700000001"], "all_sales_orders")

    def test_override_matching_existing_recipient_is_deduplicated(self):
        notification.frappe.conf.whatsapp_test_recipient = "+256750229862"
        recipients = notification._get_recipient_templates(self.order(central=True))
        self.assertEqual(len(recipients), 2)
        self.assertEqual(recipients["256750229862"], "all_sales_orders")

    def test_existing_workflow_rules_apply_to_all_regions(self):
        with patch.object(notification, "_recipient_already_sent", return_value=False):
            for central in (True, False):
                for state in ("Pending Credit Approval", "Approved"):
                    with self.subTest(central=central, state=state):
                        self.assertTrue(notification._should_notify(self.order(central, workflow_state=state)))
                for values in ({"docstatus": 0}, {"docstatus": 2}, {"workflow_state": "Draft"}):
                    with self.subTest(central=central, values=values):
                        self.assertFalse(notification._should_notify(self.order(central, **values)))

    def test_submit_and_update_hooks_enqueue_other_region_orders(self):
        with (
            patch.object(notification, "_recipient_already_sent", return_value=False),
            patch.object(notification, "_enqueue_central_sales_order") as enqueue,
        ):
            for hook in (
                notification.on_central_sales_order_submit,
                notification.on_central_sales_order_update_after_submit,
            ):
                doc = self.order()
                hook(doc)
                enqueue.assert_called_with(doc)
            self.assertEqual(enqueue.call_count, 2)

    def test_worker_routes_orders_and_does_not_resend_on_retry(self):
        for central in (True, False):
            with self.subTest(central=central):
                doc = self.order(central=central)
                sent = set()

                def send(phone, pdf, parameters, template_name):
                    sent.add(phone)
                    return {"success": True}

                with (
                    patch.object(notification.frappe, "cache", MagicMock()),
                    patch.object(notification.frappe, "get_doc", side_effect=lambda doctype, name: doc),
                    patch.object(notification.frappe, "log_error") as log_error,
                    patch.object(notification, "_build_template_parameters", return_value={}),
                    patch.object(notification, "_create_sales_order_pdf") as create_pdf,
                    patch.object(notification, "_recipient_already_sent", side_effect=lambda doc, phone: phone in sent),
                    patch.object(notification, "_send_template", side_effect=send) as send_template,
                ):
                    notification.send_central_sales_order_async(doc.name)
                    notification.send_central_sales_order_async(doc.name)
                    expected = notification._get_recipient_templates(doc)
                    self.assertEqual(send_template.call_count, len(expected))
                    self.assertEqual(
                        {call.args[0]: call.kwargs["template_name"] for call in send_template.call_args_list},
                        expected,
                    )
                    create_pdf.assert_called_once_with(doc)
                    self.assertEqual(log_error.call_count, 1)  # Existing success log only.

    def test_retry_only_sends_to_previously_failed_recipient(self):
        with patch.object(
            notification, "_recipient_already_sent", side_effect=lambda doc, phone: phone != "256758116526"
        ):
            self.assertEqual(
                notification._get_pending_recipient_numbers(self.order(central=True)),
                {"256758116526"},
            )
            self.assertTrue(notification._all_recipients_sent(self.order()))

    def test_worker_skips_cancelled_order(self):
        with (
            patch.object(notification.frappe, "cache", MagicMock()),
            patch.object(notification.frappe, "get_doc", return_value=self.order(docstatus=2)),
            patch.object(notification, "_create_sales_order_pdf") as create_pdf,
            patch.object(notification, "_send_template") as send_template,
        ):
            notification.send_central_sales_order_async("SO-NOTIFICATION-TEST")
            create_pdf.assert_not_called()
            send_template.assert_not_called()

    def test_both_templates_send_pdf_and_five_positional_parameters(self):
        parameters = {"1": "Ernest", "2": "Ben", "3": "12", "4": "3", "5": "150,000"}
        pdf = frappe._dict(file_name="SalesOrder_SO-TEST.pdf", file_url="/files/SalesOrder_SO-TEST.pdf")
        response = MagicMock(status_code=200)
        response.json.return_value = {"messages": [{"id": "test-message"}]}
        for template_name, heading in (
            ("central_sales_order", "New Sales Order for *Central Region*"),
            ("all_sales_orders", "New Sales Order"),
        ):
            with (
                self.subTest(template_name=template_name),
                patch.object(notification, "_get_whatsapp_credentials", return_value=("test-token", "test-id")),
                patch.object(notification, "_upload_media", return_value="test-media"),
                patch.object(notification.requests, "post", return_value=response) as post,
                patch.object(notification.frappe, "get_doc") as get_doc,
                patch.object(notification.frappe, "get_meta", return_value=MagicMock()),
                patch.object(notification.frappe, "db", MagicMock()),
                patch.object(notification.frappe.utils, "now_datetime", return_value=MagicMock()),
            ):
                result = notification._send_template("0755829642", pdf, parameters, template_name)
                self.assertTrue(result["success"])
                payload = post.call_args.kwargs["json"]
                self.assertEqual(payload["to"], "256755829642")
                self.assertEqual(payload["template"]["name"], template_name)
                header, body = payload["template"]["components"]
                self.assertEqual(
                    header["parameters"][0]["document"],
                    {"id": "test-media", "filename": pdf.file_name},
                )
                self.assertEqual([p["text"] for p in body["parameters"]], list(parameters.values()))
                self.assertEqual(get_doc.call_args.args[0]["message"].splitlines()[0], heading)

        self.assertEqual(notification._get_template().template_name, "central_sales_order")
