import os
import logging
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")


def env(key, default=None, cast=str):
    value = os.getenv(key, default)
    if value is None:
        return None
    if cast is bool:
        return str(value).strip().lower() in ("1", "true", "yes", "on")
    if cast is list:
        return [v.strip() for v in str(value).split(",") if v.strip()]
    return cast(value)


# --------------------------------------------------------------------------- #
# Security
# --------------------------------------------------------------------------- #
SECRET_KEY = env("DJANGO_SECRET_KEY", "unsafe-dev-key-change-me")
DEBUG = env("DJANGO_DEBUG", False, bool)
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1", list)

if not DEBUG and SECRET_KEY == "unsafe-dev-key-change-me":
    raise RuntimeError(
        "DJANGO_SECRET_KEY must be set in production (non-DEBUG environment)."
    )


# --------------------------------------------------------------------------- #
# Apps
# --------------------------------------------------------------------------- #
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "corsheaders",
]

# IMPORTANT: q_accounts must come first (defines AUTH_USER_MODEL)
LOCAL_APPS = [
    "apps.q_core",
    "apps.q_accounts",
    "apps.q_surveys",
    "apps.q_assignments",
    "apps.q_responses",
    "apps.q_analytics",
    "apps.q_notifications",
    "apps.q_activity",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS


# --------------------------------------------------------------------------- #
# Middleware
# --------------------------------------------------------------------------- #
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", "formly"),
        "USER": env("POSTGRES_USER", "formly"),
        "PASSWORD": env("POSTGRES_PASSWORD", "formly"),
        "HOST": env("POSTGRES_HOST", "db"),
        "PORT": env("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
AUTH_USER_MODEL = "q_accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# --------------------------------------------------------------------------- #
# Auth flow toggles
# --------------------------------------------------------------------------- #
# If False, /auth/register/ returns 403 and users can only be created by
# a superuser (via /users/ or the admin panel).
ALLOW_PUBLIC_REGISTRATION = env("ALLOW_PUBLIC_REGISTRATION", False, bool)
# If False, email verification endpoints are disabled entirely.
EMAIL_VERIFICATION_ENABLED = env("EMAIL_VERIFICATION_ENABLED", True, bool)
# If True, a user whose is_verified=False cannot log in (or refresh tokens).
REQUIRE_VERIFIED_TO_LOGIN = env("REQUIRE_VERIFIED_TO_LOGIN", False, bool)
FRONTEND_URL = env("FRONTEND_URL", "http://localhost:3000")


# --------------------------------------------------------------------------- #
# i18n / tz / static / media
# --------------------------------------------------------------------------- #
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# --------------------------------------------------------------------------- #
# DRF
# --------------------------------------------------------------------------- #
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.q_core.pagination.DefaultPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.q_core.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "600/min",
        "login": "10/min",
    },
}


# --------------------------------------------------------------------------- #
# SimpleJWT
# --------------------------------------------------------------------------- #
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=env("JWT_ACCESS_LIFETIME_MIN", 30, int),
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=env("JWT_REFRESH_LIFETIME_DAYS", 7, int),
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_TYPE_CLAIM": "token_type",
}


# --------------------------------------------------------------------------- #
# Cache
# --------------------------------------------------------------------------- #
# Priority:
#   1. REDIS_URL set      → Redis (recommended for production, multi-worker)
#   2. DEBUG (no Redis)   → LocMem (dev only; throttling is not shared)
#   3. prod (no Redis)    → DatabaseCache (shared across workers).
#      Requires `python manage.py createcachetable` once during deploy.
# --------------------------------------------------------------------------- #
_logger = logging.getLogger(__name__)

REDIS_URL = env("REDIS_URL", "")

if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }
elif DEBUG:
    _logger.warning(
        "REDIS_URL not set — using LocMemCache. "
        "Throttling counters are NOT shared across workers."
    )
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "formly-cache",
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.db.DatabaseCache",
            "LOCATION": "formly_cache_table",
        }
    }


# --------------------------------------------------------------------------- #
# CORS
# --------------------------------------------------------------------------- #
CORS_ALLOWED_ORIGINS = env(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000", list,
)
CORS_ALLOW_ALL_ORIGINS = env("CORS_ALLOW_ALL_ORIGINS", DEBUG, bool)
CORS_ALLOW_CREDENTIALS = True


# --------------------------------------------------------------------------- #
# drf-spectacular (OpenAPI)
# --------------------------------------------------------------------------- #
SPECTACULAR_SETTINGS = {
    "TITLE": "FORMly API",
    "DESCRIPTION": "SaaS questionnaire & survey management platform",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": "/api/v1",
    "SORT_OPERATIONS": False,
    "SWAGGER_UI_SETTINGS": {"persistAuthorization": True},
    "SECURITY": [{"jwtAuth": []}],
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "jwtAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            },
        },
    },
}


# --------------------------------------------------------------------------- #
# Email
# --------------------------------------------------------------------------- #
EMAIL_BACKEND = env(
    "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend",
)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "no-reply@formly.local")


# --------------------------------------------------------------------------- #
# Uploads
# --------------------------------------------------------------------------- #
MAX_UPLOAD_SIZE_MB = env("MAX_UPLOAD_SIZE_MB", 10, int)
ALLOWED_UPLOAD_MIME = {
    "image/jpeg", "image/png", "image/webp",
    "application/pdf", "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


# --------------------------------------------------------------------------- #
# Logging
# --------------------------------------------------------------------------- #
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.security": {
            "level": "WARNING",
            "handlers": ["console"],
            "propagate": False,
        },
        "django.db.backends": {
            "level": "WARNING",
            "handlers": ["console"],
            "propagate": False,
        },
    },
}