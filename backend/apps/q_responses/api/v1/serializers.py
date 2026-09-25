from rest_framework import serializers

from apps.q_accounts.api.v1.serializers import UserSerializer
from apps.q_responses.models import Answer, AnswerFile, SurveyResponse


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


class SurveyResponseSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True, read_only=True)
    user = serializers.SerializerMethodField()

    class Meta:
        model = SurveyResponse
        fields = [
            "id", "survey", "user", "assignment", "status",
            "started_at", "submitted_at", "completion_time",
            "answers", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_user(self, obj):
        if obj.survey.response_mode == "ANONYMOUS":
            return None
        if obj.user_id is None:
            return None
        return UserSerializer(obj.user).data


class SaveDraftSerializer(serializers.Serializer):
    survey = serializers.UUIDField()
    assignment = serializers.UUIDField(required=False, allow_null=True)
    answers = AnswerWriteSerializer(many=True, required=False, default=list)


class FileUploadSerializer(serializers.Serializer):
    survey_id = serializers.UUIDField()
    file = serializers.FileField()