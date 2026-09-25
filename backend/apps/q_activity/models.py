from django.conf import settings
from django.db import models

from apps.q_core.models import UUIDModel


class ActivityLog(UUIDModel):
    """
    Append-only audit log.

    - `user` is nullable so logs survive user deletion (SET_NULL).
    - `action` is a short namespaced key like "survey.published".
    - `object_type` / `object_id` reference the affected entity (not a FK —
      we want the log to survive even if the target row is deleted).
    - `metadata` holds structured extras (ids, diffs, ...).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="activity_logs",
    )
    action = models.CharField(max_length=128, db_index=True)
    object_type = models.CharField(max_length=64, db_index=True)
    object_id = models.CharField(max_length=64, blank=True)
    description = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "q_activity_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["object_type", "object_id"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self):
        who = self.user.email if self.user_id else "system"
        return f"[{self.created_at:%Y-%m-%d %H:%M}] {who} {self.action}"