from rest_framework import serializers


class GlobalAnalyticsSerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    total_surveys = serializers.IntegerField()
    total_responses = serializers.IntegerField()
    total_assignments = serializers.IntegerField()
    completion_rate = serializers.FloatField()
    generated_at = serializers.DateTimeField()


class TimelinePointSerializer(serializers.Serializer):
    date = serializers.DateField()
    count = serializers.IntegerField()


class ComparisonBucketSerializer(serializers.Serializer):
    responses = serializers.IntegerField()
    avg_minutes = serializers.FloatField()
    completion_rate = serializers.FloatField()


class ComparisonSerializer(serializers.Serializer):
    current = ComparisonBucketSerializer()
    previous = ComparisonBucketSerializer()
    delta = serializers.DictField(allow_null=True)


class QuestionDistributionSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    title = serializers.CharField()
    type = serializers.CharField()

    # Choice / ranking
    counts = serializers.DictField(required=False)

    # Numeric
    count = serializers.IntegerField(required=False)
    average = serializers.FloatField(required=False, allow_null=True)
    min = serializers.FloatField(required=False, allow_null=True)
    max = serializers.FloatField(required=False, allow_null=True)
    histogram = serializers.DictField(required=False)

    # Matrix
    matrix_counts = serializers.DictField(required=False)

    # File upload
    files_uploaded = serializers.IntegerField(required=False)


class RangeSerializer(serializers.Serializer):
    preset = serializers.CharField(allow_null=True)
    from_ = serializers.DateTimeField(allow_null=True, source="from")
    to = serializers.DateTimeField(allow_null=True)


class SurveyAnalyticsSerializer(serializers.Serializer):
    survey_id = serializers.UUIDField()
    responses_count = serializers.IntegerField()
    average_completion_time_minutes = serializers.FloatField()
    completion_rate = serializers.FloatField()
    total_assigned = serializers.IntegerField()
    completed_assignments = serializers.IntegerField()
    question_distribution = QuestionDistributionSerializer(many=True)
    timeline = TimelinePointSerializer(many=True)
    comparison = ComparisonSerializer(allow_null=True)
    generated_at = serializers.DateTimeField()
    range = RangeSerializer()