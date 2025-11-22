import frappe
from whatsapp_integration.erpnext_whatsapp.custom_scripts.send_sales_order import send_sales_order_document

def send_sales_order_whatsapp(docname):
    """
    Background job that sends Sales Order via WhatsApp
    """
    try:
        send_sales_order_document(docname)
    except Exception as e:
        frappe.log_error(f"Background WhatsApp send failed for {docname}: {str(e)}", "WhatsApp Background Job")
