from rest_framework.routers import DefaultRouter

from ..views import AdminUserViewSet

app_name = "users"

router = DefaultRouter()
router.register("", AdminUserViewSet, basename="users")
urlpatterns = router.urls