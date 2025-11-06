# whatsapp_hooks.py

import frappe
from whatsapp_integration.erpnext_whatsapp.whatsapp_utils import (
    send_whatsapp_text,
    send_whatsapp_document,
    send_whatsapp_location
)

def send_sales_invoice_whatsapp(doc, method):
    """
    This function is called by Frappe on Sales Invoice submit.
    It sends a WhatsApp text, PDF, and location to a hardcoded number.
    """
    to_number = "256757001909"  # Hardcoded recipient

    # 1. Send text
    message = (
        "👋 Hello! This is *Autozone Professional Ltd.*\n\n"
        "Thank you for your continued trust and support 🙏.\n"
        "You can easily reach our office using the location shared below 📍.\n\n"
        "Feel free to reach out anytime!"
    )
    send_whatsapp_text(to_number, message)

    # 2. Send PDF
    send_whatsapp_document(to_number)

    # 3. Send location
    send_whatsapp_location(to_number)
