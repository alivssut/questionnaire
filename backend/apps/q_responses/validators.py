import re

from apps.q_surveys.models import Question

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
URL_RE = re.compile(r"^https?://\S+$", re.IGNORECASE)
PHONE_RE = re.compile(r"^\+?[0-9\s\-()]{6,20}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^\d{2}:\d{2}(:\d{2})?$")
DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?")


def _choice_values(question: Question):
    """Return valid values for a choice question.

    Prefer `system_list` when set — this protects against stale options that
    may remain in the DB after switching a question to use a system list.
    """
    # Prefer system_list when it exists and has items
    if question.system_list_id:
        vals = set(question.system_list.items.values_list("value", flat=True))
        if vals:
            return vals

    # Fall back to explicit options
    opts = list(question.options.values_list("value", flat=True))
    if opts:
        return set(opts)

    return None


def _matrix_columns(question: Question):
    cols = set(question.matrix_columns.values_list("value", flat=True))
    return cols or None


def _matrix_rows(question: Question):
    return set(str(r) for r in question.matrix_rows.values_list("id", flat=True))


def validate_answer_value(question: Question, value) -> bool:
    if question.type in Question.NON_ANSWERABLE_TYPES:
        return True
    if question.type == Question.Type.FILE_UPLOAD:
        return True
    if not isinstance(value, dict):
        return False

    qt = question.type
    settings = question.settings or {}

    if qt in (Question.Type.SHORT_TEXT, Question.Type.LONG_TEXT):
        text = value.get("text")
        return isinstance(text, str) and text.strip() != ""

    if qt == Question.Type.EMAIL:
        v = value.get("value")
        return isinstance(v, str) and bool(EMAIL_RE.match(v.strip()))

    if qt == Question.Type.URL:
        v = value.get("value")
        return isinstance(v, str) and bool(URL_RE.match(v.strip()))

    if qt == Question.Type.PHONE:
        v = value.get("value")
        return isinstance(v, str) and bool(PHONE_RE.match(v.strip()))

    if qt in Question.NUMERIC_TYPES:
        v = value.get("value")
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            return False
        mn, mx = settings.get("min"), settings.get("max")
        if mn is not None and v < mn:
            return False
        if mx is not None and v > mx:
            return False
        return True

    if qt in (Question.Type.SINGLE_CHOICE, Question.Type.DROPDOWN, Question.Type.LIKERT):
        v = value.get("value")
        if not isinstance(v, str) or not v.strip():
            return False
        valid = _choice_values(question)
        return not (valid is not None and v not in valid)

    if qt == Question.Type.YES_NO:
        v = value.get("value")
        return v in ("yes", "no", True, False)

    if qt == Question.Type.MULTIPLE_CHOICE:
        values = value.get("values")
        if not isinstance(values, list) or not values:
            return False
        if not all(isinstance(x, str) for x in values):
            return False
        valid = _choice_values(question)
        return not (valid is not None and not set(values).issubset(valid))

    if qt == Question.Type.RANKING:
        values = value.get("values")
        if not isinstance(values, list) or not values:
            return False
        valid = _choice_values(question)
        if valid is not None and set(values) != valid:
            return False
        return len(set(values)) == len(values)

    if qt == Question.Type.DATE:
        v = value.get("value")
        return isinstance(v, str) and bool(DATE_RE.match(v.strip()))

    if qt == Question.Type.TIME:
        v = value.get("value")
        return isinstance(v, str) and bool(TIME_RE.match(v.strip()))

    if qt == Question.Type.DATETIME:
        v = value.get("value")
        return isinstance(v, str) and bool(DATETIME_RE.match(v.strip()))

    if qt == Question.Type.MATRIX:
        v = value.get("value")
        if not isinstance(v, dict) or not v:
            return False
        row_ids = _matrix_rows(question)
        col_values = _matrix_columns(question)
        for row_id, col_val in v.items():
            if row_ids and str(row_id) not in row_ids:
                return False
            if col_values is not None and str(col_val) not in col_values:
                return False
        return True

    return bool(value)