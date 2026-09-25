from .base import *  # noqa

DEBUG = False


# --------------------------------------------------------------------------- #
# HTTPS / transport
# --------------------------------------------------------------------------- #
SECURE_SSL_REDIRECT = env("SECURE_SSL_REDIRECT", True, bool)  # noqa: F405
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"


# --------------------------------------------------------------------------- #
# Cookies
# --------------------------------------------------------------------------- #
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = False  # JS must read CSRF token

# Trust X-Forwarded-For only when behind a single proxy
if env("TRUST_PROXY", False, bool):  # noqa: F405
    REST_FRAMEWORK = {**REST_FRAMEWORK, "NUM_PROXIES": 1}  # noqa: F405


# --------------------------------------------------------------------------- #
# CORS — explicit origins only in production
# --------------------------------------------------------------------------- #
CORS_ALLOW_ALL_ORIGINS = False
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS  # noqa: F405


# --------------------------------------------------------------------------- #
# Cache — warn if DatabaseCache is used (forgot createcachetable?)
# --------------------------------------------------------------------------- #
if CACHES["default"]["BACKEND"].endswith("DatabaseCache"):  # noqa: F405
    import logging
    logging.getLogger(__name__).warning(
        "Using DatabaseCache. Ensure `python manage.py createcachetable` "
        "has been run, or set REDIS_URL for better performance."
    )