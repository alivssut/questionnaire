from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.q_assignments.models import SurveyAssignment
from tests.factories import (
    AssignmentFactory,
    PublishedSurveyFactory,
    UserFactory,
)


# ═════════════════════════════════════════════════════════════════
# CRUD + Permissions
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_regular_user_cannot_create_assignment(user_client):
    survey = PublishedSurveyFactory()
    other = UserFactory()
    r = user_client.post(
        reverse("v1:assignments:assignments-list"),
        {"survey": str(survey.id), "user_id": str(other.id)},
        format="json",
    )
    assert r.status_code == 403


@pytest.mark.django_db
def test_admin_can_create_assignment(admin_client):
    survey = PublishedSurveyFactory()
    u = UserFactory()
    r = admin_client.post(
        reverse("v1:assignments:assignments-list"),
        {"survey": str(survey.id), "user_id": str(u.id)},
        format="json",
    )
    assert r.status_code == 201, r.data
    assert r.data["user"]["id"] == str(u.id)
    assert r.data["status"] == "PENDING"


@pytest.mark.django_db
def test_cannot_assign_draft_survey(admin_client):
    """Service should reject non-PUBLISHED surveys."""
    from tests.factories import SurveyFactory

    survey = SurveyFactory()  # DRAFT
    u = UserFactory()
    r = admin_client.post(
        reverse("v1:assignments:assignments-list"),
        {"survey": str(survey.id), "user_id": str(u.id)},
        format="json",
    )
    assert r.status_code == 400
    assert "PUBLISHED" in str(r.data)


@pytest.mark.django_db
def test_duplicate_assignment_returns_409(admin_client):
    a = AssignmentFactory()
    r = admin_client.post(
        reverse("v1:assignments:assignments-list"),
        {"survey": str(a.survey_id), "user_id": str(a.user_id)},
        format="json",
    )
    assert r.status_code == 409


@pytest.mark.django_db
def test_assign_inactive_user_rejected(admin_client):
    survey = PublishedSurveyFactory()
    inactive = UserFactory(is_active=False)
    r = admin_client.post(
        reverse("v1:assignments:assignments-list"),
        {"survey": str(survey.id), "user_id": str(inactive.id)},
        format="json",
    )
    assert r.status_code == 400


# ═════════════════════════════════════════════════════════════════
# Bulk assign
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_bulk_assign_creates_many(admin_client):
    survey = PublishedSurveyFactory()
    users = [UserFactory() for _ in range(3)]
    r = admin_client.post(
        reverse("v1:assignments:assignments-bulk"),
        {
            "survey": str(survey.id),
            "user_ids": [str(u.id) for u in users],
        },
        format="json",
    )
    assert r.status_code == 201, r.data
    assert len(r.data["created"]) == 3
    assert r.data["skipped"] == []
    assert r.data["missing_users"] == []


@pytest.mark.django_db
def test_bulk_assign_skips_existing(admin_client):
    survey = PublishedSurveyFactory()
    u1, u2 = UserFactory(), UserFactory()
    AssignmentFactory(survey=survey, user=u1)

    r = admin_client.post(
        reverse("v1:assignments:assignments-bulk"),
        {
            "survey": str(survey.id),
            "user_ids": [str(u1.id), str(u2.id)],
        },
        format="json",
    )
    assert r.status_code == 201
    assert len(r.data["created"]) == 1
    assert len(r.data["skipped"]) == 1
    assert r.data["skipped"][0]["reason"] == "already_assigned"


@pytest.mark.django_db
def test_bulk_assign_reports_missing_users(admin_client):
    import uuid

    survey = PublishedSurveyFactory()
    u = UserFactory()
    missing_id = str(uuid.uuid4())

    r = admin_client.post(
        reverse("v1:assignments:assignments-bulk"),
        {
            "survey": str(survey.id),
            "user_ids": [str(u.id), missing_id],
        },
        format="json",
    )
    assert r.status_code == 201
    assert len(r.data["created"]) == 1
    assert missing_id in r.data["missing_users"]


# ═════════════════════════════════════════════════════════════════
# /mine — critical bug fix regression
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_mine_returns_only_own_assignments_for_regular_user(user_client):
    AssignmentFactory(user=user_client.user)
    AssignmentFactory(user=user_client.user)
    AssignmentFactory()  # someone else

    r = user_client.get(reverse("v1:assignments:assignments-mine"))
    assert r.status_code == 200
    assert r.data["count"] == 2
    for item in r.data["results"]:
        assert item["user"]["id"] == str(user_client.user.id)


@pytest.mark.django_db
def test_mine_returns_only_own_assignments_for_admin(admin_client):
    """
    Regression test: superusers must NOT see other users' assignments
    in /mine. That's what /list is for.
    """
    AssignmentFactory(user=admin_client.user)
    AssignmentFactory()  # someone else
    AssignmentFactory()  # someone else

    r = admin_client.get(reverse("v1:assignments:assignments-mine"))
    assert r.status_code == 200
    assert r.data["count"] == 1
    assert r.data["results"][0]["user"]["id"] == str(admin_client.user.id)


# ═════════════════════════════════════════════════════════════════
# /start — status transitions
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_start_transitions_pending_to_in_progress(user_client):
    a = AssignmentFactory(user=user_client.user, status="PENDING")
    r = user_client.post(
        reverse("v1:assignments:assignments-start", args=[a.id]),
    )
    assert r.status_code == 200, r.data
    a.refresh_from_db()
    assert a.status == SurveyAssignment.Status.IN_PROGRESS
    assert a.start_date is not None


@pytest.mark.django_db
def test_start_idempotent_when_already_in_progress(user_client):
    a = AssignmentFactory(
        user=user_client.user,
        status="IN_PROGRESS",
        start_date=timezone.now() - timedelta(hours=1),
    )
    original_start = a.start_date
    r = user_client.post(
        reverse("v1:assignments:assignments-start", args=[a.id]),
    )
    assert r.status_code == 200
    a.refresh_from_db()
    assert a.start_date == original_start  # unchanged


@pytest.mark.django_db
def test_start_updates_overdue_when_past_due(user_client):
    a = AssignmentFactory(
        user=user_client.user,
        due_date=timezone.now() - timedelta(hours=1),
    )
    r = user_client.post(
        reverse("v1:assignments:assignments-start", args=[a.id]),
    )
    assert r.status_code == 200
    a.refresh_from_db()
    assert a.status == SurveyAssignment.Status.OVERDUE


@pytest.mark.django_db
def test_cannot_start_other_users_assignment(user_client):
    other = UserFactory()
    a = AssignmentFactory(user=other)
    r = user_client.post(
        reverse("v1:assignments:assignments-start", args=[a.id]),
    )
    # Since queryset is scoped, this returns 404 (not 403)
    assert r.status_code == 404


# ═════════════════════════════════════════════════════════════════
# Overdue logic
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_mark_overdue_updates_bulk():
    past = timezone.now() - timedelta(days=1)
    a1 = AssignmentFactory(due_date=past, status="PENDING")
    a2 = AssignmentFactory(due_date=past, status="IN_PROGRESS")
    a3 = AssignmentFactory(due_date=past, status="COMPLETED")  # shouldn't change

    count = SurveyAssignment.objects.mark_overdue()
    assert count == 2
    a1.refresh_from_db(); a2.refresh_from_db(); a3.refresh_from_db()
    assert a1.status == "OVERDUE"
    assert a2.status == "OVERDUE"
    assert a3.status == "COMPLETED"


@pytest.mark.django_db
def test_is_past_due_property():
    past = timezone.now() - timedelta(hours=1)
    a = AssignmentFactory(due_date=past, status="PENDING")
    assert a.is_past_due is True

    a.status = "COMPLETED"
    assert a.is_past_due is False

    a.status = "OVERDUE"
    assert a.is_past_due is False


@pytest.mark.django_db
def test_is_past_due_false_when_no_due_date():
    a = AssignmentFactory(due_date=None)
    assert a.is_past_due is False


# ═════════════════════════════════════════════════════════════════
# Delete
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_admin_can_delete_assignment(admin_client):
    a = AssignmentFactory()
    r = admin_client.delete(
        reverse("v1:assignments:assignments-detail", args=[a.id]),
    )
    assert r.status_code == 204
    assert not SurveyAssignment.objects.filter(id=a.id).exists()


@pytest.mark.django_db
def test_regular_user_cannot_delete_assignment(user_client):
    a = AssignmentFactory(user=user_client.user)
    r = user_client.delete(
        reverse("v1:assignments:assignments-detail", args=[a.id]),
    )
    assert r.status_code == 403