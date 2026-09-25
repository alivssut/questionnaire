import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        logger.exception("Unhandled API exception", exc_info=exc)
        return Response(
            {"detail": "Internal server error.", "code": "server_error"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    data = response.data

    if isinstance(data, dict) and "detail" in data and "code" not in data:
        data["code"] = getattr(exc, "default_code", "error")
    elif isinstance(data, list):
        response.data = {
            "detail": data,
            "code": getattr(exc, "default_code", "error"),
        }

    return response