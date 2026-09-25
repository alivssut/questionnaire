from django.contrib.auth import get_user_model
from django.core.cache import cache
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

    def get_queryset(self):
        _mark_overdue_throttled()

        u = self.request.user

        # select_related for the FKs we actually serialize.
        #   - survey: needed for `survey_title` (source="survey.title")
        #   - user: embedded via UserSummarySerializer
        #   - assigned_by: cheap to select, useful if it ever gets embedded
        # UserSummarySerializer doesn't touch permissions/groups, so no
        # prefetch is needed for the user side.
        qs = (
            SurveyAssignment.objects
            .select_related("survey", "user", "assigned_by")
            .order_by("-assigned_at")
        )

        if u.is_superuser:
            return qs
        return qs.filter(user=u)

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
        return Response(
            SurveyAssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED,
        )

    @decorators.action(detail=False, methods=["post"], url_path="bulk", url_name="bulk",)
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
        return Response(SurveyAssignmentSerializer(a).data)

    @decorators.action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        """
        Return ONLY the current user's assignments.

        Important: even superusers see only their own assignments here
        (this endpoint is meant to drive the "my questionnaires" view
        for the person who is logged in). For admin-wide listing, use
        the regular `list` action.
        """
        qs = (
            SurveyAssignment.objects
            .select_related("survey", "user", "assigned_by")
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