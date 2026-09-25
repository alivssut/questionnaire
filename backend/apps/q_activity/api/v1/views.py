from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets

from apps.q_core.permissions import IsSuperUser
from apps.q_activity.models import ActivityLog
from .serializers import ActivityLogSerializer


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only audit log. Superuser only.
    """
    queryset = (
        ActivityLog.objects
        .select_related("user")
        .all()
    )
    serializer_class = ActivityLogSerializer
    permission_classes = [IsSuperUser]
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["action", "object_type", "user"]
    search_fields = ["description", "action", "object_id"]
    ordering_fields = ["created_at"]