from django.contrib import admin

from .models import (
    ListItem,
    MatrixColumn,
    MatrixRow,
    Question,
    QuestionOption,
    Survey,
    SystemList,
)


class QuestionOptionInline(admin.TabularInline):
    model = QuestionOption
    extra = 0
    fields = ("order", "label", "value")
    ordering = ("order",)


class MatrixRowInline(admin.TabularInline):
    model = MatrixRow
    extra = 0
    fields = ("order", "label")
    ordering = ("order",)


class MatrixColumnInline(admin.TabularInline):
    model = MatrixColumn
    extra = 0
    fields = ("order", "label", "value")
    ordering = ("order",)


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 0
    fields = ("order", "type", "title", "required", "settings", "system_list")
    ordering = ("order",)
    show_change_link = True


@admin.register(Survey)
class SurveyAdmin(admin.ModelAdmin):
    list_display = (
        "title", "created_by", "status", "visibility", "response_mode",
        "estimated_time_minutes", "created_at", "published_at", "is_deleted",
    )
    list_filter = ("status", "visibility", "response_mode", "category", "is_deleted")
    search_fields = ("title", "description", "created_by__email")
    readonly_fields = ("created_at", "updated_at", "published_at", "deleted_at")
    inlines = [QuestionInline]
    ordering = ("-created_at",)
    autocomplete_fields = ("created_by",)
    actions = ["soft_delete", "restore"]

    def get_queryset(self, request):
        return Survey.all_objects.all()

    @admin.action(description="Soft-delete selected")
    def soft_delete(self, request, queryset):
        for s in queryset:
            s.soft_delete()

    @admin.action(description="Restore selected")
    def restore(self, request, queryset):
        queryset.update(is_deleted=False, deleted_at=None)


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("title", "survey", "type", "order", "required")
    list_filter = ("type", "required")
    search_fields = ("title", "survey__title")
    autocomplete_fields = ("survey", "system_list")
    inlines = [QuestionOptionInline, MatrixRowInline, MatrixColumnInline]


class ListItemInline(admin.TabularInline):
    model = ListItem
    extra = 0


@admin.register(SystemList)
class SystemListAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "type", "is_system")
    list_filter = ("type", "is_system")
    search_fields = ("name", "slug")
    inlines = [ListItemInline]