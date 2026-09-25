from django.http import HttpResponse
from django.shortcuts import get_object_or_404

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.q_core.permissions import IsSuperUser
from apps.q_surveys.models import Survey

from apps.q_analytics.services import (
    global_stats,
    survey_answers_rows,
    survey_stats,
)
from .serializers import GlobalAnalyticsSerializer, SurveyAnalyticsSerializer


# ═════════════════════════════════════════════════════════════════
# Global analytics
# ═════════════════════════════════════════════════════════════════

class GlobalAnalyticsView(APIView):
    permission_classes = [IsSuperUser]

    @extend_schema(responses=GlobalAnalyticsSerializer)
    def get(self, request):
        return Response(global_stats())


# ═════════════════════════════════════════════════════════════════
# Survey analytics
# ═════════════════════════════════════════════════════════════════

_DATE_PARAMS = [
    OpenApiParameter(
        name="preset",
        description="Preset range: 7d, 14d, 30d, 90d, 1y",
        required=False,
        type=str,
    ),
    OpenApiParameter(
        name="from",
        description="ISO date (YYYY-MM-DD) — overrides preset",
        required=False,
        type=str,
    ),
    OpenApiParameter(
        name="to",
        description="ISO date (YYYY-MM-DD) — overrides preset",
        required=False,
        type=str,
    ),
]


class SurveyAnalyticsView(APIView):
    """
    Stats for a single survey.
    Superuser sees any survey; a creator sees only their own.
    """

    @extend_schema(parameters=_DATE_PARAMS, responses=SurveyAnalyticsSerializer)
    def get(self, request, survey_id):
        survey = get_object_or_404(Survey, id=survey_id)
        u = request.user
        if not (u.is_superuser or survey.created_by_id == u.id):
            raise PermissionDenied("You do not own this survey.")

        data = survey_stats(
            survey_id,
            preset=request.query_params.get("preset"),
            date_from=request.query_params.get("from"),
            date_to=request.query_params.get("to"),
        )
        if data is None:
            return Response({"detail": "Survey not found."}, status=404)
        return Response(data)


# ═════════════════════════════════════════════════════════════════
# CSV export
# ═════════════════════════════════════════════════════════════════

class SurveyAnalyticsExportView(APIView):
    """
    Export all submitted answers of a survey as CSV.
    Respects the same date filters as SurveyAnalyticsView.
    """

    @extend_schema(parameters=_DATE_PARAMS)
    def get(self, request, survey_id):
        survey = get_object_or_404(Survey, id=survey_id)
        u = request.user
        if not (u.is_superuser or survey.created_by_id == u.id):
            raise PermissionDenied("You do not own this survey.")

        headers, rows = survey_answers_rows(
            survey_id,
            preset=request.query_params.get("preset"),
            date_from=request.query_params.get("from"),
            date_to=request.query_params.get("to"),
        )

        import csv
        from io import StringIO

        buf = StringIO()
        # Add BOM for Excel UTF-8 support
        buf.write("\ufeff")
        writer = csv.writer(buf)

        # Header
        writer.writerow([h["label"] for h in headers])
        # Rows
        for row in rows:
            writer.writerow([row.get(h["key"], "") for h in headers])

        filename = f"survey-{survey_id}-responses.csv"
        response = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response