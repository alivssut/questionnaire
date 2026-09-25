from rest_framework import serializers

from apps.q_accounts.api.v1.serializers import UserSummarySerializer
from apps.q_assignments.models import SurveyAssignment


# ═════════════════════════════════════════════════════════════════
# Assignment — list / retrieve
# ═════════════════════════════════════════════════════════════════

class SurveyAssignmentSerializer(serializers.ModelSerializer):
    """
    Serializer for assignments.

    Uses `UserSummarySerializer` (slim) instead of the full `UserSerializer`
    to avoid one `get_all_permissions()` query per embedded user — the
    single biggest source of N+1 in this endpoint.
    """
    user = UserSummarySerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True, required=False)
    survey_title = serializers.CharField(source="survey.title", read_only=True)
    is_past_due = serializers.BooleanField(read_only=True)

    class Meta:
        model = SurveyAssignment
        fields = [
            "id", "survey", "survey_title",
            "user", "user_id",
            "assigned_by", "status", "assigned_at",
            "start_date", "due_date", "completed_at",
            "allow_resume", "is_past_due",
        ]
        read_only_fields = [
            "id", "assigned_by", "status", "assigned_at",
            "completed_at", "is_past_due",
        ]

    def validate(self, attrs):
        if self.instance is None and not attrs.get("user_id"):
            raise serializers.ValidationError({"user_id": "Required on create."})
        return attrs


# ═════════════════════════════════════════════════════════════════
# Bulk assign
# ═════════════════════════════════════════════════════════════════

class BulkAssignSerializer(serializers.Serializer):
    survey = serializers.UUIDField()
    user_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False,
    )
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    allow_resume = serializers.BooleanField(default=True)