import sys
from .base import *  # noqa

# ═════════════════════════════════════════════════════════════════
# Detect test runs early
# ═════════════════════════════════════════════════════════════════
#
# `pytest-django` flips DEBUG to False during tests. That breaks the
# debug toolbar (its URLs aren't registered when DEBUG=False, but its
# middleware is still attached). Detect pytest here and skip the
# toolbar entirely.
#
# Detection methods (any one is enough):
#   - "pytest" is already imported (pytest-django loads first)
#   - the entrypoint is pytest
#   - explicit env var (set by CI, Docker test target, etc.)
# ═════════════════════════════════════════════════════════════════

_IS_TESTING = (
    "pytest" in sys.modules
    or "pytest" in sys.argv[0]
    or "PYTEST_CURRENT_TEST" in __import__("os").environ
)

# ═════════════════════════════════════════════════════════════════
# Basic dev overrides
# ═════════════════════════════════════════════════════════════════

DEBUG = not _IS_TESTING
ALLOWED_HOSTS = ["*"]

# Local dev: allow all origins for convenience
CORS_ALLOW_ALL_ORIGINS = True

# Browser-friendly renderer for local dev
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"


# ═════════════════════════════════════════════════════════════════
# Django Debug Toolbar
# ═════════════════════════════════════════════════════════════════
#
# NOTE: The toolbar shows only for requests whose client IP is in
# INTERNAL_IPS. When running Django inside Docker with gunicorn, the
# client IP seen by Django is the *docker bridge* IP (usually 172.x.x.x),
# not your browser's 127.0.0.1. To make the toolbar work from the host
# machine, we:
#   1. Whitelist the docker bridge subnet.
#   2. Force `SHOW_TOOLBAR_CALLBACK` to always return True in DEBUG.
#
# In production / test, this whole block is skipped.
# ═════════════════════════════════════════════════════════════════

INSTALLED_APPS += ["debug_toolbar"]  # noqa: F405

MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")

INTERNAL_IPS = [
    "127.0.0.1",
    "::1",
    "172.17.0.1",   # default docker0
    "172.18.0.1",
    "172.19.0.1",
    "172.20.0.1",
    "172.21.0.1",
    "172.22.0.1",
    "10.0.0.1",     # some VPN / WSL setups
]

def _show_toolbar(request):
    return bool(DEBUG)


DEBUG_TOOLBAR_CONFIG = {
    "SHOW_TOOLBAR_CALLBACK": _show_toolbar,
    # Render toolbar in a lightweight theme; reduce visual clutter.
    "DISABLE_PANELS": {
        "debug_toolbar.panels.redirects.RedirectsPanel",
        "debug_toolbar.panels.profiling.ProfilingPanel",
    },
    "SHOW_TEMPLATE_CONTEXT": True,
    "ROOT_TAG_EXTRA_ATTRS": "data-turbo-permanent",
    # Useful for inspecting the toolbar JSON payload manually.
    "RESULTS_STORE_SIZE": 50,
}