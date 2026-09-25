from django.conf import settings
from django.db import models

from apps.q_core.models import BaseModel, SoftDeleteModel, UUIDModel


class SystemList(UUIDModel):
    class Type(models.TextChoices):
        COUNTRY = "COUNTRY", "Country"
        MONTH = "MONTH", "Month"
        LANGUAGE = "LANGUAGE", "Language"
        CURRENCY = "CURRENCY", "Currency"
        TIMEZONE = "TIMEZONE", "Timezone"
        AGE_RANGE = "AGE_RANGE", "Age range"
        CUSTOM = "CUSTOM", "Custom"

    name = models.CharField(max_length=128, unique=True)
    slug = models.SlugField(max_length=128, unique=True)
    type = models.CharField(
        max_length=24, choices=Type.choices, default=Type.CUSTOM, db_index=True,
    )
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "q_system_lists"
        ordering = ["name"]

    def __str__(self):
        return self.name


class ListItem(models.Model):
    system_list = models.ForeignKey(
        SystemList, on_delete=models.CASCADE, related_name="items",
    )
    label = models.CharField(max_length=255)
    value = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "q_list_items"
        ordering = ["order"]
        indexes = [models.Index(fields=["system_list", "order"])]

    def __str__(self):
        return self.label


class Survey(BaseModel, SoftDeleteModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PUBLISHED = "PUBLISHED", "Published"
        CLOSED = "CLOSED", "Closed"
        ARCHIVED = "ARCHIVED", "Archived"

    class Visibility(models.TextChoices):
        PUBLIC = "PUBLIC", "Public"
        ASSIGNED = "ASSIGNED", "Assigned"

    class ResponseMode(models.TextChoices):
        IDENTIFIED = "IDENTIFIED", "Identified"
        ANONYMOUS = "ANONYMOUS", "Anonymous"

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_surveys",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="covers/", null=True, blank=True)
    category = models.CharField(max_length=64, blank=True, db_index=True)

    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True,
    )
    visibility = models.CharField(
        max_length=16, choices=Visibility.choices,
        default=Visibility.ASSIGNED, db_index=True,
    )
    response_mode = models.CharField(
        max_length=16, choices=ResponseMode.choices,
        default=ResponseMode.IDENTIFIED, db_index=True,
    )
    estimated_time_minutes = models.PositiveIntegerField(
        default=0, help_text="Estimated time in minutes",
    )
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "q_surveys"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_by", "status"]),
            models.Index(fields=["status", "visibility", "created_at"]),
            models.Index(fields=["published_at"]),
        ]

    def __str__(self):
        return self.title

    def is_answerable(self):
        return self.status == self.Status.PUBLISHED and not self.is_deleted

    def is_public(self):
        return self.visibility == self.Visibility.PUBLIC


class Question(BaseModel):
    class Type(models.TextChoices):
        SHORT_TEXT = "SHORT_TEXT", "Short text"
        LONG_TEXT = "LONG_TEXT", "Long text"
        EMAIL = "EMAIL", "Email"
        PHONE = "PHONE", "Phone"
        URL = "URL", "URL"
        NUMBER = "NUMBER", "Number"
        RATING = "RATING", "Rating"
        LINEAR_SCALE = "LINEAR_SCALE", "Linear scale"
        NPS = "NPS", "NPS"
        SLIDER = "SLIDER", "Slider"
        SINGLE_CHOICE = "SINGLE_CHOICE", "Single choice"
        MULTIPLE_CHOICE = "MULTIPLE_CHOICE", "Multiple choice"
        DROPDOWN = "DROPDOWN", "Dropdown"
        YES_NO = "YES_NO", "Yes / No"
        LIKERT = "LIKERT", "Likert"
        RANKING = "RANKING", "Ranking"
        DATE = "DATE", "Date"
        TIME = "TIME", "Time"
        DATETIME = "DATETIME", "Datetime"
        MATRIX = "MATRIX", "Matrix"
        FILE_UPLOAD = "FILE_UPLOAD", "File upload"
        TEXT_BLOCK = "TEXT_BLOCK", "Text block"
        SECTION = "SECTION", "Section"

    NON_ANSWERABLE_TYPES = frozenset({"TEXT_BLOCK", "SECTION"})
    CHOICE_TYPES = frozenset({
        "SINGLE_CHOICE", "MULTIPLE_CHOICE", "DROPDOWN", "YES_NO",
        "LIKERT", "RANKING",
    })
    NUMERIC_TYPES = frozenset({
        "NUMBER", "RATING", "LINEAR_SCALE", "NPS", "SLIDER",
    })

    survey = models.ForeignKey(
        Survey, on_delete=models.CASCADE, related_name="questions",
    )
    type = models.CharField(max_length=24, choices=Type.choices, db_index=True)
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    required = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    settings = models.JSONField(default=dict, blank=True)
    system_list = models.ForeignKey(
        SystemList, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="questions",
    )

    class Meta:
        db_table = "q_questions"
        ordering = ["order"]
        indexes = [models.Index(fields=["survey", "order"])]
        constraints = [
            models.UniqueConstraint(
                fields=["survey", "order"],
                name="uniq_question_order_per_survey",
                deferrable=models.Deferrable.DEFERRED,
            ),
        ]
    def __str__(self):
        return f"{self.survey_id}#{self.order} {self.title[:40]}"

    def is_answerable(self):
        return self.type not in self.NON_ANSWERABLE_TYPES


class QuestionOption(UUIDModel):
    """A single selectable option for a choice-type question."""

    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name="options",
    )
    label = models.CharField(max_length=255)
    value = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "q_question_options"
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["question", "value"],
                name="uniq_option_value_per_question",
            ),
        ]
        indexes = [models.Index(fields=["question", "order"])]

    def __str__(self):
        return f"{self.question_id}:{self.value}"


class MatrixRow(UUIDModel):
    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name="matrix_rows",
    )
    label = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "q_matrix_rows"
        ordering = ["order"]
        indexes = [models.Index(fields=["question", "order"])]

    def __str__(self):
        return self.label


class MatrixColumn(UUIDModel):
    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name="matrix_columns",
    )
    label = models.CharField(max_length=255)
    value = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "q_matrix_columns"
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["question", "value"],
                name="uniq_matrix_col_value_per_question",
            ),
        ]
        indexes = [models.Index(fields=["question", "order"])]

    def __str__(self):
        return f"{self.question_id}:{self.value}"