from django.db import transaction
from django.db.models import Case, IntegerField, When
from django.utils import timezone

from apps.q_activity.utils import log_activity
from .models import MatrixColumn, MatrixRow, Question, QuestionOption, Survey


@transaction.atomic
def publish_survey(survey: Survey, user) -> Survey:
    answerable = survey.questions.exclude(type__in=Question.NON_ANSWERABLE_TYPES)
    if not answerable.exists():
        raise ValueError("Cannot publish a survey with no answerable questions.")
    survey.status = Survey.Status.PUBLISHED
    survey.published_at = timezone.now()
    survey.save(update_fields=["status", "published_at", "updated_at"])
    log_activity(user, "survey.published", survey, "Published survey")
    return survey


@transaction.atomic
def close_survey(survey: Survey, user) -> Survey:
    survey.status = Survey.Status.CLOSED
    survey.save(update_fields=["status", "updated_at"])
    log_activity(user, "survey.closed", survey, "Closed survey")
    return survey


@transaction.atomic
def archive_survey(survey: Survey, user) -> Survey:
    survey.status = Survey.Status.ARCHIVED
    survey.save(update_fields=["status", "updated_at"])
    log_activity(user, "survey.archived", survey, "Archived survey")
    return survey


@transaction.atomic
def duplicate_survey(source: Survey, user) -> Survey:
    new = Survey.objects.create(
        created_by=user,
        title=f"{source.title} (copy)",
        description=source.description,
        category=source.category,
        response_mode=source.response_mode,
        visibility=source.visibility,
        estimated_time_minutes=source.estimated_time_minutes,
    )
    for q in source.questions.order_by("order"):
        new_q = Question.objects.create(
            survey=new,
            type=q.type,
            title=q.title,
            description=q.description,
            required=q.required,
            order=q.order,
            settings=q.settings,
            system_list=q.system_list,
        )
        QuestionOption.objects.bulk_create([
            QuestionOption(
                question=new_q, label=o.label, value=o.value, order=o.order,
            )
            for o in q.options.all()
        ])
        MatrixRow.objects.bulk_create([
            MatrixRow(question=new_q, label=r.label, order=r.order)
            for r in q.matrix_rows.all()
        ])
        MatrixColumn.objects.bulk_create([
            MatrixColumn(
                question=new_q, label=c.label, value=c.value, order=c.order,
            )
            for c in q.matrix_columns.all()
        ])
    log_activity(user, "survey.duplicated", new, f"Duplicated from {source.id}")
    return new


@transaction.atomic
def reorder_questions(survey: Survey, items: list[dict]) -> None:
    existing_ids = set(
        Question.objects.filter(survey=survey).values_list("id", flat=True)
    )
    payload_ids = {item["id"] for item in items}

    if len(payload_ids) != len(items):
        raise ValueError("Duplicate question ids in payload.")
    if payload_ids != existing_ids:
        raise ValueError(
            "Reorder payload must include every question of the survey exactly once."
        )
    orders = [item["order"] for item in items]
    if len(set(orders)) != len(orders):
        raise ValueError("Duplicate order values in payload.")

    cases = [When(pk=item["id"], then=item["order"]) for item in items]
    Question.objects.filter(pk__in=payload_ids).update(
        order=Case(*cases, output_field=IntegerField())
    )