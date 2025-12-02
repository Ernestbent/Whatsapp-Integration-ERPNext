import frappe

@frappe.whitelist()
def create_chats_for_all_customers():
    """
    Create Whatsapp Live Chat records for all customers with a whatsapp_number.
    Uses 'whatsapp_number' as contact and 'customer_name' as contact_name.
    Skips any chat that already exists.
    """
    # Fetch only the fields we need
    customers = frappe.get_all(
        "Customer",
        filters={"whatsapp_number": ["!=", ""]},
        fields=["customer_name", "whatsapp_number"]
    )

    created_count = 0
    skipped_count = 0

    for cust in customers:
        phone = ''.join(filter(str.isdigit, cust.whatsapp_number))
        if len(phone) == 10:
            phone = '256' + phone  # Uganda country code

        # Skip if chat already exists
        exists = frappe.get_all(
            "Whatsapp Live Chat",
            filters={"contact": phone},
            fields=["name"],
            limit=1
        )
        if exists:
            skipped_count += 1
            continue

        # Insert new chat
        doc = frappe.get_doc({
            "doctype": "Whatsapp Live Chat",
            "contact": phone,
            "contact_name": cust.customer_name
        })
        doc.insert(ignore_permissions=True)
        created_count += 1

    return {"created": created_count, "skipped": skipped_count}
