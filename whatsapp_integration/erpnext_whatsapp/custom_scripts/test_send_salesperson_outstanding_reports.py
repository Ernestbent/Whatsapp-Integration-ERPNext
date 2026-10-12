from unittest import TestCase

from whatsapp_integration.erpnext_whatsapp.custom_scripts.send_salesperson_outstanding_reports import (
    _assign_invoice_to_salespeople,
)


def _invoice(outstanding, salespeople):
    return {
        "outstanding_amount": outstanding,
        "sales_people": set(salespeople),
    }


class TestAssignOutstandingInvoice(TestCase):
    def test_assigns_full_outstanding_to_the_listed_salesperson(self):
        invoice = _invoice(outstanding=80_000, salespeople=["Moses"])

        self.assertEqual(
            _assign_invoice_to_salespeople(invoice),
            {"Moses": 80_000},
        )

    def test_does_not_assign_a_settled_invoice(self):
        invoice = _invoice(outstanding=0, salespeople=["Moses"])

        self.assertEqual(_assign_invoice_to_salespeople(invoice), {})

    def test_assigns_invoice_to_every_listed_salesperson_without_splitting(self):
        invoice = _invoice(outstanding=80_000, salespeople=["Moses", "Jolie"])

        self.assertEqual(
            _assign_invoice_to_salespeople(invoice),
            {"Moses": 80_000, "Jolie": 80_000},
        )
