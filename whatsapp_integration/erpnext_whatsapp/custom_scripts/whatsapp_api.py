import frappe
from frappe import enqueue
from whatsapp_integration.erpnext_whatsapp.custom_scripts.send_reply import send_notification_message

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

# Notification functions
def send_order_confirmation(doc, method):
    phone = get_customer_phone(doc.customer)
    if not phone:
        return
    
    message = f"Hello 👋!\n\nYour order {doc.name} has been confirmed.\n\nCustomer: {doc.customer}\nTotal Amount: {doc.currency} {doc.grand_total:,.2f}\nDelivery Date: {doc.delivery_date or 'TBD'}\n\nThank you for your business!"
    
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
    doc.add_comment("Comment", f"WhatsApp notification enqueued for order {doc.name}")

def send_invoice_notification(doc, method):
    phone = get_customer_phone(doc.customer)
    if not phone:
        return
    
    message = f"Hello 👋!\n\nInvoice {doc.name} has been generated.\n\nCustomer: {doc.customer}\nAmount Due: {doc.currency} {doc.outstanding_amount:,.2f}\nDue Date: {doc.due_date or 'TBD'}\n\nPlease make payment at your earliest convenience."
    
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
    
    message = f"Hello 👋!\n\nYour order has been dispatched!\n\nDelivery Note: {doc.name}\nCustomer: {doc.customer}\nItems: {len(doc.items)} item(s)\n\nYour delivery is on the way."
    
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
    
    message = "📍 Delivery Location:\n\nAutozone Professional Ltd\nOpposite, Mbogo Junior College, Mbogo Rd, Kampala"
    
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
    doc.add_comment("Comment", f"WhatsApp delivery location enqueued for {doc.name}")

def send_payment_notification(doc, method):
    phone = get_customer_phone(doc.party_name or doc.customer)
    if not phone:
        frappe.msgprint("Customer has no WhatsApp number", indicator="red")
        return
    
    message = f"Hello 👋!\n\nYour payment has been received/processed.\n\nPayment Entry: {doc.name}\nCustomer: {doc.party_name or doc.customer or 'N/A'}\nPayment Type: {doc.payment_type}\nAmount: {doc.paid_amount}\nPayment Date: {doc.posting_date}\n\nThank you for your prompt payment!"
    
    enqueue(
        method=send_notification_background,
        queue='long',
        timeout=300,
        phone=phone,
        message=message,
        customer_name=doc.party_name or doc.customer,
        doc_name=doc.name,
        notification_type="payment"
    )
    doc.add_comment("Comment", f"WhatsApp payment notification enqueued for {doc.name}")

def send_notification_background(phone, message, customer_name, doc_name, notification_type):
    """
    Background task to send WhatsApp notification
    """
    try:
        result = send_notification_message(to_number=phone, message_body=message, customer_name=customer_name)
        
        if not result.get("success"):
            frappe.log_error(
                title=f"WhatsApp {notification_type.title()} Notification Failed",
                message=f"Doc: {doc_name}\nCustomer: {customer_name}\nError: {result.get('error')}"
            )
    except Exception as e:
        frappe.log_error(
            title=f"WhatsApp {notification_type.title()} Notification Error",
            message=f"Doc: {doc_name}\nCustomer: {customer_name}\nError: {str(e)}"
        )