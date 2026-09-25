from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.q_core.models import BaseModel
from apps.q_surveys.models import Survey


class SurveyAssignmentQuerySet(models.QuerySet):
    def mark_overdue(self):
        """Bulk-update OVERDUE for past-due PENDING/IN_PROGRESS rows."""
        now = timezone.now()
        return self.filter(
            due_date__lt=now,
            status__in=[
                SurveyAssignment.Status.PENDING,
                SurveyAssignment.Status.IN_PROGRESS,
            ],
        ).update(status=SurveyAssignment.Status.OVERDUE)


class SurveyAssignment(BaseModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"
        OVERDUE = "OVERDUE", "Overdue"

    survey = models.ForeignKey(
        Survey, on_delete=models.CASCADE, related_name="assignments",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="survey_assignments",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="assignments_made",
    )

    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True,
    )
    assigned_at = models.DateTimeField(auto_now_add=True, db_index=True)
    start_date = models.DateTimeField(null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    allow_resume = models.BooleanField(default=True)

    objects = SurveyAssignmentQuerySet.as_manager()

    class Meta:
        db_table = "q_survey_assignments"
        ordering = ["-assigned_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["survey", "user"],
                name="uniq_assignment_per_user_survey",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["survey", "status"]),
            models.Index(fields=["due_date", "status"]),
        ]

    def __str__(self):
        return f"{self.survey_id} → {self.user_id} [{self.status}]"

    @property
    def is_past_due(self):
        return bool(
            self.due_date
            and self.status not in (self.Status.COMPLETED, self.Status.OVERDUE)
            and timezone.now() > self.due_date
        )

    def refresh_status(self):
        """Persist OVERDUE if past-due. Idempotent."""
        if (
            self.due_date
            and self.status in (self.Status.PENDING, self.Status.IN_PROGRESS)
            and timezone.now() > self.due_date
        ):
            self.status = self.Status.OVERDUE
            self.save(update_fields=["status", "updated_at"])
        return self