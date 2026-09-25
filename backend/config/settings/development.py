from .base import *  # noqa

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Local dev: allow all origins for convenience
CORS_ALLOW_ALL_ORIGINS = True

# Browser-friendly renderer for local dev
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"