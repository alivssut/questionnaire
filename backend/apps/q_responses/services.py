from django.db import transaction
from django.utils import timezone

from apps.q_activity.utils import log_activity
from apps.q_surveys.models import Question, Survey
from .models import Answer, AnswerFile, SurveyResponse
from .validators import validate_answer_value


class SubmissionError(Exception):
    pass


def _is_blank_value(question: Question, value) -> bool:
    """
    Return True if `value` should be treated as empty.

    Blank values are allowed in drafts (so the user can leave a question
    temporarily empty) but are rejected at submit for required questions.
    """
    if not value:
        return True
    if not isinstance(value, dict):
        return False
    qt = question.type
    if qt in (Question.Type.SHORT_TEXT, Question.Type.LONG_TEXT):
        t = value.get("text")
        if t is None:
            return True
        if isinstance(t, str) and t.strip() == "":
            return True
    return False


def _validate_required(q: Question, answer: Answer | None) -> bool:
    """True if the answer satisfies the required constraint for its type."""
    if not q.required:
        return True
    if q.type == Question.Type.FILE_UPLOAD:
        return bool(answer and answer.files.exists())
    if answer is None:
        return False
    return bool(answer.value) and validate_answer_value(q, answer.value)


@transaction.atomic
def save_draft(*, user, survey, answers_data, assignment=None) -> SurveyResponse:
    if not survey.is_answerable():
        raise SubmissionError("Survey is not open for responses.")

    if assignment:
        assignment.refresh_status()
        if assignment.status == "OVERDUE" or assignment.is_past_due:
            raise SubmissionError("The deadline for this assignment has passed.")

    existing = SurveyResponse.objects.filter(user=user, survey=survey).first()
    if existing and existing.status == SurveyResponse.Status.SUBMITTED:
        raise SubmissionError("You have already submitted this survey.")

    if existing:
        response = existing
        if assignment and response.assignment_id != assignment.id:
            response.assignment = assignment
            response.save(update_fields=["assignment", "updated_at"])
    else:
        response = SurveyResponse.objects.create(
            user=user, survey=survey, assignment=assignment,
        )

    valid_questions = {q.id: q for q in Question.objects.filter(survey=survey)}

    for item in answers_data:
        qid = item["question"]
        q = valid_questions.get(qid)
        if not q or not q.is_answerable():
            continue

        value = item["value"] or {}

        if q.type == Question.Type.FILE_UPLOAD:
            file_ids = value.get("file_ids") or []
            files = list(
                AnswerFile.objects.filter(
                    id__in=file_ids,
                    survey=survey,
                    uploaded_by=user,
                )
            )
            if len(files) != len(file_ids):
                raise SubmissionError(
                    f"Some file_ids for question {qid} are invalid."
                )
            answer, _ = Answer.objects.update_or_create(
                response=response, question=q, defaults={"value": {}},
            )
            # Reject files already linked elsewhere
            for f in files:
                if f.answer_id is not None and f.answer_id != answer.id:
                    raise SubmissionError(
                        f"File {f.id} is already linked to another answer."
                    )
            answer.files.update(answer=None)
            for i, f in enumerate(files):
                f.answer = answer
                f.order = i
                f.save(update_fields=["answer", "order", "updated_at"])
            continue

        # Non-blank values must validate. Blank values are allowed in drafts.
        if not _is_blank_value(q, value) and not validate_answer_value(q, value):
            raise SubmissionError(
                f"Invalid answer for question {qid} (type={q.type})."
            )

        Answer.objects.update_or_create(
            response=response, question=q, defaults={"value": value},
        )

    return response


@transaction.atomic
def submit_response(*, user, response: SurveyResponse) -> SurveyResponse:
    if response.status == SurveyResponse.Status.SUBMITTED:
        return response

    survey = response.survey
    if survey.status == Survey.Status.CLOSED:
        raise SubmissionError("Survey is closed.")
    if survey.status != Survey.Status.PUBLISHED:
        raise SubmissionError("Survey is not open for responses.")
    if survey.is_deleted:
        raise SubmissionError("Survey is no longer available.")

    if response.assignment:
        response.assignment.refresh_status()
        if (
            response.assignment.status == "OVERDUE"
            or response.assignment.is_past_due
        ):
            raise SubmissionError("The deadline for this assignment has passed.")

    questions = list(Question.objects.filter(survey=survey))
    answers = {a.question_id: a for a in response.answers.prefetch_related("files")}

    missing = []
    for q in questions:
        if q.type in Question.NON_ANSWERABLE_TYPES:
            continue
        if not _validate_required(q, answers.get(q.id)):
            missing.append(str(q.id))

    if missing:
        raise SubmissionError(
            f"Missing or invalid answers for required questions: {missing}"
        )

    for q_id, a in answers.items():
        q = next((x for x in questions if x.id == q_id), None)
        if q is None:
            continue
        if q.type == Question.Type.FILE_UPLOAD:
            continue
        if a.value and q.is_answerable() and not validate_answer_value(q, a.value):
            raise SubmissionError(f"Invalid answer for question {q_id}.")

    response.status = SurveyResponse.Status.SUBMITTED
    response.submitted_at = timezone.now()
    response.completion_time = response.submitted_at - response.started_at
    response.save(
        update_fields=["status", "submitted_at", "completion_time", "updated_at"]
    )

    if response.assignment:
        from apps.q_assignments.models import SurveyAssignment
        a = response.assignment
        a.status = SurveyAssignment.Status.COMPLETED
        a.completed_at = response.submitted_at
        a.save(update_fields=["status", "completed_at", "updated_at"])

    log_activity(user, "response.submitted", response, "Submitted response")

    from apps.q_analytics.services import invalidate_survey_cache
    invalidate_survey_cache(survey.id)

    return response