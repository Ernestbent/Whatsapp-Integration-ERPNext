import json

import frappe


REACTION_ACTORS = {"me", "contact"}


def parse_reactions(raw_value=None, legacy_emoji=None, legacy_actor=None):
    """Return a normalized list containing at most one current reaction per actor."""
    parsed = []
    if raw_value:
        try:
            parsed = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
        except (TypeError, ValueError):
            parsed = []

    if isinstance(parsed, dict):
        parsed = [{"from": actor, "emoji": emoji} for actor, emoji in parsed.items()]
    if not isinstance(parsed, list):
        parsed = []

    by_actor = {}
    for reaction in parsed:
        if not isinstance(reaction, dict):
            continue
        actor = reaction.get("from")
        emoji = reaction.get("emoji")
        if actor in REACTION_ACTORS and emoji:
            by_actor[actor] = {"from": actor, "emoji": str(emoji)}

    if not by_actor and legacy_emoji:
        actor = legacy_actor if legacy_actor in REACTION_ACTORS else "contact"
        by_actor[actor] = {"from": actor, "emoji": str(legacy_emoji)}

    return list(by_actor.values())


def update_message_reaction(message_name, actor, emoji):
    """Add, replace, or remove one actor's reaction while retaining other actors."""
    if actor not in REACTION_ACTORS:
        raise ValueError(f"Unsupported reaction actor: {actor}")

    current = frappe.db.get_value(
        "Whatsapp Message",
        message_name,
        ["custom_reactions", "custom_reaction", "custom_reaction_from"],
        as_dict=True,
    )
    if not current:
        raise frappe.DoesNotExistError(f"Whatsapp Message {message_name} was not found")

    reactions = parse_reactions(
        current.custom_reactions,
        current.custom_reaction,
        current.custom_reaction_from,
    )
    reactions = [reaction for reaction in reactions if reaction["from"] != actor]
    if emoji:
        reactions.append({"from": actor, "emoji": str(emoji)})

    latest = reactions[-1] if reactions else {"emoji": "", "from": ""}
    frappe.db.set_value(
        "Whatsapp Message",
        message_name,
        {
            "custom_reactions": json.dumps(reactions, ensure_ascii=False),
            # Retain these fields for old clients while plural state is rolled out.
            "custom_reaction": latest["emoji"],
            "custom_reaction_from": latest["from"],
        },
        update_modified=False,
    )
    return reactions
