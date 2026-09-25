from rest_framework import serializers

from apps.q_accounts.api.v1.serializers import UserSummarySerializer
from apps.q_responses.models import Answer, AnswerFile, SurveyResponse


# ═════════════════════════════════════════════════════════════════
# Files
# ═════════════════════════════════════════════════════════════════

class AnswerFileSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = AnswerFile
        fields = ["id", "url", "original_name", "content_type", "size", "order"]
        read_only_fields = fields

    def get_url(self, obj):
        request = self.context.get("request")
        try:
            url = obj.file.url
        except ValueError:
            return None
        return request.build_absolute_uri(url) if request else url


# ═════════════════════════════════════════════════════════════════
# Answers
# ═════════════════════════════════════════════════════════════════

class AnswerSerializer(serializers.ModelSerializer):
    files = AnswerFileSerializer(many=True, read_only=True)

    class Meta:
        model = Answer
        fields = [
            "id", "response", "question", "value", "files",
            "created_at", "updated_at",
        ]
        read_only_fields = fields


class AnswerWriteSerializer(serializers.Serializer):
    question = serializers.UUIDField()
    value = serializers.JSONField(required=False, default=dict)


# ═════════════════════════════════════════════════════════════════
# Survey Responses
# ═════════════════════════════════════════════════════════════════

class SurveyResponseSerializer(serializers.ModelSerializer):
    """
    Response serializer.

    Uses `UserSummarySerializer` (slim) instead of the full `UserSerializer`
    to avoid one `get_all_permissions()` query per embedded user — the
    single biggest source of N+1 in this endpoint.

    `survey_title` is included so list views can render the survey name
    without an extra lookup. Safe because the queryset already does
    `select_related("survey")` — no N+1.

    For anonymous surveys, `user` is always null.
    """
    answers = AnswerSerializer(many=True, read_only=True)
    user = serializers.SerializerMethodField()
    survey_title = serializers.CharField(source="survey.title", read_only=True)

    class Meta:
        model = SurveyResponse
        fields = [
            "id", "survey", "survey_title",
            "user", "assignment", "status",
            "started_at", "submitted_at", "completion_time",
            "answers", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_user(self, obj):
        # Anonymous surveys never expose the respondent.
        if obj.survey.response_mode == "ANONYMOUS":
            return None
        if obj.user_id is None:
            return None
        # `obj.user` is loaded via select_related in the view's queryset.
        return UserSummarySerializer(obj.user, context=self.context).data


# ═════════════════════════════════════════════════════════════════
# Request serializers
# ═════════════════════════════════════════════════════════════════

class SaveDraftSerializer(serializers.Serializer):
    survey = serializers.UUIDField()
    assignment = serializers.UUIDField(required=False, allow_null=True)
    answers = AnswerWriteSerializer(many=True, required=False, default=list)


class FileUploadSerializer(serializers.Serializer):
    survey_id = serializers.UUIDField()
    file = serializers.FileField()