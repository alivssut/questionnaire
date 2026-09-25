import secrets
from datetime import timedelta

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from apps.q_core.models import BaseModel, UUIDModel


def default_notification_preferences():
    return {
        "email": True,
        "assignments": True,
        "reminders": False,
        "completions": True,
    }



class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("is_verified", True)
        if extra.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra)


class User(BaseModel, AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(max_length=254, unique=True)
    first_name = models.CharField(max_length=64, blank=True)
    last_name = models.CharField(max_length=64, blank=True)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    
    notification_preferences = models.JSONField(
        default=default_notification_preferences,
        blank=True,
    )

    objects = UserManager()
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "q_users"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(Lower("email"), name="uniq_user_email_lower"),
        ]
        permissions = [
            ("can_create_survey", "Can create surveys"),
        ]
        indexes = [
            models.Index(fields=["is_active", "created_at"]),
        ]

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

    @property
    def is_admin(self):
        return self.is_superuser

    def can_create_surveys(self):
        return self.is_superuser or self.has_perm("q_accounts.can_create_survey")


class EmailVerificationToken(UUIDModel):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="verification_tokens",
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "q_email_verification_tokens"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "used_at"])]

    @classmethod
    def issue(cls, user, ttl_hours: int = 24) -> "EmailVerificationToken":
        return cls.objects.create(
            user=user,
            token=secrets.token_urlsafe(32),
            expires_at=timezone.now() + timedelta(hours=ttl_hours),
        )

    @classmethod
    def cleanup_old(cls, keep_days: int = 7) -> int:
        cutoff = timezone.now() - timedelta(days=keep_days)
        deleted, _ = cls.objects.filter(expires_at__lt=cutoff).delete()
        return deleted

    def is_valid(self) -> bool:
        return self.used_at is None and self.expires_at > timezone.now()

    def consume(self) -> bool:
        updated = EmailVerificationToken.objects.filter(
            pk=self.pk, used_at__isnull=True,
        ).update(used_at=timezone.now())
        return updated == 1

    def __str__(self):
        return f"verify<{self.user_id}>"