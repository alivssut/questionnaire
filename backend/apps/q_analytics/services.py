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

CACHE_TTL = 60 * 5  # 5 minutes


# ═════════════════════════════════════════════════════════════════
# Cache helpers
# ═════════════════════════════════════════════════════════════════

def invalidate_survey_cache(survey_id):
    cache.delete(f"analytics:survey:{survey_id}")
    cache.delete("analytics:global")


def invalidate_all():
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
        return now - timedelta(days=days), None

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
    total_assignments = SurveyAssignment.objects.count()
    completed = SurveyAssignment.objects.filter(
        status=SurveyAssignment.Status.COMPLETED,
    ).count()
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
# Distribution helpers
# ═════════════════════════════════════════════════════════════════

def _choice_distribution(question: Question, start_dt=None, end_dt=None) -> dict:
    """Counts for choice questions. Respects optional date range on the parent response."""
    counts: dict[str, int] = {}
    qs = Answer.objects.filter(
        question=question,
        response__status=SurveyResponse.Status.SUBMITTED,
    )
    qs = _apply_range(qs, start_dt, end_dt, field="response__submitted_at")
    qs = qs.values_list("value", flat=True)

    for v in qs:
        if not isinstance(v, dict):
            continue
        single = v.get("value")
        if isinstance(single, (str, bool)):
            key = str(single)
            counts[key] = counts.get(key, 0) + 1
        multi = v.get("values")
        if isinstance(multi, list):
            for item in multi:
                if isinstance(item, str):
                    counts[item] = counts.get(item, 0) + 1
    return counts


def _numeric_distribution(question: Question, start_dt=None, end_dt=None) -> dict:
    qs = Answer.objects.filter(
        question=question,
        response__status=SurveyResponse.Status.SUBMITTED,
    )
    qs = _apply_range(qs, start_dt, end_dt, field="response__submitted_at")
    values = qs.values_list("value", flat=True)

    nums = [
        v["value"]
        for v in values
        if isinstance(v, dict)
        and isinstance(v.get("value"), (int, float))
        and not isinstance(v.get("value"), bool)
    ]

    # Optional histogram for RATING / NPS
    histogram: dict[int, int] = {}
    for n in nums:
        key = int(round(n))
        histogram[key] = histogram.get(key, 0) + 1

    return {
        "count": len(nums),
        "average": round(sum(nums) / len(nums), 2) if nums else None,
        "min": min(nums) if nums else None,
        "max": max(nums) if nums else None,
        "histogram": {str(k): v for k, v in sorted(histogram.items())},
    }


def _matrix_distribution(question: Question, start_dt=None, end_dt=None) -> dict:
    counts: dict[str, int] = {}
    qs = Answer.objects.filter(
        question=question,
        response__status=SurveyResponse.Status.SUBMITTED,
    )
    qs = _apply_range(qs, start_dt, end_dt, field="response__submitted_at")
    qs = qs.values_list("value", flat=True)

    for v in qs:
        if not isinstance(v, dict):
            continue
        cell = v.get("value")
        if not isinstance(cell, dict):
            continue
        for row_id, col_val in cell.items():
            key = f"{row_id}:{col_val}"
            counts[key] = counts.get(key, 0) + 1
    return {"matrix_counts": counts}


def _ranking_distribution(question: Question, start_dt=None, end_dt=None) -> dict:
    counts: dict[str, int] = {}
    qs = Answer.objects.filter(
        question=question,
        response__status=SurveyResponse.Status.SUBMITTED,
    )
    qs = _apply_range(qs, start_dt, end_dt, field="response__submitted_at")
    qs = qs.values_list("value", flat=True)

    for v in qs:
        if not isinstance(v, dict):
            continue
        items = v.get("values")
        if isinstance(items, list):
            for item in items:
                if isinstance(item, str):
                    counts[item] = counts.get(item, 0) + 1
    return {"counts": counts}


def _file_upload_stats(question: Question, start_dt=None, end_dt=None) -> dict:
    qs = Answer.objects.filter(
        question=question,
        response__status=SurveyResponse.Status.SUBMITTED,
    )
    qs = _apply_range(qs, start_dt, end_dt, field="response__submitted_at")
    total_files = qs.aggregate(total=Count("files"))["total"]
    return {"files_uploaded": total_files or 0}


# ═════════════════════════════════════════════════════════════════
# Timeline (line chart)
# ═════════════════════════════════════════════════════════════════

def _timeline(survey_id, start_dt, end_dt):
    """
    Returns a daily time series of submitted responses between start and end.
    If no range is provided, defaults to the last 30 days.
    Always returns continuous days (with zeros for missing).
    """
    now = timezone.now()

    if not start_dt and not end_dt:
        start_dt = now - timedelta(days=30)
        end_dt = now

    if not start_dt:
        # infer from first response
        first = (
            SurveyResponse.objects.filter(
                survey_id=survey_id,
                status=SurveyResponse.Status.SUBMITTED,
            )
            .order_by("submitted_at")
            .first()
        )
        start_dt = first.submitted_at if first else now - timedelta(days=30)

    if not end_dt:
        end_dt = now

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

    # Build continuous series
    series = []
    current = start_dt.date()
    end_date = end_dt.date()
    while current <= end_date:
        series.append(
            {
                "date": current.isoformat(),
                "count": by_day.get(current, 0),
            }
        )
        current += timedelta(days=1)

    return series


# ═════════════════════════════════════════════════════════════════
# Period comparison
# ═════════════════════════════════════════════════════════════════

def _compare_periods(survey_id, start_dt, end_dt):
    """
    Compare current range vs previous range (same length) for key metrics.
    """
    if not start_dt or not end_dt:
        return None

    length = (end_dt - start_dt)
    prev_start = start_dt - length
    prev_end = start_dt - timedelta(seconds=1)

    def _metrics(s, e):
        responses = SurveyResponse.objects.filter(
            survey_id=survey_id,
            status=SurveyResponse.Status.SUBMITTED,
            submitted_at__gte=s,
            submitted_at__lte=e,
        )
        count = responses.count()
        avg = responses.aggregate(avg=Avg("completion_time"))["avg"]
        avg_min = round(avg.total_seconds() / 60, 2) if avg else 0.0

        assignments = SurveyAssignment.objects.filter(
            survey_id=survey_id,
            assigned_at__gte=s,
            assigned_at__lte=e,
        )
        total = assignments.count()
        completed = assignments.filter(
            status=SurveyAssignment.Status.COMPLETED
        ).count()
        rate = round((completed / total) * 100, 2) if total else 0.0

        return {"responses": count, "avg_minutes": avg_min, "completion_rate": rate}

    current = _metrics(start_dt, end_dt)
    previous = _metrics(prev_start, prev_end)

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
# Survey stats
# ═════════════════════════════════════════════════════════════════

def survey_stats(survey_id, preset=None, date_from=None, date_to=None):
    """
    Return stats for one survey, optionally scoped to a date range.
    Cache key includes the range so we don't return stale scoped data.
    """
    if not Survey.objects.filter(id=survey_id).exists():
        return None

    start_dt, end_dt = resolve_date_range(preset, date_from, date_to)

    key = f"analytics:survey:{survey_id}:{preset or ''}:{date_from or ''}:{date_to or ''}"
    cached = cache.get(key)
    if cached:
        return cached

    # ── Response-level metrics ────────────────────────────────
    responses = SurveyResponse.objects.filter(
        survey_id=survey_id,
        status=SurveyResponse.Status.SUBMITTED,
    )
    responses = _apply_range(responses, start_dt, end_dt, field="submitted_at")
    responses_count = responses.count()
    avg_duration = responses.aggregate(avg=Avg("completion_time"))["avg"]
    avg_minutes = (
        round(avg_duration.total_seconds() / 60, 2) if avg_duration else 0.0
    )

    # ── Assignment-level metrics ──────────────────────────────
    assignments = SurveyAssignment.objects.filter(survey_id=survey_id)
    assignments = _apply_range(assignments, start_dt, end_dt, field="assigned_at")
    total_assigned = assignments.count()
    completed = assignments.filter(
        status=SurveyAssignment.Status.COMPLETED
    ).count()
    completion_rate = (
        round((completed / total_assigned) * 100, 2) if total_assigned else 0.0
    )

    # ── Question distribution ─────────────────────────────────
    distribution = []
    questions = (
        Question.objects.filter(survey_id=survey_id)
        .exclude(type__in=Question.NON_ANSWERABLE_TYPES)
        .order_by("order")
    )

    for q in questions:
        entry = {
            "question_id": str(q.id),
            "title": q.title,
            "type": q.type,
        }

        if q.type in (
            Question.Type.SINGLE_CHOICE,
            Question.Type.MULTIPLE_CHOICE,
            Question.Type.DROPDOWN,
            Question.Type.YES_NO,
            Question.Type.LIKERT,
        ):
            entry.update({"counts": _choice_distribution(q, start_dt, end_dt)})

        elif q.type == Question.Type.RANKING:
            entry.update(_ranking_distribution(q, start_dt, end_dt))

        elif q.type in Question.NUMERIC_TYPES:
            entry.update(_numeric_distribution(q, start_dt, end_dt))

        elif q.type == Question.Type.MATRIX:
            entry.update(_matrix_distribution(q, start_dt, end_dt))

        elif q.type == Question.Type.FILE_UPLOAD:
            entry.update(_file_upload_stats(q, start_dt, end_dt))

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
    cache.set(key, data, CACHE_TTL)
    return data


# ═════════════════════════════════════════════════════════════════
# CSV / Export helpers
# ═════════════════════════════════════════════════════════════════

def survey_answers_rows(survey_id, preset=None, date_from=None, date_to=None):
    """
    Flat rows of all submitted answers for one survey.
    Useful for CSV/Excel export.
    Returns (headers, rows) where each row is a dict.
    """
    survey = Survey.objects.filter(id=survey_id).first()
    if not survey:
        return [], []

    start_dt, end_dt = resolve_date_range(preset, date_from, date_to)

    # Collect answerable questions in order
    questions = (
        Question.objects.filter(survey_id=survey_id)
        .exclude(type__in=Question.NON_ANSWERABLE_TYPES)
        .order_by("order")
    )

    headers = [
        {"key": "response_id", "label": "شناسه پاسخ"},
        {"key": "user", "label": "پاسخ‌دهنده"},
        {"key": "submitted_at", "label": "زمان ارسال"},
        {"key": "completion_minutes", "label": "مدت (دقیقه)"},
    ]
    for q in questions:
        headers.append({"key": f"q_{q.id}", "label": q.title})

    # Fetch responses + answers
    responses = SurveyResponse.objects.filter(
        survey_id=survey_id,
        status=SurveyResponse.Status.SUBMITTED,
    ).select_related("user").prefetch_related("answers__files")
    responses = _apply_range(responses, start_dt, end_dt, field="submitted_at")

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
            row[f"q_{q.id}"] = _format_answer_for_export(q, a) if a else ""

        rows.append(row)

    return headers, rows


def _format_answer_for_export(question: Question, answer) -> str:
    """Convert an Answer's JSON value into a plain string for CSV."""
    v = answer.value or {}
    t = question.type

    if t == "FILE_UPLOAD":
        files = list(answer.files.all())
        return "، ".join(f.original_name for f in files)

    if t in ("SHORT_TEXT", "LONG_TEXT"):
        return str(v.get("text", ""))

    if t == "MULTIPLE_CHOICE" or t == "RANKING":
        values = v.get("values") or []
        labels = []
        for val in values:
            opt = question.options.filter(value=val).first()
            labels.append(opt.label if opt else val)
        return "، ".join(labels)

    if t == "MATRIX":
        cell = v.get("value") or {}
        parts = []
        for row_id, col_val in cell.items():
            row = question.matrix_rows.filter(id=row_id).first()
            col = question.matrix_columns.filter(value=col_val).first()
            parts.append(f"{row.label if row else row_id}: {col.label if col else col_val}")
        return "؛ ".join(parts)

    if t in ("SINGLE_CHOICE", "DROPDOWN", "LIKERT", "YES_NO"):
        val = str(v.get("value", ""))
        opt = question.options.filter(value=val).first()
        if opt:
            return opt.label
        if val == "yes":
            return "بله"
        if val == "no":
            return "خیر"
        return val

    return str(v.get("value", ""))