from rest_framework.routers import DefaultRouter

from .views import QuestionViewSet, SurveyViewSet, SystemListViewSet

app_name = "surveys"

router = DefaultRouter()
router.register("system-lists", SystemListViewSet, basename="system-lists")
router.register("questions", QuestionViewSet, basename="questions")
router.register("", SurveyViewSet, basename="surveys")

urlpatterns = router.urls