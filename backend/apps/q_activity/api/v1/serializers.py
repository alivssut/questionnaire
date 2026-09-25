from rest_framework import serializers

from apps.q_activity.models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(
        source="user.email", read_only=True, default=None,
    )

    class Meta:
        model = ActivityLog
        fields = [
            "id", "user_email", "action", "object_type",
            "object_id", "description", "metadata", "created_at",
        ]
        read_only_fields = fields