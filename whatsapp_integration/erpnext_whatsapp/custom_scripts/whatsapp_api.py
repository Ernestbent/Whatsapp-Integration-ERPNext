import frappe
from frappe import enqueue
from whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply import send_notification_message


def get_customer_phone(customer_name):
    """
    Get and format WhatsApp number from Customer doctype (Uganda: 0 → 256)
    """
    if not customer_name:
        return None

    try:
        customer = frappe.get_doc("Customer", customer_name)
    except frappe.DoesNotExistError:
        return None

    raw_phone = getattr(customer, "whatsapp_number", None)
    if not raw_phone:
        return None

    # Extract digits only
    digits = ''.join(filter(str.isdigit, raw_phone))

    # Format for Uganda (256)
    if digits.startswith("0") and len(digits) >= 10:
        formatted = "256" + digits[1:]
    elif digits.startswith("256"):
        formatted = digits
    elif len(digits) == 9:
        formatted = "256" + digits
    else:
        formatted = "256" + digits.lstrip("0")

    # Final validation: must be exactly 12 digits starting with 256
    if len(formatted) == 12 and formatted.startswith("256") and formatted.isdigit():
        return formatted
    else:
        frappe.log_error(
            f"Invalid WhatsApp number format after processing: {formatted} "
            f"(original: {raw_phone}, customer: {customer_name})",
            "WhatsApp Number Format Error"
        )
        return None


# Notification functions
def send_order_confirmation(doc, method):
    phone = get_customer_phone(doc.customer)
    if not phone:
        return

    message = (
        f"Hello 👋!\n\n"
        f"Your order *{doc.name}* has been confirmed.\n\n"
        f"Customer: {doc.customer_name or doc.customer}\n"
        f"Total Amount: {doc.currency} {doc.grand_total:,.2f}\n"
        f"Delivery Date: {doc.delivery_date or 'TBD'}\n\n"
        f"Thank you for your business!"
    )

    enqueue(
        method=send_notification_background,
        queue='long',
        timeout=300,
        phone=phone,
        message=message,
        customer_name=doc.customer,
        doc_name=doc.name,
        notification_type="order"
    )
    doc.add_comment("Comment", f"WhatsApp order confirmation enqueued for {doc.name}")


def send_invoice_notification(doc, method):
    phone = get_customer_phone(doc.customer)
    if not phone:
        return

    message = (
        f"Hello 👋!\n\n"
        f"Invoice *{doc.name}* has been generated.\n\n"
        f"Customer: {doc.customer_name or doc.customer}\n"
        f"Amount Due: {doc.currency} {doc.outstanding_amount:,.2f}\n"
        f"Due Date: {doc.due_date or 'TBD'}\n\n"
        f"Please make payment at your earliest convenience."
    )

    enqueue(
        method=send_notification_background,
        queue='long',
        timeout=300,
        phone=phone,
        message=message,
        customer_name=doc.customer,
        doc_name=doc.name,
        notification_type="invoice"
    )
    doc.add_comment("Comment", f"WhatsApp invoice notification enqueued for {doc.name}")


def send_delivery_notification(doc, method):
    phone = get_customer_phone(doc.customer)
    if not phone:
        return

    message = (
        f"Hello 👋!\n\n"
        f"Your order has been dispatched! 🚚\n\n"
        f"Delivery Note: *{doc.name}*\n"
        f"Customer: {doc.customer_name or doc.customer}\n"
        f"Items: {len(doc.items)} item(s)\n\n"
        f"Your delivery is on the way."
    )

    enqueue(
        method=send_notification_background,
        queue='long',
        timeout=300,
        phone=phone,
        message=message,
        customer_name=doc.customer,
        doc_name=doc.name,
        notification_type="delivery"
    )
    doc.add_comment("Comment", f"WhatsApp delivery notification enqueued for {doc.name}")


def send_delivery_location(doc, method):
    phone = get_customer_phone(doc.customer)
    if not phone:
        return

    message = (
        "📍 *Delivery/Pickup Location:*\n\n"
        "Autozone Professional Ltd\n"
        "Opposite Mbogo Junior College\n"
        "Mbogo Rd, Kampala\n\n"
        "We look forward to serving you!"
    )

    enqueue(
        method=send_notification_background,
        queue='long',
        timeout=300,
        phone=phone,
        message=message,
        customer_name=doc.customer,
        doc_name=doc.name,
        notification_type="location"
    )
    doc.add_comment("Comment", f"WhatsApp delivery location message enqueued for {doc.name}")


def send_payment_notification(doc, method):
    customer_name = doc.party_name or doc.customer
    phone = get_customer_phone(customer_name)
    if not phone:
        frappe.msgprint("Customer has no valid WhatsApp number", indicator="red")
        return

    message = (
        f"Hello 👋!\n\n"
        f"Your payment has been received! ✅\n\n"
        f"Payment Entry: *{doc.name}*\n"
        f"Customer: {customer_name or 'N/A'}\n"
        f"Payment Type: {doc.payment_type}\n"
        f"Amount: {doc.base_paid_amount:,.2f} {doc.currency}\n"
        f"Date: {doc.posting_date}\n\n"
        f"Thank you for your prompt payment!"
    )

    enqueue(
        method=send_notification_background,
        queue='long',
        timeout=300,
        phone=phone,
        message=message,
        customer_name=customer_name,
        doc_name=doc.name,
        notification_type="payment"
    )
    doc.add_comment("Comment", f"WhatsApp payment confirmation enqueued for {doc.name}")


def send_notification_background(phone, message, customer_name, doc_name, notification_type):
    """
    Background task to send WhatsApp notification
    """
    try:
        result = send_notification_message(to_number=phone, message_body=message, customer_name=customer_name)
        if not result.get("success"):
            frappe.log_error(
                title=f"WhatsApp {notification_type.title()} Notification Failed",
                message=f"Doc: {doc_name}\nCustomer: {customer_name}\nPhone: {phone}\nError: {result.get('error')}"
            )
    except Exception as e:
        frappe.log_error(
            title=f"WhatsApp {notification_type.title()} Notification Error",
            message=f"Doc: {doc_name}\nCustomer: {customer_name}\nPhone: {phone}\nError: {str(e)}"
        )