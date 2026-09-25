from collections import defaultdict
from datetime import timedelta

from django.core.cache import cache
from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.q_accounts.models import User
from apps.q_assignments.models import SurveyAssignment
from apps.q_responses.models import Answer, SurveyResponse
from apps.q_surveys.models import Question, Survey

# ═════════════════════════════════════════════════════════════════
# Constants
# ═════════════════════════════════════════════════════════════════

CACHE_TTL = 60 * 5  # 5 minutes

# Hard cap on timeline length. Without this, a survey whose first
# response is a year ago would produce a 365-point series on every call
# (~20 KB payload per request, even with frontend sampling).
MAX_TIMELINE_DAYS = 180

# Default window when no range is provided and the survey has no responses.
DEFAULT_TIMELINE_DAYS = 30

# Question type groups (resolved once at import time).
_CHOICE_TYPES = frozenset({
    Question.Type.SINGLE_CHOICE,
    Question.Type.MULTIPLE_CHOICE,
    Question.Type.DROPDOWN,
    Question.Type.YES_NO,
    Question.Type.LIKERT,
})
_RANKING_TYPE = Question.Type.RANKING
_MATRIX_TYPE = Question.Type.MATRIX
_FILE_UPLOAD_TYPE = Question.Type.FILE_UPLOAD


# ═════════════════════════════════════════════════════════════════
# Cache helpers — version-based invalidation
# ═════════════════════════════════════════════════════════════════
#
# Problem: cache keys include (preset, from, to), so we can't delete every
# variant by name. Redis and LocMem both lack wildcard deletes.
#
# Solution: store a per-survey version counter and embed it in every key.
# To invalidate, we simply bump the counter — old keys become unreachable
# and expire naturally. New requests read fresh data.
# ═════════════════════════════════════════════════════════════════

def _survey_version_key(survey_id) -> str:
    return f"analytics:survey:{survey_id}:version"


def _survey_cache_key(survey_id, preset, date_from, date_to) -> str:
    version = cache.get(_survey_version_key(survey_id), 0)
    return (
        f"analytics:survey:{survey_id}:v{version}:"
        f"{preset or ''}:{date_from or ''}:{date_to or ''}"
    )


def invalidate_survey_cache(survey_id):
    """
    Invalidate every cached analytics variant for one survey.

    Bumps the version counter so all existing cache entries become
    unreachable. Also clears the global stats cache (aggregate numbers
    change when a new response lands).
    """
    version_key = _survey_version_key(survey_id)
    try:
        cache.incr(version_key)
    except ValueError:
        # `incr` raises ValueError if the key doesn't exist yet.
        cache.set(version_key, 1, timeout=None)
    cache.delete("analytics:global")


def invalidate_all():
    """Clear only the global stats cache (survey versions are untouched)."""
    cache.delete("analytics:global")


# ═════════════════════════════════════════════════════════════════
# Date range helpers
# ═════════════════════════════════════════════════════════════════

PRESET_RANGES = {
    "7d": 7,
    "14d": 14,
    "30d": 30,
    "90d": 90,
    "1y": 365,
}


def resolve_date_range(
    preset: str | None,
    date_from: str | None,
    date_to: str | None,
) -> tuple:
    """
    Returns (start_dt, end_dt) in UTC. Both may be None if no filter is set.

    Priority: explicit date_from/date_to > preset.

    Note on presets: for a preset like "30d", we return `(now - 30d, now)` —
    NOT `(now - 30d, None)`. This is important: `_compare_periods` needs
    both bounds to compute a "previous period of equal length". Without an
    explicit `end_dt`, comparison would always return None.
    """
    now = timezone.now()

    if date_from or date_to:
        start = parse_date(date_from) if date_from else None
        end = parse_date(date_to) if date_to else None

        start_dt = (
            timezone.make_aware(
                timezone.datetime.combine(start, timezone.datetime.min.time())
            )
            if start
            else None
        )
        end_dt = (
            timezone.make_aware(
                timezone.datetime.combine(end, timezone.datetime.max.time())
            )
            if end
            else None
        )
        return start_dt, end_dt

    if preset and preset in PRESET_RANGES:
        days = PRESET_RANGES[preset]
        # ⚠️ end_dt = now (not None) so period comparison works.
        return now - timedelta(days=days), now

    return None, None


def _apply_range(qs, start_dt, end_dt, field="started_at"):
    if start_dt:
        qs = qs.filter(**{f"{field}__gte": start_dt})
    if end_dt:
        qs = qs.filter(**{f"{field}__lte": end_dt})
    return qs


# ═════════════════════════════════════════════════════════════════
# Global stats
# ═════════════════════════════════════════════════════════════════

def global_stats():
    cached = cache.get("analytics:global")
    if cached:
        return cached

    total_users = User.objects.count()
    total_surveys = Survey.objects.count()
    total_responses = SurveyResponse.objects.filter(
        status=SurveyResponse.Status.SUBMITTED,
    ).count()

    # Combined assignment aggregate — one query instead of two.
    asn = SurveyAssignment.objects.aggregate(
        total=Count("id"),
        completed=Count(
            "id",
            filter=Q(status=SurveyAssignment.Status.COMPLETED),
        ),
    )
    total_assignments = asn["total"]
    completed = asn["completed"]
    completion_rate = (
        round((completed / total_assignments) * 100, 2) if total_assignments else 0.0
    )

    data = {
        "total_users": total_users,
        "total_surveys": total_surveys,
        "total_responses": total_responses,
        "total_assignments": total_assignments,
        "completion_rate": completion_rate,
        "generated_at": timezone.now().isoformat(),
    }
    cache.set("analytics:global", data, CACHE_TTL)
    return data


# ═════════════════════════════════════════════════════════════════
# Batched distribution computation
# ═════════════════════════════════════════════════════════════════
#
# NOTE on memory:
# `_load_answers_by_question` pulls every answer value into memory.
# For a survey with N responses × M questions, that's N×M dicts.
# This is fine up to a few hundred thousand (well under 100 MB).
# Beyond that, switch to DB-side aggregation using JSONB operators
# (Postgres `value->>'value'` + GROUP BY). Not done here to keep the
# code portable across SQLite/Postgres in dev.
# ═════════════════════════════════════════════════════════════════

def _load_answers_by_question(question_ids, start_dt, end_dt):
    """
    ONE query: fetch all answer values for the given questions.
    Returns `{question_id: [value_dict, ...]}`.
    """
    if not question_ids:
        return {}

    qs = Answer.objects.filter(
        question_id__in=question_ids,
        response__status=SurveyResponse.Status.SUBMITTED,
    )
    qs = _apply_range(qs, start_dt, end_dt, field="response__submitted_at")
    qs = qs.values_list("question_id", "value")

    grouped: dict = defaultdict(list)
    for qid, val in qs:
        if isinstance(val, dict):
            grouped[qid].append(val)
    return grouped


def _load_file_counts(question_ids, start_dt, end_dt):
    """ONE query: file counts per question_id for FILE_UPLOAD questions."""
    if not question_ids:
        return {}

    qs = Answer.objects.filter(
        question_id__in=question_ids,
        response__status=SurveyResponse.Status.SUBMITTED,
    )
    qs = _apply_range(qs, start_dt, end_dt, field="response__submitted_at")
    rows = qs.values("question_id").annotate(c=Count("files"))
    return {row["question_id"]: row["c"] for row in rows}


def _choice_from_values(values):
    counts: dict = defaultdict(int)
    for v in values:
        single = v.get("value")
        if isinstance(single, (str, bool)):
            counts[str(single)] += 1
        multi = v.get("values")
        if isinstance(multi, list):
            for item in multi:
                if isinstance(item, str):
                    counts[item] += 1
    return {"counts": dict(counts)}


def _ranking_from_values(values):
    counts: dict = defaultdict(int)
    for v in values:
        items = v.get("values")
        if isinstance(items, list):
            for item in items:
                if isinstance(item, str):
                    counts[item] += 1
    return {"counts": dict(counts)}


def _numeric_from_values(values):
    nums: list = []
    for v in values:
        val = v.get("value")
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            nums.append(val)

    histogram: dict = defaultdict(int)
    for n in nums:
        histogram[int(round(n))] += 1

    return {
        "count": len(nums),
        "average": round(sum(nums) / len(nums), 2) if nums else None,
        "min": min(nums) if nums else None,
        "max": max(nums) if nums else None,
        "histogram": {str(k): v for k, v in sorted(histogram.items())},
    }


def _matrix_from_values(values):
    counts: dict = defaultdict(int)
    for v in values:
        cell = v.get("value")
        if not isinstance(cell, dict):
            continue
        for row_id, col_val in cell.items():
            counts[f"{row_id}:{col_val}"] += 1
    return {"matrix_counts": dict(counts)}


def _compute_distribution_for_question(question, values):
    t = question.type
    if t in _CHOICE_TYPES:
        return _choice_from_values(values)
    if t == _RANKING_TYPE:
        return _ranking_from_values(values)
    if t in Question.NUMERIC_TYPES:
        return _numeric_from_values(values)
    if t == _MATRIX_TYPE:
        return _matrix_from_values(values)
    if t == _FILE_UPLOAD_TYPE:
        return {}  # filled separately by file-count pass
    return {}


# ═════════════════════════════════════════════════════════════════
# Timeline
# ═════════════════════════════════════════════════════════════════

def _timeline(survey_id, start_dt, end_dt):
    """
    Daily time series of submitted responses. Continuous (zeros filled).

    The series length is capped at MAX_TIMELINE_DAYS to protect against
    very old surveys blowing up the payload.
    """
    now = timezone.now()

    if not start_dt and not end_dt:
        start_dt = now - timedelta(days=DEFAULT_TIMELINE_DAYS)
        end_dt = now

    if not start_dt:
        first = (
            SurveyResponse.objects.filter(
                survey_id=survey_id,
                status=SurveyResponse.Status.SUBMITTED,
            )
            .order_by("submitted_at")
            .only("submitted_at")
            .first()
        )
        start_dt = first.submitted_at if first else now - timedelta(days=DEFAULT_TIMELINE_DAYS)

    if not end_dt:
        end_dt = now

    # ⚠️ Hard cap on window length.
    earliest_allowed = end_dt - timedelta(days=MAX_TIMELINE_DAYS)
    if start_dt < earliest_allowed:
        start_dt = earliest_allowed

    # Defensive: guard against invalid ranges (shouldn't happen, but cheap).
    if start_dt > end_dt:
        start_dt = end_dt - timedelta(days=DEFAULT_TIMELINE_DAYS)

    qs = (
        SurveyResponse.objects.filter(
            survey_id=survey_id,
            status=SurveyResponse.Status.SUBMITTED,
            submitted_at__gte=start_dt,
            submitted_at__lte=end_dt,
        )
        .annotate(day=TruncDate("submitted_at"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )

    by_day = {row["day"]: row["count"] for row in qs}

    series = []
    current = start_dt.date()
    end_date = end_dt.date()
    while current <= end_date:
        series.append({"date": current.isoformat(), "count": by_day.get(current, 0)})
        current += timedelta(days=1)

    return series


# ═════════════════════════════════════════════════════════════════
# Period comparison
# ═════════════════════════════════════════════════════════════════

def _metrics_for_period(survey_id, start, end):
    """All metrics for one period in 2 queries (responses + assignments)."""
    resp = SurveyResponse.objects.filter(
        survey_id=survey_id,
        status=SurveyResponse.Status.SUBMITTED,
        submitted_at__gte=start,
        submitted_at__lte=end,
    ).aggregate(
        count=Count("id"),
        avg=Avg("completion_time"),
    )

    avg = resp["avg"]
    avg_min = round(avg.total_seconds() / 60, 2) if avg else 0.0

    asn = SurveyAssignment.objects.filter(
        survey_id=survey_id,
        assigned_at__gte=start,
        assigned_at__lte=end,
    ).aggregate(
        total=Count("id"),
        completed=Count("id", filter=Q(status=SurveyAssignment.Status.COMPLETED)),
    )

    total = asn["total"]
    rate = round((asn["completed"] / total) * 100, 2) if total else 0.0

    return {
        "responses": resp["count"],
        "avg_minutes": avg_min,
        "completion_rate": rate,
    }


def _compare_periods(survey_id, start_dt, end_dt):
    """
    Compare the current range vs the immediately preceding one of equal
    length. Returns None when either bound is missing (nothing to compare).
    """
    if not start_dt or not end_dt:
        return None

    length = end_dt - start_dt
    prev_start = start_dt - length
    prev_end = start_dt - timedelta(seconds=1)

    current = _metrics_for_period(survey_id, start_dt, end_dt)
    previous = _metrics_for_period(survey_id, prev_start, prev_end)

    def _delta(cur, prev):
        if prev == 0:
            return None
        return round(((cur - prev) / prev) * 100, 2)

    return {
        "current": current,
        "previous": previous,
        "delta": {
            "responses": _delta(current["responses"], previous["responses"]),
            "avg_minutes": _delta(current["avg_minutes"], previous["avg_minutes"]),
            "completion_rate": _delta(
                current["completion_rate"], previous["completion_rate"]
            ),
        },
    }


# ═════════════════════════════════════════════════════════════════
# Survey stats — orchestrator
# ═════════════════════════════════════════════════════════════════

def survey_stats(survey_id, preset=None, date_from=None, date_to=None):
    """
    Stats for one survey, optionally scoped to a date range.

    Query cost (prod, JWT):  ~9 queries regardless of question count.
      - 1  survey existence
      - 1  response aggregate (count + avg)
      - 1  assignment aggregate (total + completed)
      - 1  questions list
      - 1  batch answers for all questions
      - 1  batch file counts
      - 1  timeline
      - 2  comparison (current + previous)
    """
    cache_key = _survey_cache_key(survey_id, preset, date_from, date_to)
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Cheap existence check.
    if not Survey.objects.filter(id=survey_id).only("id").exists():
        return None

    start_dt, end_dt = resolve_date_range(preset, date_from, date_to)

    # ── Response metrics — single aggregate ───────────────────
    responses = SurveyResponse.objects.filter(
        survey_id=survey_id,
        status=SurveyResponse.Status.SUBMITTED,
    )
    responses = _apply_range(responses, start_dt, end_dt, field="submitted_at")
    resp_agg = responses.aggregate(
        count=Count("id"),
        avg=Avg("completion_time"),
    )
    responses_count = resp_agg["count"]
    avg_duration = resp_agg["avg"]
    avg_minutes = round(avg_duration.total_seconds() / 60, 2) if avg_duration else 0.0

    # ── Assignment metrics — single aggregate ─────────────────
    assignments = SurveyAssignment.objects.filter(survey_id=survey_id)
    assignments = _apply_range(assignments, start_dt, end_dt, field="assigned_at")
    asn_agg = assignments.aggregate(
        total=Count("id"),
        completed=Count("id", filter=Q(status=SurveyAssignment.Status.COMPLETED)),
    )
    total_assigned = asn_agg["total"]
    completed = asn_agg["completed"]
    completion_rate = (
        round((completed / total_assigned) * 100, 2) if total_assigned else 0.0
    )

    # ── Question distributions — batched ──────────────────────
    questions = list(
        Question.objects.filter(survey_id=survey_id)
        .exclude(type__in=Question.NON_ANSWERABLE_TYPES)
        .order_by("order")
    )

    question_ids = [q.id for q in questions]
    file_q_ids = [q.id for q in questions if q.type == _FILE_UPLOAD_TYPE]

    # 1 query: all answers grouped by question_id
    answers_by_q = _load_answers_by_question(question_ids, start_dt, end_dt)
    # 1 query: file counts for FILE_UPLOAD questions
    file_counts = _load_file_counts(file_q_ids, start_dt, end_dt)

    distribution = []
    for q in questions:
        entry = {
            "question_id": str(q.id),
            "title": q.title,
            "type": q.type,
        }
        entry.update(_compute_distribution_for_question(q, answers_by_q.get(q.id, [])))
        if q.type == _FILE_UPLOAD_TYPE:
            entry["files_uploaded"] = file_counts.get(q.id, 0) or 0
        distribution.append(entry)

    # ── Timeline + comparison ─────────────────────────────────
    timeline = _timeline(survey_id, start_dt, end_dt)
    comparison = _compare_periods(survey_id, start_dt, end_dt)

    data = {
        "survey_id": str(survey_id),
        "responses_count": responses_count,
        "average_completion_time_minutes": avg_minutes,
        "completion_rate": completion_rate,
        "total_assigned": total_assigned,
        "completed_assignments": completed,
        "question_distribution": distribution,
        "timeline": timeline,
        "comparison": comparison,
        "generated_at": timezone.now().isoformat(),
        "range": {
            "preset": preset or None,
            "from": start_dt.isoformat() if start_dt else None,
            "to": end_dt.isoformat() if end_dt else None,
        },
    }
    cache.set(cache_key, data, CACHE_TTL)
    return data


# ═════════════════════════════════════════════════════════════════
# CSV / Export
# ═════════════════════════════════════════════════════════════════

def survey_answers_rows(survey_id, preset=None, date_from=None, date_to=None):
    """
    Flat rows of all submitted answers for one survey.
    Returns (headers, rows) where each row is a dict.

    Query cost: constant (~5 queries) regardless of response count.
    """
    survey = Survey.objects.filter(id=survey_id).first()
    if not survey:
        return [], []

    start_dt, end_dt = resolve_date_range(preset, date_from, date_to)

    # Prefetch children so we never hit the DB per row.
    questions = list(
        Question.objects.filter(survey_id=survey_id)
        .exclude(type__in=Question.NON_ANSWERABLE_TYPES)
        .order_by("order")
        .prefetch_related("options", "matrix_rows", "matrix_columns")
    )

    headers = [
        {"key": "response_id", "label": "شناسه پاسخ"},
        {"key": "user", "label": "پاسخ‌دهنده"},
        {"key": "submitted_at", "label": "زمان ارسال"},
        {"key": "completion_minutes", "label": "مدت (دقیقه)"},
    ]
    for q in questions:
        headers.append({"key": f"q_{q.id}", "label": q.title})

    responses = (
        SurveyResponse.objects.filter(
            survey_id=survey_id,
            status=SurveyResponse.Status.SUBMITTED,
        )
        .select_related("survey", "user")
        .prefetch_related("answers__files")
    )
    responses = _apply_range(responses, start_dt, end_dt, field="submitted_at")

    # Build lookup dicts once — turns per-row option lookups into dict hits.
    options_by_q = {
        q.id: {o.value: o.label for o in q.options.all()} for q in questions
    }
    rows_by_q = {
        q.id: {str(r.id): r.label for r in q.matrix_rows.all()} for q in questions
    }
    cols_by_q = {
        q.id: {c.value: c.label for c in q.matrix_columns.all()} for q in questions
    }

    rows = []
    for r in responses.order_by("-submitted_at"):
        answers_by_q = {a.question_id: a for a in r.answers.all()}

        row = {
            "response_id": str(r.id),
            "user": (
                r.user.email
                if (r.survey.response_mode != "ANONYMOUS" and r.user)
                else "ناشناس"
            ),
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else "",
            "completion_minutes": (
                round(r.completion_time.total_seconds() / 60, 2)
                if r.completion_time
                else ""
            ),
        }

        for q in questions:
            a = answers_by_q.get(q.id)
            if a:
                row[f"q_{q.id}"] = _format_answer_for_export(
                    q,
                    a,
                    options=options_by_q.get(q.id, {}),
                    rows=rows_by_q.get(q.id, {}),
                    cols=cols_by_q.get(q.id, {}),
                )
            else:
                row[f"q_{q.id}"] = ""

        rows.append(row)

    return headers, rows


def _format_answer_for_export(question, answer, *, options=None, rows=None, cols=None) -> str:
    """
    Convert an Answer's JSON value into a plain string for CSV.
    Uses pre-built lookup dicts so no DB queries are issued.
    """
    v = answer.value or {}
    t = question.type
    options = options or {}
    rows = rows or {}
    cols = cols or {}

    if t == "FILE_UPLOAD":
        files = list(answer.files.all())  # prefetched
        return "، ".join(f.original_name for f in files)

    if t in ("SHORT_TEXT", "LONG_TEXT"):
        return str(v.get("text", ""))

    if t in ("MULTIPLE_CHOICE", "RANKING"):
        values = v.get("values") or []
        return "، ".join(options.get(val, val) for val in values)

    if t == "MATRIX":
        cell = v.get("value") or {}
        parts = []
        for row_id, col_val in cell.items():
            row_label = rows.get(str(row_id), row_id)
            col_label = cols.get(col_val, col_val)
            parts.append(f"{row_label}: {col_label}")
        return "؛ ".join(parts)

    if t in ("SINGLE_CHOICE", "DROPDOWN", "LIKERT", "YES_NO"):
        val = str(v.get("value", ""))
        if val in options:
            return options[val]
        if val == "yes":
            return "بله"
        if val == "no":
            return "خیر"
        return val

    return str(v.get("value", ""))