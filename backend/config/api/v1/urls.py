from django.urls import include, path

app_name = "v1"

urlpatterns = [
    path("auth/", include("apps.q_accounts.api.v1.urls.auth")),
    path("users/", include("apps.q_accounts.api.v1.urls.users")),
    path("surveys/", include("apps.q_surveys.api.v1.urls")),
    path("assignments/", include("apps.q_assignments.api.v1.urls")),
    path("responses/", include("apps.q_responses.api.v1.urls")),
    path("analytics/", include("apps.q_analytics.api.v1.urls")),
    path("notifications/", include("apps.q_notifications.api.v1.urls")),
    path("activity/", include("apps.q_activity.api.v1.urls")),
]