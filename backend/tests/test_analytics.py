import uuid

import pytest
from django.urls import reverse

from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from tests.factories import (
    AssignmentFactory,
    PublicSurveyFactory,
    QuestionFactory,
    SurveyResponseFactory,
    UserFactory,
)


@pytest.mark.django_db
def test_global_stats_superuser_only(user_client):
    r = user_client.get(reverse("v1:analytics:global"))
    assert r.status_code == 403


@pytest.mark.django_db
def test_global_stats_shape(admin_client):
    r = admin_client.get(reverse("v1:analytics:global"))
    assert r.status_code == 200
    assert {
        "total_users", "total_surveys", "total_responses",
        "total_assignments", "completion_rate",
    } <= set(r.data.keys())


@pytest.mark.django_db
def test_survey_stats(admin_client):
    s = PublicSurveyFactory()
    AssignmentFactory(survey=s)
    r = admin_client.get(reverse("v1:analytics:survey", args=[s.id]))
    assert r.status_code == 200
    assert r.data["total_assigned"] == 1


@pytest.mark.django_db
def test_survey_stats_404(admin_client):
    r = admin_client.get(reverse("v1:analytics:survey", args=[uuid.uuid4()]))
    assert r.status_code == 404


@pytest.mark.django_db
def test_creator_sees_only_own_survey_analytics(creator_client):
    from tests.factories import SuperUserFactory

    other = SuperUserFactory()
    s = PublicSurveyFactory(created_by=other)
    r = creator_client.get(reverse("v1:analytics:survey", args=[s.id]))
    assert r.status_code == 403


@pytest.mark.django_db
def test_creator_sees_own_survey_analytics(creator_client):
    s = PublicSurveyFactory(created_by=creator_client.user)
    r = creator_client.get(reverse("v1:analytics:survey", args=[s.id]))
    assert r.status_code == 200


@pytest.mark.django_db
def test_survey_stats_counts_submitted_only(admin_client):
    from apps.q_responses.models import Answer, SurveyResponse

    s = PublicSurveyFactory()
    q = QuestionFactory(survey=s, order=1)

    # 2 submitted, 1 draft
    for _ in range(2):
        r = SurveyResponseFactory(survey=s, status=SurveyResponse.Status.SUBMITTED)
        Answer.objects.create(response=r, question=q, value={"value": 5})

    draft = SurveyResponseFactory(survey=s, status=SurveyResponse.Status.DRAFT)
    Answer.objects.create(response=draft, question=q, value={"value": 5})

    resp = admin_client.get(reverse("v1:analytics:survey", args=[s.id]))
    assert resp.data["responses_count"] == 2


@pytest.mark.django_db
def test_cache_invalidated_after_submit(user_client):
    """Submitting a response should invalidate the survey cache."""
    s = PublicSurveyFactory()
    q = QuestionFactory(survey=s, order=1, required=True)
    from tests.factories import AssignmentFactory
    AssignmentFactory(survey=s, user=user_client.user)

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(s.id),
            "answers": [{"question": str(q.id), "value": {"text": "x"}}],
        },
        format="json",
    )
    rid = r.data["id"]

    # Admin fetches stats (cache fill)
    from tests.factories import SuperUserFactory
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    admin = SuperUserFactory()
    c = APIClient()
    t = RefreshToken.for_user(admin)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {t.access_token}")

    first = c.get(reverse("v1:analytics:survey", args=[s.id]))
    assert first.data["responses_count"] == 0

    user_client.post(reverse("v1:responses:responses-submit", args=[rid]))

    second = c.get(reverse("v1:analytics:survey", args=[s.id]))
    assert second.data["responses_count"] == 1


# ═════════════════════════════════════════════════════════════════
# Cache version-based invalidation (regression test)
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_cache_invalidated_for_all_range_variants(user_client):
    """
    Regression: invalidating a survey must invalidate every cached
    (preset, from, to) variant — not just the base key.
    """
    from apps.q_analytics.services import invalidate_survey_cache
    from tests.factories import SuperUserFactory

    s = PublicSurveyFactory()
    q = QuestionFactory(survey=s, order=1, required=True)
    AssignmentFactory(survey=s, user=user_client.user)

    admin = SuperUserFactory()
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin).access_token}")

    # Fill cache for several range variants
    c.get(reverse("v1:analytics:survey", args=[s.id]) + "?preset=7d")
    c.get(reverse("v1:analytics:survey", args=[s.id]) + "?preset=30d")
    c.get(reverse("v1:analytics:survey", args=[s.id]))

    # Trigger invalidation
    invalidate_survey_cache(s.id)

    # Verify version was bumped
    from django.core.cache import cache
    version = cache.get(f"analytics:survey:{s.id}:version")
    assert version is not None and version >= 1


@pytest.mark.django_db
def test_comparison_runs_with_preset(admin_client):
    """Regression: comparison was always None when only a preset was given."""
    s = PublicSurveyFactory()
    r = admin_client.get(
        reverse("v1:analytics:survey", args=[s.id]) + "?preset=30d",
    )
    assert r.status_code == 200
    assert r.data["comparison"] is not None


@pytest.mark.django_db
def test_comparison_absent_without_range(admin_client):
    """No range → no comparison (there's nothing to compare against)."""
    s = PublicSurveyFactory()
    r = admin_client.get(reverse("v1:analytics:survey", args=[s.id]))
    assert r.status_code == 200
    assert r.data["comparison"] is None


@pytest.mark.django_db
def test_timeline_capped_at_max_days(admin_client):
    """
    Even for a very old survey, timeline length must be bounded.
    """
    from datetime import timedelta
    from django.utils import timezone
    from apps.q_analytics.services import MAX_TIMELINE_DAYS

    s = PublicSurveyFactory()
    # Fake an old response to trigger the cap
    from tests.factories import SurveyResponseFactory
    old = SurveyResponseFactory(
        survey=s,
        status="SUBMITTED",
        submitted_at=timezone.now() - timedelta(days=400),
    )

    r = admin_client.get(reverse("v1:analytics:survey", args=[s.id]))
    assert r.status_code == 200
    assert len(r.data["timeline"]) <= MAX_TIMELINE_DAYS + 1  # +1 for inclusivity