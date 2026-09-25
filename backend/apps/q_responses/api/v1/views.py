from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import decorators, filters, status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.q_assignments.models import SurveyAssignment
from apps.q_core.validators import validate_upload
from apps.q_surveys.models import Survey

from apps.q_responses.models import Answer, AnswerFile, SurveyResponse
from apps.q_responses.services import (
    SubmissionError,
    save_draft,
    submit_response,
)
from .serializers import (
    AnswerFileSerializer,
    AnswerSerializer,
    FileUploadSerializer,
    SaveDraftSerializer,
    SurveyResponseSerializer,
)


# ═════════════════════════════════════════════════════════════════
# Survey Responses (read-only + actions)
# ═════════════════════════════════════════════════════════════════

class SurveyResponseViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SurveyResponseSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["survey", "status", "user"]
    ordering_fields = ["started_at", "submitted_at"]

    def get_queryset(self):
        """
        Optimized queryset.

        Query cost (prod, JWT):
          - list:       COUNT + 1 (main with JOINs) + 1 (answers) + 1 (files)
          - retrieve:   same as list
          - my_draft:   2 (no COUNT)

        `select_related`:
          - survey:  needed for `survey.response_mode` (anonymity check)
          - user:    embedded via UserSummarySerializer
          - assignment: cheap; used only as UUID in response
        `prefetch_related`:
          - answers__files: batches answers + files into 2 queries total
        """
        qs = (
            SurveyResponse.objects
            .select_related("survey", "user", "assignment")
            .prefetch_related("answers__files")
            .order_by("-started_at")
        )

        u = self.request.user
        if u.is_superuser:
            return qs
        return qs.filter(user=u)

    # ── Save draft ────────────────────────────────────────────

    @decorators.action(
        detail=False,
        methods=["post"],
        url_path="save-draft",
        url_name="save-draft",
    )
    def save_draft_action(self, request):
        s = SaveDraftSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        survey = get_object_or_404(Survey, id=s.validated_data["survey"])

        assignment = None
        if s.validated_data.get("assignment"):
            assignment = SurveyAssignment.objects.filter(
                id=s.validated_data["assignment"], user=request.user,
            ).first()

        if not request.user.is_superuser:
            if not assignment:
                assignment = SurveyAssignment.objects.filter(
                    survey=survey, user=request.user,
                ).first()
            if not assignment and not survey.is_public():
                return Response(
                    {"detail": "You are not assigned to this survey."},
                    status=403,
                )

        try:
            response = save_draft(
                user=request.user,
                survey=survey,
                answers_data=s.validated_data.get("answers", []),
                assignment=assignment,
            )
        except SubmissionError as e:
            return Response({"detail": str(e)}, status=400)

        # Re-fetch with the optimized queryset so the response payload
        # has all related data prefetched (avoids 3+ lazy queries when
        # the serializer walks `answers` and `files`).
        fresh = (
            SurveyResponse.objects
            .select_related("survey", "user", "assignment")
            .prefetch_related("answers__files")
            .get(pk=response.pk)
        )
        return Response(
            SurveyResponseSerializer(fresh, context={"request": request}).data
        )

    # ── Submit ────────────────────────────────────────────────

    @decorators.action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        response = self.get_object()
        if response.user_id != request.user.id and not request.user.is_superuser:
            return Response({"detail": "Forbidden."}, status=403)
        try:
            submit_response(user=request.user, response=response)
        except SubmissionError as e:
            return Response({"detail": str(e)}, status=400)

        # Same trick as save-draft: refetch with prefetches so serializing
        # the response after submit doesn't trigger lazy loads.
        fresh = (
            SurveyResponse.objects
            .select_related("survey", "user", "assignment")
            .prefetch_related("answers__files")
            .get(pk=response.pk)
        )
        return Response(
            SurveyResponseSerializer(fresh, context={"request": request}).data
        )

    # ── Current user's draft for a survey ─────────────────────

    @decorators.action(
        detail=False, methods=["get"],
        url_path=r"my-draft/(?P<survey_id>[^/.]+)",
    )
    def my_draft(self, request, survey_id=None):
        response = (
            SurveyResponse.objects
            .select_related("survey", "user", "assignment")
            .prefetch_related("answers__files")
            .filter(
                user=request.user,
                survey_id=survey_id,
                status=SurveyResponse.Status.DRAFT,
            )
            .first()
        )
        if not response:
            return Response({"detail": "No draft."}, status=404)
        return Response(
            SurveyResponseSerializer(response, context={"request": request}).data
        )


# ═════════════════════════════════════════════════════════════════
# Answers (read-only)
# ═════════════════════════════════════════════════════════════════

class AnswerViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AnswerSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["response", "question"]

    def get_queryset(self):
        u = self.request.user
        qs = (
            Answer.objects
            .select_related("response", "question")
            .prefetch_related("files")
            .order_by("-created_at")
        )
        if u.is_superuser:
            return qs
        return qs.filter(response__user=u)


# ═════════════════════════════════════════════════════════════════
# File upload
# ═════════════════════════════════════════════════════════════════

class AnswerFileUploadView(APIView):
    """
    Multipart:
        survey_id: <uuid>
        file: <binary>

    Creates an unlinked AnswerFile. The client should include its id
    in a later save-draft call as value = {"file_ids": [<id>, ...]}.
    """

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        s = FileUploadSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        survey_id = s.validated_data["survey_id"]
        f = s.validated_data["file"]

        try:
            survey = Survey.objects.get(id=survey_id)
        except Survey.DoesNotExist:
            return Response({"detail": "Survey not found."}, status=404)

        if not request.user.is_superuser:
            has_access = (
                survey.is_public()
                or survey.created_by_id == request.user.id
                or SurveyAssignment.objects.filter(
                    survey=survey, user=request.user,
                ).exists()
            )
            if not has_access:
                return Response(
                    {"detail": "You do not have access to this survey."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        try:
            validate_upload(f)
        except DjangoValidationError as e:
            return Response({"detail": e.messages}, status=400)

        record = AnswerFile.objects.create(
            survey=survey,
            uploaded_by=request.user,
            file=f,
            original_name=f.name,
            content_type=getattr(f, "content_type", "") or "",
            size=f.size,
        )
        return Response(
            AnswerFileSerializer(record, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )