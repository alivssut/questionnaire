from django.contrib import admin

from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "action", "object_type", "description")
    list_filter = ("action", "object_type", "created_at")
    search_fields = ("description", "action", "user__email", "object_id")
    readonly_fields = (
        "user", "action", "object_type", "object_id",
        "description", "metadata", "created_at",
    )
    date_hierarchy = "created_at"
    list_select_related = ("user",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False