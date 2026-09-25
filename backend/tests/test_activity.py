import pytest
from django.urls import reverse

from apps.q_activity.models import ActivityLog
from apps.q_activity.utils import log_activity
from tests.factories import SurveyFactory, UserFactory


@pytest.mark.django_db
def test_superuser_can_list_logs(admin_client):
    SurveyFactory(created_by=admin_client.user)
    r = admin_client.get(reverse("v1:activity:activity-list"))
    assert r.status_code == 200


@pytest.mark.django_db
def test_non_superuser_cannot_list(user_client):
    r = user_client.get(reverse("v1:activity:activity-list"))
    assert r.status_code == 403


@pytest.mark.django_db
def test_survey_creation_creates_log(admin_client):
    admin_client.post(
        reverse("v1:surveys:surveys-list"),
        {"title": "Logged", "response_mode": "IDENTIFIED"},
    )
    assert ActivityLog.objects.filter(
        action="survey.created", user=admin_client.user,
    ).exists()


@pytest.mark.django_db
def test_assign_creates_log(admin_client):
    from tests.factories import PublishedSurveyFactory

    survey = PublishedSurveyFactory(created_by=admin_client.user)
    u = UserFactory()
    admin_client.post(
        reverse("v1:assignments:assignments-list"),
        {"survey": str(survey.id), "user_id": str(u.id)},
        format="json",
    )
    assert ActivityLog.objects.filter(
        action="assignment.created", user=admin_client.user,
    ).exists()


@pytest.mark.django_db
def test_response_submit_creates_log(user_client):
    from tests.factories import PublicSurveyFactory, QuestionFactory

    survey = PublicSurveyFactory()
    q = QuestionFactory(survey=survey, order=1, required=True)

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{"question": str(q.id), "value": {"text": "x"}}],
        },
        format="json",
    )
    rid = r.data["id"]
    user_client.post(reverse("v1:responses:responses-submit", args=[rid]))
    assert ActivityLog.objects.filter(
        action="response.submitted", user=user_client.user,
    ).exists()


@pytest.mark.django_db
def test_filter_by_action(admin_client):
    log_activity(admin_client.user, "custom.event", description="x")
    log_activity(admin_client.user, "other.event", description="y")
    r = admin_client.get(
        reverse("v1:activity:activity-list") + "?action=custom.event",
    )
    assert r.data["count"] == 1


@pytest.mark.django_db
def test_log_activity_swallows_errors(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("db down")

    from apps.q_activity.models import ActivityLog as AL
    monkeypatch.setattr(AL.objects, "create", boom)

    from tests.factories import UserFactory
    u = UserFactory()
    result = log_activity(u, "test.action")
    assert result is None