import json

import frappe


def execute():
    meta = frappe.get_meta("Whatsapp Message")
    if not meta.has_field("custom_reactions"):
        return

    rows = frappe.get_all(
        "Whatsapp Message",
        fields=["name", "custom_reaction", "custom_reaction_from", "custom_reactions"],
        filters={"custom_reaction": ["!=", ""]},
        limit_page_length=0,
    )
    for row in rows:
        if row.custom_reactions or not row.custom_reaction:
            continue
        actor = row.custom_reaction_from if row.custom_reaction_from in {"me", "contact"} else "contact"
        frappe.db.set_value(
            "Whatsapp Message",
            row.name,
            "custom_reactions",
            json.dumps([{"from": actor, "emoji": row.custom_reaction}], ensure_ascii=False),
            update_modified=False,
        )
