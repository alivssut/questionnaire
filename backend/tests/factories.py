import factory
from factory.django import DjangoModelFactory

from apps.q_accounts.models import User
from apps.q_assignments.models import SurveyAssignment
from apps.q_notifications.models import Notification
from apps.q_responses.models import Answer, AnswerFile, SurveyResponse
from apps.q_surveys.models import (
    ListItem,
    MatrixColumn,
    MatrixRow,
    Question,
    QuestionOption,
    Survey,
    SystemList,
)

DEFAULT_PASSWORD = "Str0ngPass!23"


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------
class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    first_name = "Test"
    last_name = "User"
    is_verified = True
    is_active = True

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):
        if create and extracted is not False:
            obj.set_password(extracted or DEFAULT_PASSWORD)
            obj.save(update_fields=["password"])


class SuperUserFactory(UserFactory):
    is_staff = True
    is_superuser = True


class CreatorUserFactory(UserFactory):
    """A non-superuser with `can_create_survey` permission."""

    @factory.post_generation
    def permissions(obj, create, extracted, **kwargs):
        if not create:
            return
        from django.contrib.auth.models import Permission
        perm = Permission.objects.get(
            content_type__app_label="q_accounts",
            codename="can_create_survey",
        )
        obj.user_permissions.add(perm)


# ---------------------------------------------------------------------------
# Surveys
# ---------------------------------------------------------------------------
class SurveyFactory(DjangoModelFactory):
    class Meta:
        model = Survey

    title = factory.Sequence(lambda n: f"Survey {n}")
    created_by = factory.SubFactory(SuperUserFactory)
    status = Survey.Status.DRAFT
    visibility = Survey.Visibility.ASSIGNED


class PublishedSurveyFactory(SurveyFactory):
    status = Survey.Status.PUBLISHED


class PublicSurveyFactory(PublishedSurveyFactory):
    visibility = Survey.Visibility.PUBLIC


class QuestionFactory(DjangoModelFactory):
    class Meta:
        model = Question

    survey = factory.SubFactory(SurveyFactory)
    type = Question.Type.SHORT_TEXT
    title = "What is your name?"
    order = factory.Sequence(lambda n: n + 1)


class SingleChoiceQuestionFactory(QuestionFactory):
    type = Question.Type.SINGLE_CHOICE

    @factory.post_generation
    def options(obj, create, extracted, **kwargs):
        if not create:
            return
        for i, (label, value) in enumerate(
            [("Yes", "yes"), ("No", "no"), ("Maybe", "maybe")]
        ):
            QuestionOption.objects.create(
                question=obj, label=label, value=value, order=i,
            )


class MatrixQuestionFactory(QuestionFactory):
    type = Question.Type.MATRIX

    @factory.post_generation
    def matrix(obj, create, extracted, **kwargs):
        if not create:
            return
        for i, label in enumerate(["Design", "Speed", "Price"]):
            MatrixRow.objects.create(question=obj, label=label, order=i)
        for i, (label, value) in enumerate(
            [("Bad", "1"), ("OK", "2"), ("Good", "3")]
        ):
            MatrixColumn.objects.create(
                question=obj, label=label, value=value, order=i,
            )


class FileUploadQuestionFactory(QuestionFactory):
    type = Question.Type.FILE_UPLOAD


class SystemListFactory(DjangoModelFactory):
    class Meta:
        model = SystemList

    name = factory.Sequence(lambda n: f"List {n}")
    slug = factory.Sequence(lambda n: f"list-{n}")
    type = SystemList.Type.CUSTOM


class ListItemFactory(DjangoModelFactory):
    class Meta:
        model = ListItem

    system_list = factory.SubFactory(SystemListFactory)
    label = factory.Sequence(lambda n: f"Item {n}")
    value = factory.Sequence(lambda n: f"item-{n}")
    order = factory.Sequence(lambda n: n)


# ---------------------------------------------------------------------------
# Assignments
# ---------------------------------------------------------------------------
class AssignmentFactory(DjangoModelFactory):
    class Meta:
        model = SurveyAssignment

    survey = factory.SubFactory(PublishedSurveyFactory)
    user = factory.SubFactory(UserFactory)
    assigned_by = factory.SubFactory(SuperUserFactory)
    status = SurveyAssignment.Status.PENDING


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------
class SurveyResponseFactory(DjangoModelFactory):
    class Meta:
        model = SurveyResponse

    survey = factory.SubFactory(PublishedSurveyFactory)
    user = factory.SubFactory(UserFactory)
    status = SurveyResponse.Status.DRAFT


class AnswerFactory(DjangoModelFactory):
    class Meta:
        model = Answer

    response = factory.SubFactory(SurveyResponseFactory)
    question = factory.SubFactory(QuestionFactory)
    value = {"text": "Test"}


class AnswerFileFactory(DjangoModelFactory):
    class Meta:
        model = AnswerFile

    survey = factory.SubFactory(PublishedSurveyFactory)
    uploaded_by = factory.SubFactory(UserFactory)
    file = factory.django.FileField(filename="test.txt", data=b"hello")
    original_name = "test.txt"
    content_type = "text/plain"
    size = 5


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
class NotificationFactory(DjangoModelFactory):
    class Meta:
        model = Notification

    user = factory.SubFactory(UserFactory)
    title = "Hello"
    message = "You have a new notification."
    type = Notification.Type.SYSTEM