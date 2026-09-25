from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db.models import OuterRef, Subquery
from django.utils import timezone

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import decorators, filters, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.q_core.permissions import IsSuperUser
from apps.q_surveys.models import Survey

from apps.q_assignments.models import SurveyAssignment
from apps.q_assignments.services import assign_survey, bulk_assign
from .serializers import BulkAssignSerializer, SurveyAssignmentSerializer

User = get_user_model()

OVERDUE_LOCK_KEY = "assignments:mark_overdue_lock"
OVERDUE_INTERVAL_SECONDS = 60


def _mark_overdue_throttled():
    """
    Run mark_overdue() at most once every OVERDUE_INTERVAL_SECONDS
    across all workers sharing the same cache.
    """
    if cache.add(OVERDUE_LOCK_KEY, "1", OVERDUE_INTERVAL_SECONDS):
        SurveyAssignment.objects.mark_overdue()


class SurveyAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = SurveyAssignmentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "survey", "user"]
    search_fields = ["survey__title", "user__email"]
    ordering_fields = ["assigned_at", "due_date", "status"]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "mine", "start"):
            return [IsAuthenticated()]
        return [IsSuperUser()]

    # ══════════════════════════════════════════════════════════════
    # Base queryset (shared by `get_queryset` and `mine`)
    # ══════════════════════════════════════════════════════════════
    #
    # IMPORTANT: `mine` used to build its own queryset without the
    # `response_id` annotation, so the "مشاهده پاسخ من" button never
    # appeared on completed assignments. Extracting this helper keeps
    # the annotation in ONE place — anything that lists assignments
    # must go through here.
    #
    # The correlated Subquery looks up the (survey, user) SUBMITTED
    # SurveyResponse, which is guaranteed to be at most one because of
    # the unique constraint on (survey, user). `[:1]` therefore never
    # silently truncates.
    # ══════════════════════════════════════════════════════════════

    def _annotated_queryset(self):
        from apps.q_responses.models import SurveyResponse

        response_id_sq = (
            SurveyResponse.objects
            .filter(
                survey=OuterRef("survey_id"),
                user=OuterRef("user_id"),
                status=SurveyResponse.Status.SUBMITTED,
            )
            .values("id")[:1]
        )

        return (
            SurveyAssignment.objects
            .select_related("survey", "user", "assigned_by")
            .annotate(response_id=Subquery(response_id_sq))
        )

    # ══════════════════════════════════════════════════════════════
    # Queryset
    # ══════════════════════════════════════════════════════════════

    def get_queryset(self):
        _mark_overdue_throttled()
        u = self.request.user

        qs = self._annotated_queryset().order_by("-assigned_at")

        if u.is_superuser:
            return qs
        return qs.filter(user=u)

    # ══════════════════════════════════════════════════════════════
    # Create (single assign)
    # ══════════════════════════════════════════════════════════════

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)

        survey = s.validated_data["survey"]
        user_id = s.validated_data["user_id"]
        try:
            user = User.objects.get(id=user_id, is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "User not found or inactive."}, status=400)

        try:
            assignment, created = assign_survey(
                survey=survey,
                user=user,
                assigned_by=request.user,
                due_date=s.validated_data.get("due_date"),
                allow_resume=s.validated_data.get("allow_resume", True),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        if not created:
            return Response(
                {"detail": "User is already assigned to this survey."},
                status=status.HTTP_409_CONFLICT,
            )

        # Re-fetch through the annotated queryset so the response
        # carries `response_id` (null for a fresh assignment, but the
        # field is always present — consistent shape for the client).
        fresh = self._annotated_queryset().get(pk=assignment.pk)
        return Response(
            SurveyAssignmentSerializer(fresh).data,
            status=status.HTTP_201_CREATED,
        )

    # ══════════════════════════════════════════════════════════════
    # Bulk assign
    # ══════════════════════════════════════════════════════════════

    @decorators.action(
        detail=False,
        methods=["post"],
        url_path="bulk",
        url_name="bulk",
    )
    def bulk_create(self, request):
        s = BulkAssignSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        try:
            survey = Survey.objects.get(id=s.validated_data["survey"])
        except Survey.DoesNotExist:
            return Response({"detail": "Survey not found."}, status=404)

        user_ids = s.validated_data["user_ids"]
        users = list(User.objects.filter(id__in=user_ids, is_active=True))
        found_ids = {u.id for u in users}
        missing = [str(uid) for uid in user_ids if uid not in found_ids]

        try:
            created_ids, skipped = bulk_assign(
                survey=survey,
                users=users,
                assigned_by=request.user,
                due_date=s.validated_data.get("due_date"),
                allow_resume=s.validated_data.get("allow_resume", True),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        return Response(
            {"created": created_ids, "skipped": skipped, "missing_users": missing},
            status=201,
        )

    # ══════════════════════════════════════════════════════════════
    # Start (PENDING → IN_PROGRESS)
    # ══════════════════════════════════════════════════════════════

    @decorators.action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        a = self.get_object()
        if a.user_id != request.user.id and not request.user.is_superuser:
            return Response({"detail": "Forbidden."}, status=403)
        a.refresh_status()
        if a.status == SurveyAssignment.Status.PENDING:
            a.status = SurveyAssignment.Status.IN_PROGRESS
            a.start_date = timezone.now()
            a.save(update_fields=["status", "start_date", "updated_at"])

        # Re-fetch through the annotated queryset for a consistent shape.
        fresh = self._annotated_queryset().get(pk=a.pk)
        return Response(SurveyAssignmentSerializer(fresh).data)

    # ══════════════════════════════════════════════════════════════
    # Mine — current user's assignments only
    # ══════════════════════════════════════════════════════════════

    @decorators.action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        """
        Return ONLY the current user's assignments.

        Uses `_annotated_queryset()` so `response_id` is populated for
        completed assignments. Even superusers get scoped to their own
        rows here — the admin-wide listing lives at the `list` action.
        """
        qs = (
            self._annotated_queryset()
            .filter(user=request.user)
            .order_by("-assigned_at")
        )
        page = self.paginate_queryset(qs)
        serializer = self.get_serializer(
            page if page is not None else qs, many=True,
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)