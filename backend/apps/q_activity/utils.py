from .models import ActivityLog


def log_activity(user, action, obj=None, description="", metadata=None):
    """
    Append a single activity row.

    - `user` may be None (system) or an AnonymousUser — both become NULL.
    - `obj` is optional; if given, its class name and id are stored.
    - Never raises: audit logging must not break the caller's transaction.
    """
    try:
        return ActivityLog.objects.create(
            user=user if (user and getattr(user, "is_authenticated", False)) else None,
            action=action,
            object_type=obj.__class__.__name__ if obj is not None else "",
            object_id=str(getattr(obj, "id", "")) if obj is not None else "",
            description=description,
            metadata=metadata or {},
        )
    except Exception:
        # Silently swallow — audit log must never break the main flow.
        return None