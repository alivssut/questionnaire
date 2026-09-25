"""
Performance regression tests.

These assert query counts to catch N+1 regressions. They use
Django's `CaptureQueriesContext` — no extra dependencies needed.

IMPORTANT: These tests intentionally do NOT count the auth queries
(Session / User lookup) because those only exist in dev with
SessionAuthentication. In production with JWT they're absent.
"""

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from tests.factories import (
    AssignmentFactory,
    PublicSurveyFactory,
    QuestionFactory,
    SurveyResponseFactory,
)


def _count_queries(fn) -> int:
    with CaptureQueriesContext(connection) as ctx:
        fn()
    return len(ctx.captured_queries)


@pytest.mark.django_db
def test_survey_list_query_count_is_constant(admin_client):
    """
    Listing surveys should not scale queries with the number of surveys.
    """
    for _ in range(10):
        PublicSurveyFactory(created_by=admin_client.user)

    def call():
        r = admin_client.get(reverse("v1:surveys:surveys-list"))
        assert r.status_code == 200

    # A constant handful: auth + count + main query
    assert _count_queries(call) <= 6


@pytest.mark.django_db
def test_survey_detail_prefetches_children(admin_client):
    """
    Retrieving a survey with many questions + options must not fire
    one query per child (the classic N+1).
    """
    s = PublicSurveyFactory(created_by=admin_client.user)
    for i in range(5):
        q = QuestionFactory(survey=s, order=i)
        # 3 options per question
        from apps.q_surveys.models import QuestionOption
        for j in range(3):
            QuestionOption.objects.create(
                question=q, label=f"Opt{j}", value=f"o{j}", order=j,
            )

    def call():
        r = admin_client.get(reverse("v1:surveys:surveys-detail", args=[s.id]))
        assert r.status_code == 200
        assert len(r.data["questions"]) == 5

    # With prefetch: constant regardless of question count.
    # Without: 1 + 5 (questions) + 5 (options per q) = 11+
    assert _count_queries(call) <= 8


@pytest.mark.django_db
def test_assignments_list_does_not_query_permissions(admin_client):
    """
    User permissions must NOT be resolved per assignment
    (that was the source of the 42-query regression).
    """
    for _ in range(10):
        AssignmentFactory()

    def call():
        r = admin_client.get(reverse("v1:assignments:assignments-list"))
        assert r.status_code == 200
        assert len(r.data["results"]) == 10

    # Constant: auth + count + main (user is select_related).
    assert _count_queries(call) <= 6


@pytest.mark.django_db
def test_responses_list_constant_query_count(admin_client):
    """Response list must use UserSummarySerializer, not UserSerializer."""
    for _ in range(8):
        SurveyResponseFactory()

    def call():
        r = admin_client.get(reverse("v1:responses:responses-list"))
        assert r.status_code == 200

    assert _count_queries(call) <= 8


@pytest.mark.django_db
def test_analytics_query_count_does_not_scale_with_questions(admin_client):
    """
    Analytics query count must be constant in the number of questions.
    This is the biggest regression risk in the analytics module.
    """
    s = PublicSurveyFactory(created_by=admin_client.user)
    for i in range(10):
        QuestionFactory(survey=s, type="SHORT_TEXT", order=i)

    def call():
        r = admin_client.get(reverse("v1:analytics:survey", args=[s.id]))
        assert r.status_code == 200

    # Constant: auth + survey exists + responses agg + assignments agg
    # + questions + answers batch + file-counts + timeline + comparison
    # ≈ 9-11. Definitely NOT 1 + N.
    assert _count_queries(call) <= 14