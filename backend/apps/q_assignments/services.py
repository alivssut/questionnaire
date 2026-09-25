from django.contrib.auth import get_user_model
from django.db import transaction

from apps.q_activity.utils import log_activity
from apps.q_notifications.services import notify_user
from apps.q_surveys.models import Survey

from .models import SurveyAssignment

User = get_user_model()


@transaction.atomic
def assign_survey(*, survey: Survey, user, assigned_by, due_date=None, allow_resume=True):
    """
    Assign `survey` to a single `user`.
    Idempotent: returns (assignment, created).
    Raises ValueError if the survey isn't PUBLISHED.
    """
    if survey.status != Survey.Status.PUBLISHED:
        raise ValueError("Cannot assign a survey that is not PUBLISHED.")

    assignment, created = SurveyAssignment.objects.get_or_create(
        survey=survey,
        user=user,
        defaults={
            "assigned_by": assigned_by,
            "due_date": due_date,
            "allow_resume": allow_resume,
        },
    )
    if created:
        notify_user(
            user=user,
            title="New survey assigned",
            message=f"You have been assigned: {survey.title}",
            type="ASSIGNMENT_CREATED",
            metadata={
                "assignment_id": str(assignment.id),
                "survey_id": str(survey.id),
            },
        )
        log_activity(assigned_by, "assignment.created", assignment, "Assigned survey")
    return assignment, created


@transaction.atomic
def bulk_assign(*, survey: Survey, users, assigned_by, due_date=None, allow_resume=True):
    """
    Bulk-assign `survey` to many users in one transaction.
    Returns (created_ids, skipped) where skipped is a list of
    {"user_id": str, "reason": str}.
    Notifications and activity logs are created with bulk_create.
    """
    if survey.status != Survey.Status.PUBLISHED:
        raise ValueError("Cannot assign a survey that is not PUBLISHED.")

    existing_user_ids = set(
        SurveyAssignment.objects.filter(survey=survey, user__in=users)
        .values_list("user_id", flat=True)
    )

    to_create = []
    skipped = []
    for u in users:
        if u.id in existing_user_ids:
            skipped.append({"user_id": str(u.id), "reason": "already_assigned"})
            continue
        to_create.append(
            SurveyAssignment(
                survey=survey,
                user=u,
                assigned_by=assigned_by,
                due_date=due_date,
                allow_resume=allow_resume,
            )
        )

    if not to_create:
        return [], skipped

    created = SurveyAssignment.objects.bulk_create(to_create)

    from apps.q_notifications.models import Notification
    from apps.q_activity.models import ActivityLog

    Notification.objects.bulk_create([
        Notification(
            user=a.user,
            title="New survey assigned",
            message=f"You have been assigned: {survey.title}",
            type="ASSIGNMENT_CREATED",
            metadata={
                "assignment_id": str(a.id),
                "survey_id": str(survey.id),
            },
        )
        for a in created
    ])
    ActivityLog.objects.bulk_create([
        ActivityLog(
            user=assigned_by,
            action="assignment.created",
            object_type="SurveyAssignment",
            object_id=str(a.id),
            description="Assigned survey",
            metadata={"survey_id": str(survey.id), "user_id": str(a.user_id)},
        )
        for a in created
    ])

    return [str(a.id) for a in created], skipped