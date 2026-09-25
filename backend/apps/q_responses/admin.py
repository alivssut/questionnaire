from django.contrib import admin

from .models import Answer, AnswerFile, SurveyResponse


class AnswerFileInline(admin.TabularInline):
    model = AnswerFile
    extra = 0
    readonly_fields = ("file", "original_name", "content_type", "size", "order", "created_at")
    can_delete = True


class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 0
    readonly_fields = ("question", "value", "created_at", "updated_at")
    can_delete = False


@admin.register(SurveyResponse)
class SurveyResponseAdmin(admin.ModelAdmin):
    list_display = ("id", "survey", "user", "status", "started_at", "submitted_at")
    list_filter = ("status",)
    search_fields = ("survey__title", "user__email")
    readonly_fields = ("started_at", "submitted_at", "completion_time")
    inlines = [AnswerInline]


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ("id", "response", "question")
    search_fields = ("response__survey__title", "question__title")
    inlines = [AnswerFileInline]


@admin.register(AnswerFile)
class AnswerFileAdmin(admin.ModelAdmin):
    list_display = ("id", "original_name", "size", "survey", "uploaded_by", "answer", "created_at")
    list_filter = ("content_type",)
    search_fields = ("original_name", "uploaded_by__email", "survey__title")
    readonly_fields = ("created_at", "updated_at", "size", "content_type")