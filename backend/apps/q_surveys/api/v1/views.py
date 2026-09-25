from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Q

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import decorators, filters, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.q_activity.utils import log_activity
from apps.q_assignments.models import SurveyAssignment

from apps.q_surveys.models import Question, Survey, SystemList
from apps.q_surveys.services import (
    archive_survey,
    close_survey,
    duplicate_survey,
    publish_survey,
    reorder_questions,
)

from .permissions import QuestionPermission, SurveyPermission
from .serializers import (
    QuestionSerializer,
    QuestionWriteSerializer,
    ReorderItemSerializer,
    SurveyDetailSerializer,
    SurveyListSerializer,
    SurveyWriteSerializer,
    SystemListSerializer,
)

# Actions where the object-level permission should return 403 (not 404)
# so the caller learns the object exists but they can't touch it.
WRITE_ACTIONS = frozenset({
    "update", "partial_update", "destroy",
    "publish", "close", "archive", "duplicate",
})


class SurveyViewSet(viewsets.ModelViewSet):
    permission_classes = [SurveyPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "visibility", "category", "response_mode"]
    search_fields = ["title", "description", "category"]
    ordering_fields = ["created_at", "published_at", "title"]

    def get_queryset(self):
        u = self.request.user
        is_assigned = SurveyAssignment.objects.filter(survey=OuterRef("pk"), user=u)
        base = (
            Survey.objects.select_related("created_by")
            .annotate(
                questions_count=Count("questions", distinct=True),
                _assigned=Exists(is_assigned),
            )
            .order_by("-created_at")
        )
        if u.is_superuser:
            return base
        if self.action in WRITE_ACTIONS:
            # Let object-level permission decide 403 vs 404.
            return base
        # Read-only actions: restrict to own + public + assigned.
        return base.filter(
            Q(created_by=u)
            | Q(status=Survey.Status.PUBLISHED, visibility=Survey.Visibility.PUBLIC)
            | Q(status=Survey.Status.PUBLISHED, _assigned=True)
        ).distinct()

    def get_serializer_class(self):
        if self.action == "list":
            return SurveyListSerializer
        if self.action in ("create", "update", "partial_update"):
            return SurveyWriteSerializer
        return SurveyDetailSerializer

    def perform_create(self, serializer):
        survey = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, "survey.created", survey, "Created survey")

    def perform_destroy(self, instance):
        instance.soft_delete()
        log_activity(self.request.user, "survey.deleted", instance, "Soft-deleted survey")

    def _check_owner_or_super(self, request, survey):
        if not (request.user.is_superuser or survey.created_by_id == request.user.id):
            raise PermissionDenied("You do not own this survey.")

    @decorators.action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        survey = self.get_object()
        self._check_owner_or_super(request, survey)
        try:
            publish_survey(survey, request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(SurveyDetailSerializer(survey).data)

    @decorators.action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        survey = self.get_object()
        self._check_owner_or_super(request, survey)
        close_survey(survey, request.user)
        return Response({"detail": "Survey closed."})

    @decorators.action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        survey = self.get_object()
        self._check_owner_or_super(request, survey)
        archive_survey(survey, request.user)
        return Response({"detail": "Survey archived."})

    @decorators.action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        source = self.get_object()
        self._check_owner_or_super(request, source)
        new = duplicate_survey(source, request.user)
        return Response(SurveyDetailSerializer(new).data, status=201)

    @decorators.action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        qs = (
            Survey.objects.filter(created_by=request.user)
            .select_related("created_by")
            .annotate(questions_count=Count("questions", distinct=True))
            .order_by("-created_at")
        )
        page = self.paginate_queryset(qs)
        serializer = SurveyListSerializer(
            page if page is not None else qs, many=True,
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class QuestionViewSet(viewsets.ModelViewSet):
    permission_classes = [QuestionPermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["survey", "type"]
    ordering_fields = ["order", "created_at"]

    def get_queryset(self):
        u = self.request.user
        qs = (
            Question.objects.select_related("survey", "system_list")
            .prefetch_related("options", "matrix_rows", "matrix_columns")
        )
        if u.is_superuser:
            return qs
        return qs.filter(
            Q(survey__created_by=u)
            | Q(
                survey__status=Survey.Status.PUBLISHED,
                survey__visibility=Survey.Visibility.PUBLIC,
            )
            | Q(
                survey__status=Survey.Status.PUBLISHED,
                survey__assignments__user=u,
            )
        ).distinct()

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return QuestionWriteSerializer
        return QuestionSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        survey = serializer.validated_data["survey"]
        u = self.request.user
        if not (u.is_superuser or survey.created_by_id == u.id):
            raise PermissionDenied("You do not own this survey.")

        if survey.status == Survey.Status.PUBLISHED:
            from apps.q_responses.models import SurveyResponse
            if SurveyResponse.objects.filter(survey=survey).exists():
                raise PermissionDenied(
                    "Cannot add questions to a published survey that has responses."
                )

        Survey.objects.select_for_update().get(pk=survey.pk)

        requested_order = serializer.validated_data.get("order") or 0
        if not requested_order:
            last = Question.objects.filter(survey=survey).order_by("-order").first()
            requested_order = (last.order + 1) if last else 1
        serializer.save(order=requested_order)

    @decorators.action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        s = ReorderItemSerializer(data=request.data, many=True)
        s.is_valid(raise_exception=True)
        items = s.validated_data
        if not items:
            return Response({"detail": "Empty payload."}, status=400)

        first_q = (
            Question.objects.filter(id=items[0]["id"])
            .select_related("survey")
            .first()
        )
        if not first_q:
            return Response({"detail": "Question not found."}, status=404)
        survey = first_q.survey

        if not (request.user.is_superuser or survey.created_by_id == request.user.id):
            raise PermissionDenied("You do not own this survey.")

        try:
            reorder_questions(survey, items)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response({"detail": "Reordered."})


class SystemListViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SystemList.objects.prefetch_related("items").all()
    serializer_class = SystemListSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["type", "is_system"]