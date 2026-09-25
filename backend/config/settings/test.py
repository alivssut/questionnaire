import tempfile

from .base import *  # noqa: F401,F403,F405

DEBUG = False
SECRET_KEY = "test-only-not-secret"

# Fast hashing
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# In-memory cache, no Redis needed
CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
}

# Disable throttling in tests
REST_FRAMEWORK = {  # noqa: F405
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_CLASSES": (),
    "DEFAULT_THROTTLE_RATES": {},
}

# No connection reuse (faster test teardown with atomic tests)
DATABASES["default"] = {  # noqa: F405
    **DATABASES["default"],  # noqa: F405
    "CONN_MAX_AGE": 0,
}

# Isolated media root
MEDIA_ROOT = tempfile.mkdtemp(prefix="formly-test-")

# In-memory email — access via `django.core.mail.outbox`
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Simpler password rules
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
]

# Default auth toggles for tests
ALLOW_PUBLIC_REGISTRATION = True
EMAIL_VERIFICATION_ENABLED = False
REQUIRE_VERIFIED_TO_LOGIN = False