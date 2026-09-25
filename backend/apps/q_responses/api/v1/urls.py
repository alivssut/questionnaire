from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AnswerFileUploadView,
    AnswerViewSet,
    SurveyResponseViewSet,
)

app_name = "responses"

router = DefaultRouter()
router.register("answers", AnswerViewSet, basename="answers")
router.register("", SurveyResponseViewSet, basename="responses")

urlpatterns = [
    path("upload/", AnswerFileUploadView.as_view(), name="upload"),
    *router.urls,
]