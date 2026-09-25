from django.db import transaction
from rest_framework import serializers

from apps.q_surveys.models import (
    ListItem,
    MatrixColumn,
    MatrixRow,
    Question,
    QuestionOption,
    Survey,
    SystemList,
)


class QuestionOptionSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)

    class Meta:
        model = QuestionOption
        fields = ["id", "label", "value", "order"]


class QuestionOptionWriteSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=255)
    value = serializers.CharField(max_length=255)
    order = serializers.IntegerField(min_value=0, required=False)


class MatrixRowSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)

    class Meta:
        model = MatrixRow
        fields = ["id", "label", "order"]


class MatrixRowWriteSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=255)
    order = serializers.IntegerField(min_value=0, required=False)


class MatrixColumnSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)

    class Meta:
        model = MatrixColumn
        fields = ["id", "label", "value", "order"]


class MatrixColumnWriteSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=255)
    value = serializers.CharField(max_length=255)
    order = serializers.IntegerField(min_value=0, required=False)


class QuestionSerializer(serializers.ModelSerializer):
    options = QuestionOptionSerializer(many=True, read_only=True)
    matrix_rows = MatrixRowSerializer(many=True, read_only=True)
    matrix_columns = MatrixColumnSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            "id", "survey", "type", "title", "description",
            "required", "order", "settings", "system_list",
            "options", "matrix_rows", "matrix_columns",
            "created_at", "updated_at",
        ]
        read_only_fields = fields


class QuestionWriteSerializer(serializers.ModelSerializer):
    options = QuestionOptionWriteSerializer(many=True, required=False)
    matrix_rows = MatrixRowWriteSerializer(many=True, required=False)
    matrix_columns = MatrixColumnWriteSerializer(many=True, required=False)

    class Meta:
        model = Question
        fields = [
            "id", "survey", "type", "title", "description",
            "required", "order", "settings", "system_list",
            "options", "matrix_rows", "matrix_columns",
        ]
        read_only_fields = ["id"]

    def validate_survey(self, value):
        if self.instance and self.instance.survey_id != value.id:
            raise serializers.ValidationError(
                "Cannot move a question to another survey."
            )
        return value

    def validate(self, attrs):
        qtype = attrs.get("type", getattr(self.instance, "type", None))
        settings = attrs.get("settings", getattr(self.instance, "settings", {})) or {}
        system_list = attrs.get("system_list", getattr(self.instance, "system_list", None))
        options = attrs.get("options")
        rows = attrs.get("matrix_rows")
        cols = attrs.get("matrix_columns")

        if qtype in Question.CHOICE_TYPES and qtype != Question.Type.YES_NO:
            has_options = bool(options) or (
                self.instance and self.instance.options.exists()
            )
            has_system = bool(system_list) or (
                self.instance and self.instance.system_list_id
            )
            if not (has_options or has_system):
                raise serializers.ValidationError(
                    {"options": "Choice questions require `options` or `system_list`."}
                )
            if options:
                values = [o["value"] for o in options]
                if len(values) != len(set(values)):
                    raise serializers.ValidationError(
                        {"options": "Duplicate option values."}
                    )

        if qtype in Question.NUMERIC_TYPES:
            mn, mx = settings.get("min"), settings.get("max")
            if mn is not None and mx is not None and mn > mx:
                raise serializers.ValidationError(
                    {"settings": "`min` cannot be greater than `max`."}
                )

        if qtype == Question.Type.MATRIX:
            has_rows = bool(rows) or (
                self.instance and self.instance.matrix_rows.exists()
            )
            has_cols = bool(cols) or (
                self.instance and self.instance.matrix_columns.exists()
            )
            if not (has_rows and has_cols):
                raise serializers.ValidationError(
                    {"matrix_rows": "Matrix requires `matrix_rows` and `matrix_columns`."}
                )
            if cols:
                values = [c["value"] for c in cols]
                if len(values) != len(set(values)):
                    raise serializers.ValidationError(
                        {"matrix_columns": "Duplicate column values."}
                    )

        if qtype in Question.NON_ANSWERABLE_TYPES:
            attrs["required"] = False

        return attrs

    def _create_children(self, question, options=None, rows=None, cols=None):
        if options is not None:
            QuestionOption.objects.bulk_create([
                QuestionOption(
                    question=question,
                    label=o["label"],
                    value=o["value"],
                    order=o.get("order", i),
                )
                for i, o in enumerate(options)
            ])
        if rows is not None:
            MatrixRow.objects.bulk_create([
                MatrixRow(
                    question=question,
                    label=r["label"],
                    order=r.get("order", i),
                )
                for i, r in enumerate(rows)
            ])
        if cols is not None:
            MatrixColumn.objects.bulk_create([
                MatrixColumn(
                    question=question,
                    label=c["label"],
                    value=c["value"],
                    order=c.get("order", i),
                )
                for i, c in enumerate(cols)
            ])

    @transaction.atomic
    def create(self, validated_data):
        options = validated_data.pop("options", None)
        rows = validated_data.pop("matrix_rows", None)
        cols = validated_data.pop("matrix_columns", None)
        question = Question.objects.create(**validated_data)
        self._create_children(question, options, rows, cols)
        return question

    @transaction.atomic
    def update(self, instance, validated_data):
        options = validated_data.pop("options", None)
        rows = validated_data.pop("matrix_rows", None)
        cols = validated_data.pop("matrix_columns", None)

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()

        # Full replace if provided (simplest model for the frontend)
        if options is not None:
            instance.options.all().delete()
            self._create_children(instance, options=options)
        if rows is not None:
            instance.matrix_rows.all().delete()
            self._create_children(instance, rows=rows)
        if cols is not None:
            instance.matrix_columns.all().delete()
            self._create_children(instance, cols=cols)

        return instance


class SurveyListSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    questions_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Survey
        fields = [
            "id", "title", "description", "category", "status", "visibility",
            "response_mode", "estimated_time_minutes", "created_by_email",
            "questions_count", "created_at", "updated_at", "published_at",
        ]


class SurveyDetailSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = Survey
        fields = [
            "id", "title", "description", "cover_image", "category",
            "status", "visibility", "response_mode", "estimated_time_minutes",
            "created_by", "created_by_email", "questions",
            "created_at", "updated_at", "published_at",
        ]
        read_only_fields = fields


class SurveyWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Survey
        fields = [
            "id", "title", "description", "cover_image", "category",
            "visibility", "response_mode", "estimated_time_minutes",
        ]
        read_only_fields = ["id"]

    def validate_title(self, value):
        v = value.strip()
        if not v:
            raise serializers.ValidationError("Title cannot be empty.")
        return v


class ReorderItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    order = serializers.IntegerField(min_value=0)


class ListItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListItem
        fields = ["id", "label", "value", "order"]


class SystemListSerializer(serializers.ModelSerializer):
    items = ListItemSerializer(many=True, read_only=True)

    class Meta:
        model = SystemList
        fields = ["id", "name", "slug", "type", "is_system", "items", "created_at"]