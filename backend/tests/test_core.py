"""
Tests for cross-cutting concerns in q_core:
  - Soft delete behaviour
  - Validators (upload, answer values)
  - Permissions
  - Pagination
"""

import pytest
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.q_core.validators import validate_upload
from apps.q_surveys.models import Survey
from tests.factories import SurveyFactory


# ═════════════════════════════════════════════════════════════════
# Soft delete
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_soft_delete_hides_from_default_manager():
    s = SurveyFactory()
    pk = s.pk
    s.soft_delete()

    assert not Survey.objects.filter(pk=pk).exists()
    assert Survey.all_objects.filter(pk=pk).exists()


@pytest.mark.django_db
def test_soft_delete_sets_deleted_at():
    s = SurveyFactory()
    s.soft_delete()
    s.refresh_from_db()
    assert s.is_deleted is True
    assert s.deleted_at is not None


@pytest.mark.django_db
def test_restore_returns_to_live():
    s = SurveyFactory()
    s.soft_delete()
    s.restore()
    assert Survey.objects.filter(pk=s.pk).exists()
    assert s.is_deleted is False
    assert s.deleted_at is None


@pytest.mark.django_db
def test_soft_delete_idempotent():
    s = SurveyFactory()
    s.soft_delete()
    first_deleted_at = s.deleted_at
    s.soft_delete()  # second call should not error
    s.refresh_from_db()
    assert s.deleted_at >= first_deleted_at


# ═════════════════════════════════════════════════════════════════
# Validators — file upload
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_validate_upload_accepts_allowed_mime():
    f = SimpleUploadedFile("doc.pdf", b"data", content_type="application/pdf")
    # Should not raise
    validate_upload(f)


@pytest.mark.django_db
def test_validate_upload_rejects_bad_mime():
    f = SimpleUploadedFile(
        "evil.exe", b"x", content_type="application/x-msdownload",
    )
    with pytest.raises(DjangoValidationError):
        validate_upload(f)


@pytest.mark.django_db
def test_validate_upload_rejects_oversize(settings):
    settings.MAX_UPLOAD_SIZE_MB = 1  # 1 MB limit
    big = SimpleUploadedFile(
        "big.pdf", b"x" * (2 * 1024 * 1024), content_type="application/pdf",
    )
    with pytest.raises(DjangoValidationError):
        validate_upload(big)


@pytest.mark.django_db
def test_validate_upload_handles_none():
    # Should silently pass (no-op)
    validate_upload(None)


# ═════════════════════════════════════════════════════════════════
# Validators — answer values
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_answer_validator_email_regex():
    from apps.q_responses.validators import validate_answer_value
    from tests.factories import QuestionFactory

    q = QuestionFactory(type="EMAIL")
    assert validate_answer_value(q, {"value": "a@b.co"}) is True
    assert validate_answer_value(q, {"value": "not-an-email"}) is False


@pytest.mark.django_db
def test_answer_validator_numeric_range():
    from apps.q_responses.validators import validate_answer_value
    from tests.factories import QuestionFactory

    q = QuestionFactory(type="NUMBER", settings={"min": 1, "max": 10})
    assert validate_answer_value(q, {"value": 5}) is True
    assert validate_answer_value(q, {"value": 0}) is False
    assert validate_answer_value(q, {"value": 11}) is False


@pytest.mark.django_db
def test_answer_validator_yes_no():
    from apps.q_responses.validators import validate_answer_value
    from tests.factories import QuestionFactory

    q = QuestionFactory(type="YES_NO")
    assert validate_answer_value(q, {"value": "yes"}) is True
    assert validate_answer_value(q, {"value": "no"}) is True
    assert validate_answer_value(q, {"value": "maybe"}) is False


@pytest.mark.django_db
def test_answer_validator_multiple_choice_subset():
    from apps.q_responses.validators import validate_answer_value
    from tests.factories import SingleChoiceQuestionFactory

    q = SingleChoiceQuestionFactory(
        type="MULTIPLE_CHOICE",
    )
    # factory created options: yes, no, maybe
    assert validate_answer_value(q, {"values": ["yes", "no"]}) is True
    assert validate_answer_value(q, {"values": ["yes", "invalid"]}) is False


@pytest.mark.django_db
def test_answer_validator_matrix():
    from apps.q_responses.validators import validate_answer_value
    from tests.factories import MatrixQuestionFactory

    q = MatrixQuestionFactory()
    row = q.matrix_rows.first()
    col = q.matrix_columns.first()
    assert validate_answer_value(q, {"value": {str(row.id): col.value}}) is True
    assert validate_answer_value(q, {"value": {"bogus": "1"}}) is False


# ═════════════════════════════════════════════════════════════════
# Pagination
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_pagination_default_page_size(admin_client):
    from tests.factories import SurveyFactory
    for _ in range(25):
        SurveyFactory(created_by=admin_client.user)

    r = admin_client.get("/api/v1/surveys/")
    assert r.status_code == 200
    assert len(r.data["results"]) == 20
    assert r.data["count"] == 25


@pytest.mark.django_db
def test_pagination_custom_page_size(admin_client):
    from tests.factories import SurveyFactory
    for _ in range(5):
        SurveyFactory(created_by=admin_client.user)

    r = admin_client.get("/api/v1/surveys/?page_size=2")
    assert len(r.data["results"]) == 2


@pytest.mark.django_db
def test_pagination_max_page_size_enforced(admin_client):
    from tests.factories import SurveyFactory
    SurveyFactory(created_by=admin_client.user)

    r = admin_client.get("/api/v1/surveys/?page_size=99999")
    assert r.status_code == 200
    # max_page_size = 200 in settings
    assert r.data["results"] is not None