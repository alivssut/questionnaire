from django.contrib import admin

from .models import SurveyAssignment


@admin.register(SurveyAssignment)
class SurveyAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "survey", "user", "status", "due_date",
        "completed_at", "assigned_at",
    )
    list_filter = ("status", "allow_resume")
    search_fields = ("survey__title", "user__email")
    autocomplete_fields = ("survey", "user", "assigned_by")
    readonly_fields = ("assigned_at", "completed_at")
    date_hierarchy = "assigned_at"
    list_select_related = ("survey", "user", "assigned_by")