from django.conf import settings
from django.db import models

from apps.q_core.models import BaseModel


class Notification(BaseModel):
    """
    In-app notification for a single user.

    - `type` is a small enum for frontend icon/color routing.
    - `metadata` carries structured extras (deep-link ids, etc.).
    - Read state is a boolean + implicit via `is_read`.
    """

    class Type(models.TextChoices):
        ASSIGNMENT_CREATED = "ASSIGNMENT_CREATED", "Assignment created"
        REMINDER = "REMINDER", "Reminder"
        COMPLETED = "COMPLETED", "Completed"
        SYSTEM = "SYSTEM", "System"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=32, choices=Type.choices, db_index=True)
    is_read = models.BooleanField(default=False, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "q_notifications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} | {self.type} | {self.title[:40]}"