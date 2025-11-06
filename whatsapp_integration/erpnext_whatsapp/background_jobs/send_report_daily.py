import frappe
from frappe.utils import nowdate

def send_general_ledger_email():
    today = nowdate()

    sender_email = frappe.db.get_value(
        "Email Account", {"default_outgoing": 1}, "email_id"
    ) or "othienobenedict8@gmail.com"

    recipients = ["othienobenedict8@gmail.com"]

    filters = {
        "company": "Your Company Name",  # Replace with actual company
        "from_date": today,
        "to_date": today
    }

    # Attach PDF of General Ledger
    attachment = frappe.attach_print(
        doctype="Report",
        name="General Ledger",
        file_name=f"General Ledger - {today}",
        print_format="Standard",
        filters=filters
    )

    frappe.sendmail(
        recipients=recipients,
        sender=sender_email,
        subject=f"General Ledger - {today}",
        message=f"Hello,<br><br>Please find attached the <b>General Ledger</b> for {today}.<br><br>Regards,<br>ERPNext System",
        attachments=[attachment]
    )
