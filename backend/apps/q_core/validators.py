from django.conf import settings
from django.core.exceptions import ValidationError


def validate_upload(file):
    if not file:
        return
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if file.size > max_bytes:
        raise ValidationError(f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit.")
    ctype = getattr(file, "content_type", None)
    if ctype and ctype not in settings.ALLOWED_UPLOAD_MIME:
        raise ValidationError(f"Unsupported file type: {ctype}")