from django.core.cache import cache
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        checks = {"db": "ok", "cache": "ok"}
        try:
            with connection.cursor() as c:
                c.execute("SELECT 1")
        except Exception:
            checks["db"] = "error"
        try:
            cache.set("health", "1", 5)
            if cache.get("health") != "1":
                checks["cache"] = "error"
        except Exception:
            checks["cache"] = "error"
        ok = all(v == "ok" for v in checks.values())
        return Response(
            {"status": "ok" if ok else "degraded", **checks},
            status=200 if ok else 503,
        )