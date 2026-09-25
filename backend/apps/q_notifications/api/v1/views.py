from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import decorators, filters, viewsets
from rest_framework.response import Response

from apps.q_notifications.models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only list of the current user's notifications.
    Two extra actions to mark as read.
    """

    serializer_class = NotificationSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["type", "is_read"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @decorators.action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        """Mark one notification as read."""
        n = self.get_object()
        if not n.is_read:
            n.is_read = True
            n.save(update_fields=["is_read", "updated_at"])
        return Response(NotificationSerializer(n).data)

    @decorators.action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        """Mark every unread notification as read."""
        updated = (
            self.get_queryset()
            .filter(is_read=False)
            .update(is_read=True)
        )
        return Response({"updated": updated})

    @decorators.action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        """Lightweight badge count for the frontend."""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"unread": count})