from rest_framework import serializers

from apps.q_notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id", "title", "message", "type",
            "is_read", "metadata", "created_at",
        ]
        read_only_fields = fields