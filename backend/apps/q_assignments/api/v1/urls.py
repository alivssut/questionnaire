from rest_framework.routers import DefaultRouter

from .views import SurveyAssignmentViewSet

app_name = "assignments"

router = DefaultRouter()
router.register("", SurveyAssignmentViewSet, basename="assignments")
urlpatterns = router.urls