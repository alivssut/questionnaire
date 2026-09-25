from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.q_assignments.models import SurveyAssignment
from apps.q_core.models import BaseModel
from apps.q_surveys.models import Question, Survey


class SurveyResponse(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"

    survey = models.ForeignKey(
        Survey, on_delete=models.CASCADE, related_name="responses",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="survey_responses",
    )
    assignment = models.ForeignKey(
        SurveyAssignment,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="responses",
    )
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True,
    )
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    completion_time = models.DurationField(null=True, blank=True)

    class Meta:
        db_table = "q_survey_responses"
        ordering = ["-started_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["survey", "user"],
                condition=models.Q(user__isnull=False),
                name="uniq_response_per_user_survey",
            ),
        ]
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["survey"]),
            models.Index(fields=["submitted_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"Response<{self.id}> survey={self.survey_id} status={self.status}"


class Answer(BaseModel):
    response = models.ForeignKey(
        SurveyResponse, on_delete=models.CASCADE, related_name="answers",
    )
    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name="answers",
    )
    value = models.JSONField(default=dict)

    class Meta:
        db_table = "q_answers"
        constraints = [
            models.UniqueConstraint(
                fields=["response", "question"], name="uniq_answer_per_question",
            ),
        ]
        indexes = [
            models.Index(fields=["response"]),
            models.Index(fields=["question"]),
        ]

    def __str__(self):
        return f"Answer<{self.id}>"


class AnswerFile(BaseModel):
    """
    A file uploaded for a FILE_UPLOAD question.

    Lifecycle:
      1. User POSTs to /responses/upload/ with {survey_id, file}.
         -> AnswerFile created with answer=None, uploaded_by=user, survey=survey.
      2. User POSTs /responses/save-draft/ with value {"file_ids": [...]}.
         -> Files linked to the Answer (answer set).
      3. Orphan files (answer still None) can be cleaned up periodically.
    """

    answer = models.ForeignKey(
        Answer, on_delete=models.CASCADE,
        null=True, blank=True, related_name="files",
    )
    survey = models.ForeignKey(
        Survey, on_delete=models.CASCADE, related_name="answer_files",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="uploaded_answer_files",
    )

    file = models.FileField(upload_to="answer_files/%Y/%m/")
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveIntegerField()
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "q_answer_files"
        ordering = ["order", "created_at"]
        indexes = [
            models.Index(fields=["answer"]),
            models.Index(fields=["survey", "uploaded_by"]),
            models.Index(fields=["answer", "order"]),
        ]

    def __str__(self):
        return self.original_name

    @classmethod
    def cleanup_orphans(cls, older_than_hours: int = 24) -> int:
        cutoff = timezone.now() - timezone.timedelta(hours=older_than_hours)
        orphans = cls.objects.filter(answer__isnull=True, created_at__lt=cutoff)
        count = 0
        for f in orphans:
            f.file.delete(save=False)
            f.delete()
            count += 1
        return count