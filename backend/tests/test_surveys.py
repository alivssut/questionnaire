import pytest
from django.urls import reverse

from apps.q_surveys.models import Question, QuestionOption, Survey
from tests.factories import (
    MatrixQuestionFactory,
    PublicSurveyFactory,
    PublishedSurveyFactory,
    QuestionFactory,
    SingleChoiceQuestionFactory,
    SurveyFactory,
    UserFactory,
)


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_user_cannot_create_survey(user_client):
    r = user_client.post(
        reverse("v1:surveys:surveys-list"),
        {"title": "Hack", "response_mode": "IDENTIFIED"},
    )
    assert r.status_code == 403


@pytest.mark.django_db
def test_admin_can_create_survey(admin_client):
    r = admin_client.post(
        reverse("v1:surveys:surveys-list"),
        {
            "title": "First Survey",
            "description": "Hello",
            "response_mode": "IDENTIFIED",
            "estimated_time_minutes": 5,
        },
    )
    assert r.status_code == 201, r.data
    assert r.data["title"] == "First Survey"


@pytest.mark.django_db
def test_creator_with_permission_can_create(creator_client):
    r = creator_client.post(
        reverse("v1:surveys:surveys-list"),
        {"title": "Creator Survey", "response_mode": "IDENTIFIED"},
    )
    assert r.status_code == 201


# ---------------------------------------------------------------------------
# Publish
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_publish_requires_answerable_questions(admin_client):
    r = admin_client.post(
        reverse("v1:surveys:surveys-list"),
        {"title": "Empty", "response_mode": "IDENTIFIED"},
    )
    sid = r.data["id"]
    pub = admin_client.post(reverse("v1:surveys:surveys-publish", args=[sid]))
    assert pub.status_code == 400


@pytest.mark.django_db
def test_publish_after_adding_question(admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    QuestionFactory(survey=s, order=1)
    r = admin_client.post(reverse("v1:surveys:surveys-publish", args=[s.id]))
    assert r.status_code == 200
    assert r.data["status"] == "PUBLISHED"


@pytest.mark.django_db
def test_non_owner_cannot_publish(creator_client, admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    QuestionFactory(survey=s)
    r = creator_client.post(reverse("v1:surveys:surveys-publish", args=[s.id]))
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Visibility & queryset
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_public_survey_visible_to_all_authenticated(user_client, admin_client):
    PublicSurveyFactory(created_by=admin_client.user)
    r = user_client.get(reverse("v1:surveys:surveys-list"))
    assert r.data["count"] == 1


@pytest.mark.django_db
def test_assigned_survey_visible_to_assignee(user_client):
    from tests.factories import AssignmentFactory

    AssignmentFactory(user=user_client.user)
    r = user_client.get(reverse("v1:surveys:surveys-list"))
    assert r.data["count"] == 1


@pytest.mark.django_db
def test_draft_survey_not_visible_to_stranger(user_client, admin_client):
    SurveyFactory(created_by=admin_client.user, status=Survey.Status.DRAFT)
    r = user_client.get(reverse("v1:surveys:surveys-list"))
    assert r.data["count"] == 0


# ---------------------------------------------------------------------------
# /surveys/mine/
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_mine_lists_only_my_surveys(admin_client):
    SurveyFactory(created_by=admin_client.user)
    SurveyFactory(created_by=admin_client.user)
    SurveyFactory()  # someone else
    r = admin_client.get(reverse("v1:surveys:surveys-mine"))
    assert r.status_code == 200
    assert r.data["count"] == 2


# ---------------------------------------------------------------------------
# Question ordering & reorder
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_sequential_creates_get_unique_orders(admin_client):
    """
    When creating multiple questions without an explicit `order`, each
    should auto-increment so that the (survey, order) unique constraint
    is never violated.

    Regression: DRF was injecting the model's `default=0` into
    `validated_data`, so `validated_data.get("order")` was always 0
    (not None) and auto-computation never ran.
    """
    s = SurveyFactory(created_by=admin_client.user)
    url = reverse("v1:surveys:questions-list")
    orders = set()
    for i in range(5):
        r = admin_client.post(
            url,
            {"survey": str(s.id), "type": "SHORT_TEXT", "title": f"Q{i}"},
        )
        assert r.status_code == 201, r.data
        orders.add(r.data["order"])
    assert len(orders) == 5
    assert orders == {1, 2, 3, 4, 5}


@pytest.mark.django_db
def test_reorder_requires_full_payload(admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    q1 = QuestionFactory(survey=s, order=1)
    q2 = QuestionFactory(survey=s, order=2)
    QuestionFactory(survey=s, order=3)

    r = admin_client.post(
        reverse("v1:surveys:questions-reorder"),
        [
            {"id": str(q1.id), "order": 2},
            {"id": str(q2.id), "order": 1},
        ],
        format="json",
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_reorder_full_payload(admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    q1 = QuestionFactory(survey=s, order=1)
    q2 = QuestionFactory(survey=s, order=2)

    r = admin_client.post(
        reverse("v1:surveys:questions-reorder"),
        [
            {"id": str(q1.id), "order": 2},
            {"id": str(q2.id), "order": 1},
        ],
        format="json",
    )
    assert r.status_code == 200, r.data
    q1.refresh_from_db()
    q2.refresh_from_db()
    assert q1.order == 2
    assert q2.order == 1


# ---------------------------------------------------------------------------
# IDOR / ownership
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_question_idor_blocked(user_client):
    other = UserFactory()
    survey = SurveyFactory(created_by=other, status=Survey.Status.DRAFT)
    QuestionFactory(survey=survey)
    r = user_client.get(reverse("v1:surveys:questions-list"))
    assert r.data["count"] == 0


@pytest.mark.django_db
def test_cannot_change_question_survey(admin_client):
    s1 = SurveyFactory(created_by=admin_client.user)
    s2 = SurveyFactory(created_by=admin_client.user)
    q = QuestionFactory(survey=s1)

    r = admin_client.patch(
        reverse("v1:surveys:questions-detail", args=[q.id]),
        {"survey": str(s2.id)},
        format="json",
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_cannot_add_question_to_published_with_responses(
    admin_client,
):
    from tests.factories import SurveyResponseFactory

    s = PublishedSurveyFactory(created_by=admin_client.user)
    SurveyResponseFactory(survey=s)

    r = admin_client.post(
        reverse("v1:surveys:questions-list"),
        {"survey": str(s.id), "type": "SHORT_TEXT", "title": "Late"},
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Choice questions with options
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_create_single_choice_with_options(admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    r = admin_client.post(
        reverse("v1:surveys:questions-list"),
        {
            "survey": str(s.id),
            "type": "SINGLE_CHOICE",
            "title": "Pick one",
            "options": [
                {"label": "Yes", "value": "yes"},
                {"label": "No", "value": "no"},
            ],
        },
        format="json",
    )
    assert r.status_code == 201, r.data
    qid = r.data["id"]
    q = Question.objects.get(id=qid)
    assert q.options.count() == 2
    assert set(q.options.values_list("value", flat=True)) == {"yes", "no"}


@pytest.mark.django_db
def test_choice_without_options_rejected(admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    r = admin_client.post(
        reverse("v1:surveys:questions-list"),
        {
            "survey": str(s.id),
            "type": "SINGLE_CHOICE",
            "title": "No options",
        },
        format="json",
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_choice_with_duplicate_options_rejected(admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    r = admin_client.post(
        reverse("v1:surveys:questions-list"),
        {
            "survey": str(s.id),
            "type": "SINGLE_CHOICE",
            "title": "Dup",
            "options": [
                {"label": "A", "value": "x"},
                {"label": "B", "value": "x"},
            ],
        },
        format="json",
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_update_question_replaces_options(admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    q = SingleChoiceQuestionFactory(survey=s)
    assert q.options.count() == 3

    r = admin_client.patch(
        reverse("v1:surveys:questions-detail", args=[q.id]),
        {
            "options": [
                {"label": "A", "value": "a"},
                {"label": "B", "value": "b"},
            ]
        },
        format="json",
    )
    assert r.status_code == 200, r.data
    q.refresh_from_db()
    assert q.options.count() == 2


# ---------------------------------------------------------------------------
# Matrix questions
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_create_matrix_question(admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    r = admin_client.post(
        reverse("v1:surveys:questions-list"),
        {
            "survey": str(s.id),
            "type": "MATRIX",
            "title": "Rate us",
            "matrix_rows": [{"label": "Design"}, {"label": "Speed"}],
            "matrix_columns": [
                {"label": "Bad", "value": "1"},
                {"label": "Good", "value": "2"},
            ],
        },
        format="json",
    )
    assert r.status_code == 201, r.data
    q = Question.objects.get(id=r.data["id"])
    assert q.matrix_rows.count() == 2
    assert q.matrix_columns.count() == 2


@pytest.mark.django_db
def test_matrix_without_rows_rejected(admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    r = admin_client.post(
        reverse("v1:surveys:questions-list"),
        {
            "survey": str(s.id),
            "type": "MATRIX",
            "title": "Bad",
            "matrix_columns": [{"label": "A", "value": "a"}],
        },
        format="json",
    )
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Duplicate
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_duplicate_copies_options_and_matrix(admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    SingleChoiceQuestionFactory(survey=s)
    MatrixQuestionFactory(survey=s, order=2)

    r = admin_client.post(reverse("v1:surveys:surveys-duplicate", args=[s.id]))
    assert r.status_code == 201, r.data
    new_id = r.data["id"]

    new_qs = Question.objects.filter(survey_id=new_id)
    assert new_qs.count() == 2
    for q in new_qs:
        if q.type == "SINGLE_CHOICE":
            assert q.options.count() == 3
        elif q.type == "MATRIX":
            assert q.matrix_rows.count() == 3
            assert q.matrix_columns.count() == 3


# ---------------------------------------------------------------------------
# Soft delete
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_soft_delete_hides_survey(admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    r = admin_client.delete(reverse("v1:surveys:surveys-detail", args=[s.id]))
    assert r.status_code == 204
    s.refresh_from_db()
    assert s.is_deleted is True
    assert not Survey.objects.filter(id=s.id).exists()
    assert Survey.all_objects.filter(id=s.id).exists()
    

# ═════════════════════════════════════════════════════════════════
# Edge cases & regression tests
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_question_order_zero_is_respected(admin_client):
    """
    Regression: creating a question with order=0 must not overwrite it
    with the next auto-incremented value.
    """
    s = SurveyFactory(created_by=admin_client.user)
    r = admin_client.post(
        reverse("v1:surveys:questions-list"),
        {"survey": str(s.id), "type": "SHORT_TEXT", "title": "Zero", "order": 0},
        format="json",
    )
    assert r.status_code == 201, r.data
    assert r.data["order"] == 0


@pytest.mark.django_db
def test_survey_title_whitespace_rejected(admin_client):
    r = admin_client.post(
        reverse("v1:surveys:surveys-list"),
        {"title": "   ", "response_mode": "IDENTIFIED"},
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_survey_title_trimmed_on_create(admin_client):
    r = admin_client.post(
        reverse("v1:surveys:surveys-list"),
        {"title": "  My Survey  ", "response_mode": "IDENTIFIED"},
    )
    assert r.status_code == 201
    assert r.data["title"] == "My Survey"


@pytest.mark.django_db
def test_unicode_survey_title(admin_client):
    r = admin_client.post(
        reverse("v1:surveys:surveys-list"),
        {"title": "پرسشنامه تست 😀", "response_mode": "IDENTIFIED"},
    )
    assert r.status_code == 201
    assert r.data["title"] == "پرسشنامه تست 😀"


@pytest.mark.django_db
def test_publish_already_published_survey(admin_client):
    from tests.factories import PublishedSurveyFactory
    s = PublishedSurveyFactory(created_by=admin_client.user)
    QuestionFactory(survey=s, order=1)
    r = admin_client.post(reverse("v1:surveys:surveys-publish", args=[s.id]))
    # Idempotent or 400 — depends on business rule; assert no crash
    assert r.status_code in (200, 400)


@pytest.mark.django_db
def test_archive_closed_survey(admin_client):
    from tests.factories import PublishedSurveyFactory
    s = PublishedSurveyFactory(created_by=admin_client.user, status="CLOSED")
    r = admin_client.post(reverse("v1:surveys:surveys-archive", args=[s.id]))
    assert r.status_code == 200
    s.refresh_from_db()
    assert s.status == "ARCHIVED"


@pytest.mark.django_db
def test_soft_deleted_survey_not_in_list(admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    s.soft_delete()
    r = admin_client.get(reverse("v1:surveys:surveys-list"))
    assert r.data["count"] == 0


@pytest.mark.django_db
def test_creator_cannot_edit_other_creators_survey(creator_client):
    """A creator must not be able to PATCH another creator's survey."""
    from tests.factories import CreatorUserFactory
    other = CreatorUserFactory()
    s = SurveyFactory(created_by=other)

    r = creator_client.patch(
        reverse("v1:surveys:surveys-detail", args=[s.id]),
        {"title": "Hijacked"},
        format="json",
    )
    assert r.status_code in (403, 404)


@pytest.mark.django_db
def test_reorder_with_duplicate_orders_rejected(admin_client):
    s = SurveyFactory(created_by=admin_client.user)
    q1 = QuestionFactory(survey=s, order=1)
    q2 = QuestionFactory(survey=s, order=2)

    r = admin_client.post(
        reverse("v1:surveys:questions-reorder"),
        [
            {"id": str(q1.id), "order": 1},
            {"id": str(q2.id), "order": 1},  # duplicate!
        ],
        format="json",
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_choice_question_accepts_system_list_without_options(admin_client):
    """A choice question should validate OK with system_list but no options."""
    from tests.factories import SystemListFactory, ListItemFactory

    sl = SystemListFactory()
    ListItemFactory(system_list=sl, label="A", value="a")
    s = SurveyFactory(created_by=admin_client.user)

    r = admin_client.post(
        reverse("v1:surveys:questions-list"),
        {
            "survey": str(s.id),
            "type": "SINGLE_CHOICE",
            "title": "Pick",
            "system_list": str(sl.id),
        },
        format="json",
    )
    assert r.status_code == 201, r.data
    # NOTE: r.data holds the decoded response (before JSON encoding), so
    # `system_list` may be a UUID instance. Normalize before comparing.
    assert str(r.data["system_list"]) == str(sl.id)