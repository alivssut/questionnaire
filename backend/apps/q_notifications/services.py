from .models import Notification


# Map notification type → preference key
TYPE_TO_PREF = {
    "ASSIGNMENT_CREATED": "assignments",
    "REMINDER": "reminders",
    "COMPLETED": "completions",
    # SYSTEM is always delivered
}


def notify_user(*, user, title, message, type, metadata=None, force=False):
    """
    Create an in-app notification for a user.
    Respects the user's notification preferences unless `force=True`.
    """
    try:
        if not force:
            prefs = getattr(user, "notification_preferences", None) or {}
            pref_key = TYPE_TO_PREF.get(type)
            if pref_key and not prefs.get(pref_key, True):
                return None

        return Notification.objects.create(
            user=user, title=title, message=message, type=type, metadata=metadata or {},
        )
    except Exception:
        return None


def notify_many(*, users, title, message, type, metadata=None, force=False):
    if not users:
        return 0

    pref_key = TYPE_TO_PREF.get(type)
    allowed = []
    for u in users:
        if force or not pref_key:
            allowed.append(u)
            continue
        prefs = getattr(u, "notification_preferences", None) or {}
        if prefs.get(pref_key, True):
            allowed.append(u)

    if not allowed:
        return 0

    Notification.objects.bulk_create([
        Notification(user=u, title=title, message=message, type=type, metadata=metadata or {})
        for u in allowed
    ])
    return len(allowed)