import frappe
from frappe import enqueue
from whatsapp_integration.erpnext_whatsapp.whatsapp_utils import send_text_message, send_location_message

def get_customer_phone(customer_name):
    """
    Get WhatsApp number from Customer doctype
    """
    if not customer_name:
        return None
    customer = frappe.get_doc("Customer", customer_name)
    phone = getattr(customer, "whatsapp_number", None)
    if phone:
        return ''.join(filter(str.isdigit, phone))
    return None

def enqueue_whatsapp(to, message=None, location=False, latitude=None, longitude=None, name=None, address=None):
    """
    Enqueue WhatsApp message
    """
    if location:
        enqueue(method=send_location_message, queue='long', timeout=300, to=to,
                latitude=latitude, longitude=longitude, name=name, address=address)
    else:
        enqueue(method=send_text_message, queue='long', timeout=300, to=to, message=message)

# Notification functions
def send_order_confirmation(doc, method):
    phone = get_customer_phone(doc.customer)
    if not phone:
        frappe.msgprint(f"Customer {doc.customer} has no WhatsApp number", indicator="red")
        return

    message = f"""
Hello 👋!
Your order {doc.name} has been confirmed.

Customer: {doc.customer}
Total Amount: {doc.currency} {doc.grand_total:,.2f}
Delivery Date: {doc.delivery_date or 'TBD'}

Thank you for your business!
    """.strip()

    enqueue_whatsapp(to=phone, message=message)
    doc.add_comment("Comment", f"WhatsApp notification enqueued for order {doc.name}")


def send_invoice_notification(doc, method):
    phone = get_customer_phone(doc.customer)
    if not phone:
        frappe.msgprint(f"Customer {doc.customer} has no WhatsApp number", indicator="red")
        return

    message = f"""
Hello 👋!
Invoice {doc.name} has been generated.

Customer: {doc.customer}
Amount Due: {doc.currency} {doc.outstanding_amount:,.2f}
Due Date: {doc.due_date or 'TBD'}

Please make payment at your earliest convenience.
    """.strip()

    enqueue_whatsapp(to=phone, message=message)
    doc.add_comment("Comment", f"WhatsApp invoice enqueued for {doc.name}")


def send_delivery_notification(doc, method):
    phone = get_customer_phone(doc.customer)
    if not phone:
        frappe.msgprint(f"Customer {doc.customer} has no WhatsApp number", indicator="red")
        return

    message = f"""
Hello 👋!
Your order has been dispatched!

Delivery Note: {doc.name}
Customer: {doc.customer}
Items: {len(doc.items)} item(s)

Your delivery is on the way.
    """.strip()

    enqueue_whatsapp(to=phone, message=message)
    doc.add_comment("Comment", f"WhatsApp delivery notification enqueued for {doc.name}")


def send_delivery_location(doc, method):
    phone = get_customer_phone(doc.customer)
    if not phone:
        frappe.msgprint(f"Customer {doc.customer} has no WhatsApp number", indicator="red")
        return

    enqueue_whatsapp(to=phone, message=None, location=True,
                     latitude=0.367648, longitude=32.5661245,
                     name="Autozone Professional Ltd",
                     address="Opposite, Mbogo Junior College, Mbogo Rd, Kampala")

    doc.add_comment("Comment", f"WhatsApp delivery location enqueued for {doc.name}")


def send_payment_notification(doc, method):
    phone = get_customer_phone(doc.party_name or doc.customer)
    if not phone:
        frappe.msgprint("Customer has no WhatsApp number", indicator="red")
        return

    message = f"""
Hello 👋!
Your payment has been received/processed.

Payment Entry: {doc.name}
Customer: {doc.party_name or doc.customer or 'N/A'}
Payment Type: {doc.payment_type}
Amount: {doc.paid_amount} 
Payment Date: {doc.posting_date}

Thank you for your prompt payment!
    """.strip()

    enqueue_whatsapp(to=phone, message=message)
    doc.add_comment("Comment", f"WhatsApp payment notification enqueued for {doc.name}")
