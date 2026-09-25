from django.db import transaction
from django.db.models import (
    Count,
    Exists,
    IntegerField,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
)

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
    QuestionListSerializer, 
    QuestionSerializer,
    QuestionWriteSerializer,
    ReorderItemSerializer,
    SurveyDetailSerializer,
    SurveyListSerializer,
    SurveyWriteSerializer,
    SystemListSerializer,
)

# ═════════════════════════════════════════════════════════════════
# Constants
# ═════════════════════════════════════════════════════════════════

# Actions where the object-level permission should return 403 (not 404)
# so the caller learns the object exists but they can't touch it.
WRITE_ACTIONS = frozenset({
    "update", "partial_update", "destroy",
    "publish", "close", "archive", "duplicate",
})

# Actions that serialize the full nested tree (questions + options + matrix).
DETAIL_ACTIONS = frozenset({"retrieve"})


# ═════════════════════════════════════════════════════════════════
# Query helpers
# ═════════════════════════════════════════════════════════════════

def _questions_count_subquery():
    """
    Correlated subquery that returns the number of questions per survey.

    Why not `Count("questions")`?
    -----------------------------
    `Count("questions")` forces a LEFT JOIN + GROUP BY on the outer
    queryset. That in turn makes Django wrap the entire annotated
    queryset in a subquery for pagination's COUNT(*) — which is O(n)
    subqueries and gets very slow on large datasets.

    A correlated Subquery avoids the JOIN, keeps the outer queryset
    flat, and makes the pagination COUNT a simple single-table COUNT
    on q_surveys.

    `order_by()` is cleared inside the subquery because the Question
    model declares `Meta.ordering = ["order"]`. Without clearing it,
    Django injects the ORDER BY into the GROUP BY and forces a
    pointless sort.
    """
    return (
        Question.objects
        .filter(survey=OuterRef("pk"))
        .order_by()
        .values("survey")
        .annotate(c=Count("*"))
        .values("c")[:1]
    )


# ═════════════════════════════════════════════════════════════════
# Survey
# ═════════════════════════════════════════════════════════════════

class SurveyViewSet(viewsets.ModelViewSet):
    permission_classes = [SurveyPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "visibility", "category", "response_mode"]
    search_fields = ["title", "description", "category"]
    ordering_fields = ["created_at", "published_at", "title"]

    def get_queryset(self):
        u = self.request.user
        is_assigned = SurveyAssignment.objects.filter(survey=OuterRef("pk"), user=u)

        qs = (
            Survey.objects
            .select_related("created_by")
            .annotate(
                questions_count=Subquery(
                    _questions_count_subquery(),
                    output_field=IntegerField(),
                ),
                _assigned=Exists(is_assigned),
            )
            .order_by("-created_at")
        )

        # For `retrieve`, prefetch the entire question tree to avoid N+1.
        if self.action in DETAIL_ACTIONS:
            qs = qs.prefetch_related(
                Prefetch(
                    "questions",
                    queryset=(
                        Question.objects
                        .prefetch_related("options", "matrix_rows", "matrix_columns")
                        .order_by("order")
                    ),
                ),
            )

        if u.is_superuser:
            return qs

        if self.action in WRITE_ACTIONS:
            # Let object-level permission decide 403 vs 404.
            return qs

        # Read-only actions: restrict to own + public + assigned.
        return qs.filter(
            Q(created_by=u)
            | Q(status=Survey.Status.PUBLISHED, visibility=Survey.Visibility.PUBLIC)
            | Q(status=Survey.Status.PUBLISHED, _assigned=True)
        )

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
            Survey.objects
            .filter(created_by=request.user)
            .select_related("created_by")
            .annotate(
                questions_count=Subquery(
                    _questions_count_subquery(),
                    output_field=IntegerField(),
                ),
            )
            .order_by("-created_at")
        )
        page = self.paginate_queryset(qs)
        serializer = SurveyListSerializer(
            page if page is not None else qs, many=True,
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


# ═════════════════════════════════════════════════════════════════
# Question
# ═════════════════════════════════════════════════════════════════

class QuestionViewSet(viewsets.ModelViewSet):
    permission_classes = [QuestionPermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["survey", "type"]
    ordering_fields = ["order", "created_at"]

    # ══════════════════════════════════════════════════════════════
    # Queryset — fully optimized
    # ══════════════════════════════════════════════════════════════

    def get_queryset(self):
        """
        Optimized queryset for every action.

        Cost breakdown (prod, JWT):
          - `list` with ?survey=X   → 2 queries (COUNT + main)
          - `list` without filter   → 2 queries
          - `retrieve`              → 5 queries (COUNT + main + 3 prefetch)

        Optimizations applied:
          1. `alias()` instead of `annotate()` for `_assigned` — keeps the
             EXISTS subquery out of the SELECT clause (only used in WHERE).
          2. Conditional `select_related` — when `?survey=X` is set, the
             survey is the same for every row; no need to JOIN it 20 times.
          3. Conditional `order_by` — matches the composite index better:
               - with `?survey=X` → `order_by("order")`
                 uses index `(survey, order)` as a covering scan
               - without filter → `order_by("survey_id", "order")`
                 uses index `(order, survey)` (or seq scan, cheaper)
          4. Prefetch only for `retrieve` — list uses a slim serializer
             that omits options/matrix/children entirely.
        """
        u = self.request.user

        survey_id = self.request.query_params.get("survey")

        # ── Base queryset ─────────────────────────────────────────
        qs = Question.objects.all()

        # Only JOIN survey when we actually serialize it (not for ?survey=X).
        # Only JOIN system_list when the serializer needs it. The slim list
        # serializer includes `system_list` (just the id), so keep it in
        # select_related only when the full tree is being fetched.
        if not survey_id:
            qs = qs.select_related("survey", "system_list")
        else:
            qs = qs.select_related("system_list")

        # ── Prefetch children only for detail ─────────────────────
        # The list serializer doesn't include options/matrix, so we can
        # skip these three queries entirely on list endpoints.
        if self.action in ("retrieve", "update", "partial_update"):
            qs = qs.prefetch_related("options", "matrix_rows", "matrix_columns")

        # ── Ordering — match the index ────────────────────────────
        # With a survey filter, `survey_id` is constant → only `order`
        # matters, and `(survey, order)` index is used as a covering scan.
        if survey_id:
            qs = qs.order_by("order")
        else:
            # Global listing: order by (survey, order) to match the
            # composite index and to keep questions grouped by survey.
            qs = qs.order_by("survey_id", "order")

        # ── Permission filter ─────────────────────────────────────
        if u.is_superuser:
            return qs

        # Exists subquery for assignment — `alias()` keeps it out of SELECT.
        is_assigned = SurveyAssignment.objects.filter(
            survey=OuterRef("survey_id"), user=u,
        )
        return qs.alias(
            _assigned=Exists(is_assigned),
        ).filter(
            Q(survey__created_by=u)
            | Q(
                survey__status=Survey.Status.PUBLISHED,
                survey__visibility=Survey.Visibility.PUBLIC,
            )
            | Q(
                survey__status=Survey.Status.PUBLISHED,
                _assigned=True,
            )
        )

    # ══════════════════════════════════════════════════════════════
    # Serializer selection
    # ══════════════════════════════════════════════════════════════

    def get_serializer_class(self):
        if self.action == "list":
            return QuestionListSerializer     # ← slim, no options/matrix
        if self.action in ("create", "update", "partial_update"):
            return QuestionWriteSerializer
        return QuestionSerializer             # detail — full tree

    # ══════════════════════════════════════════════════════════════
    # Create
    # ══════════════════════════════════════════════════════════════

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

        # Lock the survey row to serialize concurrent creates.
        Survey.objects.select_for_update().get(pk=survey.pk)

        # ── Auto-order ────────────────────────────────────────────
        #
        # IMPORTANT: check `initial_data` (raw payload), NOT `validated_data`.
        # DRF reads the model field's `default=0` and injects it into
        # `validated_data` even when the client didn't send an `order`.
        # That made `validated_data.get("order")` return 0 instead of None,
        # so auto-computation was never triggered and every question ended
        # up with order=0 (constraint violation).
        #
        # When the client explicitly sends `order` (including 0), we respect
        # it. Otherwise we compute `max(order) + 1`.
        # ──────────────────────────────────────────────────────────
        if "order" in serializer.initial_data:
            requested_order = serializer.validated_data.get("order")
        else:
            last = (
                Question.objects
                .filter(survey=survey)
                .order_by("-order")
                .values_list("order", flat=True)
                .first()
            )
            requested_order = (last + 1) if last is not None else 1

        serializer.save(order=requested_order)

    # ══════════════════════════════════════════════════════════════
    # Reorder action
    # ══════════════════════════════════════════════════════════════

    @transaction.atomic
    @decorators.action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        s = ReorderItemSerializer(data=request.data, many=True)
        s.is_valid(raise_exception=True)
        items = s.validated_data
        if not items:
            return Response({"detail": "Empty payload."}, status=400)

        first_q = (
            Question.objects
            .filter(id=items[0]["id"])
            .select_related("survey")
            .only("id", "survey_id", "survey__created_by_id")
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

# ═════════════════════════════════════════════════════════════════
# System Lists (read-only)
# ═════════════════════════════════════════════════════════════════

class SystemListViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SystemListSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["type", "is_system"]

    def get_queryset(self):
        # Define per-request (avoid caching at import time).
        return SystemList.objects.prefetch_related("items").order_by("name")