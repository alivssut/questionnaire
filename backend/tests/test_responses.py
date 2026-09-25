from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone

from apps.q_responses.models import AnswerFile
from tests.factories import (
    AssignmentFactory,
    FileUploadQuestionFactory,
    PublicSurveyFactory,
    PublishedSurveyFactory,
    QuestionFactory,
    SingleChoiceQuestionFactory,
    SurveyResponseFactory,
)


# ---------------------------------------------------------------------------
# Draft + submit
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_save_draft_and_submit(user_client):
    survey = PublicSurveyFactory()
    q = QuestionFactory(survey=survey, order=1, required=True)

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{"question": str(q.id), "value": {"text": "Hello"}}],
        },
        format="json",
    )
    assert r.status_code == 200, r.data
    rid = r.data["id"]

    sub = user_client.post(reverse("v1:responses:responses-submit", args=[rid]))
    assert sub.status_code == 200, sub.data
    assert sub.data["status"] == "SUBMITTED"


@pytest.mark.django_db
def test_submit_fails_when_required_missing(user_client):
    survey = PublicSurveyFactory()
    QuestionFactory(survey=survey, order=1, required=True)

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {"survey": str(survey.id), "answers": []},
        format="json",
    )
    rid = r.data["id"]
    sub = user_client.post(reverse("v1:responses:responses-submit", args=[rid]))
    assert sub.status_code == 400


@pytest.mark.django_db
def test_submit_fails_when_required_is_empty(user_client):
    survey = PublicSurveyFactory()
    q = QuestionFactory(survey=survey, order=1, required=True)

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{"question": str(q.id), "value": {"text": "   "}}],
        },
        format="json",
    )
    rid = r.data["id"]
    sub = user_client.post(reverse("v1:responses:responses-submit", args=[rid]))
    assert sub.status_code == 400


@pytest.mark.django_db
def test_invalid_optional_answer_is_rejected(user_client):
    survey = PublicSurveyFactory()
    q = QuestionFactory(
        survey=survey, order=1,
        type="NUMBER", required=False, settings={"min": 1, "max": 10},
    )
    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{"question": str(q.id), "value": {"value": 100}}],
        },
        format="json",
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_unassigned_user_cannot_save_draft(user_client):
    survey = PublishedSurveyFactory(visibility="ASSIGNED")
    QuestionFactory(survey=survey, order=1)
    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {"survey": str(survey.id), "answers": []},
        format="json",
    )
    assert r.status_code == 403


@pytest.mark.django_db
def test_public_survey_no_assignment_needed(user_client):
    survey = PublicSurveyFactory()
    q = QuestionFactory(survey=survey, order=1, required=True)
    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{"question": str(q.id), "value": {"text": "hi"}}],
        },
        format="json",
    )
    assert r.status_code == 200


@pytest.mark.django_db
def test_save_draft_after_submit_returns_400(user_client):
    survey = PublicSurveyFactory()
    q = QuestionFactory(survey=survey, order=1, required=True)

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{"question": str(q.id), "value": {"text": "ok"}}],
        },
        format="json",
    )
    rid = r.data["id"]
    user_client.post(reverse("v1:responses:responses-submit", args=[rid]))

    r2 = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{"question": str(q.id), "value": {"text": "again"}}],
        },
        format="json",
    )
    assert r2.status_code == 400
    assert "already submitted" in str(r2.data).lower()


@pytest.mark.django_db
def test_save_draft_on_closed_survey_rejected(user_client):
    survey = PublishedSurveyFactory(status="CLOSED")
    QuestionFactory(survey=survey, order=1)
    AssignmentFactory(survey=survey, user=user_client.user)

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {"survey": str(survey.id), "answers": []},
        format="json",
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_save_draft_blocked_on_overdue_assignment(user_client):
    survey = PublishedSurveyFactory()
    q = QuestionFactory(survey=survey, order=1)
    AssignmentFactory(
        survey=survey, user=user_client.user,
        due_date=timezone.now() - timedelta(hours=1),
        status="PENDING",
    )

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{"question": str(q.id), "value": {"text": "late"}}],
        },
        format="json",
    )
    assert r.status_code == 400
    assert "deadline" in str(r.data).lower()


# ---------------------------------------------------------------------------
# Anonymous surveys
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_anonymous_survey_hides_user(user_client):
    survey = PublicSurveyFactory(response_mode="ANONYMOUS")
    q = QuestionFactory(survey=survey, order=1, required=True)

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{"question": str(q.id), "value": {"text": "x"}}],
        },
        format="json",
    )
    assert r.status_code == 200
    assert r.data["user"] is None


# ---------------------------------------------------------------------------
# Choice / matrix answers
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_single_choice_valid_value(user_client):
    survey = PublicSurveyFactory()
    q = SingleChoiceQuestionFactory(survey=survey, required=True)

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{"question": str(q.id), "value": {"value": "yes"}}],
        },
        format="json",
    )
    assert r.status_code == 200, r.data


@pytest.mark.django_db
def test_single_choice_invalid_value(user_client):
    survey = PublicSurveyFactory()
    q = SingleChoiceQuestionFactory(survey=survey, required=True)

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{"question": str(q.id), "value": {"value": "banana"}}],
        },
        format="json",
    )
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# File upload
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_answer_file_upload_requires_survey_id(user_client):
    f = SimpleUploadedFile("hello.txt", b"hello", content_type="text/plain")
    r = user_client.post(
        reverse("v1:responses:upload"),
        {"file": f},
        format="multipart",
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_answer_file_upload_requires_access(user_client):
    survey = PublishedSurveyFactory(visibility="ASSIGNED")
    f = SimpleUploadedFile("hello.txt", b"hello", content_type="text/plain")
    r = user_client.post(
        reverse("v1:responses:upload"),
        {"file": f, "survey_id": str(survey.id)},
        format="multipart",
    )
    assert r.status_code == 403


@pytest.mark.django_db
def test_answer_file_upload_ok_on_assigned(user_client):
    a = AssignmentFactory(user=user_client.user)
    f = SimpleUploadedFile("hello.txt", b"hello", content_type="text/plain")
    r = user_client.post(
        reverse("v1:responses:upload"),
        {"file": f, "survey_id": str(a.survey_id)},
        format="multipart",
    )
    assert r.status_code == 201, r.data
    assert r.data["original_name"] == "hello.txt"
    assert "url" in r.data


@pytest.mark.django_db
def test_answer_file_upload_ok_on_public(user_client):
    survey = PublicSurveyFactory()
    f = SimpleUploadedFile("hello.txt", b"hello", content_type="text/plain")
    r = user_client.post(
        reverse("v1:responses:upload"),
        {"file": f, "survey_id": str(survey.id)},
        format="multipart",
    )
    assert r.status_code == 201


@pytest.mark.django_db
def test_answer_file_upload_rejects_bad_mime(user_client):
    survey = PublicSurveyFactory()
    f = SimpleUploadedFile(
        "evil.exe", b"x", content_type="application/x-msdownload",
    )
    r = user_client.post(
        reverse("v1:responses:upload"),
        {"file": f, "survey_id": str(survey.id)},
        format="multipart",
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_file_upload_question_flow(user_client):
    """Upload a file, then link it via save-draft."""
    survey = PublicSurveyFactory()
    q = FileUploadQuestionFactory(survey=survey, required=True)

    f = SimpleUploadedFile("doc.pdf", b"pdf-data", content_type="application/pdf")
    up = user_client.post(
        reverse("v1:responses:upload"),
        {"file": f, "survey_id": str(survey.id)},
        format="multipart",
    )
    file_id = up.data["id"]

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{
                "question": str(q.id),
                "value": {"file_ids": [file_id]},
            }],
        },
        format="json",
    )
    assert r.status_code == 200, r.data
    af = AnswerFile.objects.get(id=file_id)
    assert af.answer is not None

    rid = r.data["id"]
    sub = user_client.post(reverse("v1:responses:responses-submit", args=[rid]))
    assert sub.status_code == 200


@pytest.mark.django_db
def test_file_upload_question_required_missing(user_client):
    survey = PublicSurveyFactory()
    FileUploadQuestionFactory(survey=survey, required=True)

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {"survey": str(survey.id), "answers": []},
        format="json",
    )
    rid = r.data["id"]
    sub = user_client.post(reverse("v1:responses:responses-submit", args=[rid]))
    assert sub.status_code == 400


@pytest.mark.django_db
def test_cannot_link_another_users_file(user_client, make_client):
    from tests.factories import UserFactory

    survey = PublicSurveyFactory()
    q = FileUploadQuestionFactory(survey=survey)
    other = UserFactory()
    other_client = make_client(other)

    f = SimpleUploadedFile("doc.pdf", b"pdf", content_type="application/pdf")
    up = other_client.post(
        reverse("v1:responses:upload"),
        {"file": f, "survey_id": str(survey.id)},
        format="multipart",
    )
    other_file_id = up.data["id"]

    r = user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{
                "question": str(q.id),
                "value": {"file_ids": [other_file_id]},
            }],
        },
        format="json",
    )
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Draft retrieval
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_my_draft_returns_saved(user_client):
    survey = PublicSurveyFactory()
    q = QuestionFactory(survey=survey, order=1)
    user_client.post(
        reverse("v1:responses:responses-save-draft"),
        {
            "survey": str(survey.id),
            "answers": [{"question": str(q.id), "value": {"text": "draft"}}],
        },
        format="json",
    )
    r = user_client.get(
        reverse("v1:responses:responses-my-draft", args=[survey.id]),
    )
    assert r.status_code == 200
    assert r.data["status"] == "DRAFT"


@pytest.mark.django_db
def test_my_draft_404_when_none(user_client):
    survey = PublicSurveyFactory()
    r = user_client.get(
        reverse("v1:responses:responses-my-draft", args=[survey.id]),
    )
    assert r.status_code == 404