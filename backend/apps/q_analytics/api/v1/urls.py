from django.urls import path

from .views import (
    GlobalAnalyticsView,
    SurveyAnalyticsExportView,
    SurveyAnalyticsView,
)

app_name = "analytics"

urlpatterns = [
    path("global/", GlobalAnalyticsView.as_view(), name="global"),
    path("surveys/<uuid:survey_id>/", SurveyAnalyticsView.as_view(), name="survey"),
    path(
        "surveys/<uuid:survey_id>/export/",
        SurveyAnalyticsExportView.as_view(),
        name="survey-export",
    ),
]