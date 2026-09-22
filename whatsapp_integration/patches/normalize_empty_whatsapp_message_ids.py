import frappe


def execute():
    """Allow a unique index while retaining multiple legacy rows without IDs."""
    frappe.db.sql(
        """
        UPDATE `tabWhatsapp Message`
        SET message_id = NULL
        WHERE TRIM(COALESCE(message_id, '')) = ''
        """
    )
