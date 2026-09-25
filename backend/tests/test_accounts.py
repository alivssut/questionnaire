import pytest
from django.urls import reverse

from apps.q_accounts.models import EmailVerificationToken, User
from tests.factories import (
    DEFAULT_PASSWORD,
    SuperUserFactory,
    UserFactory,
)


# ---------------------------------------------------------------------------
# Auth: login / me / register
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_login_valid(api_client):
    UserFactory(email="a@example.com")
    r = api_client.post(
        reverse("v1:auth:login"),
        {"email": "a@example.com", "password": DEFAULT_PASSWORD},
    )
    assert r.status_code == 200
    assert r.data["user"]["email"] == "a@example.com"
    assert "access" in r.data and "refresh" in r.data


@pytest.mark.django_db
def test_login_invalid(api_client):
    r = api_client.post(
        reverse("v1:auth:login"),
        {"email": "nope@example.com", "password": "x"},
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_login_inactive_user(api_client):
    UserFactory(email="inactive@example.com", is_active=False)
    r = api_client.post(
        reverse("v1:auth:login"),
        {"email": "inactive@example.com", "password": DEFAULT_PASSWORD},
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_me_requires_auth(api_client):
    assert api_client.get(reverse("v1:auth:me")).status_code == 401


@pytest.mark.django_db
def test_me_returns_user(user_client):
    r = user_client.get(reverse("v1:auth:me"))
    assert r.status_code == 200
    assert r.data["email"] == user_client.user.email
    assert r.data["is_admin"] is False


@pytest.mark.django_db
def test_me_patch_updates_name(user_client):
    r = user_client.patch(
        reverse("v1:auth:me"),
        {"first_name": "Ali", "last_name": "Ahmadi"},
        format="json",
    )
    assert r.status_code == 200, r.data
    user_client.user.refresh_from_db()
    assert user_client.user.first_name == "Ali"


@pytest.mark.django_db
def test_me_patch_cannot_change_email(user_client):
    original = user_client.user.email
    user_client.patch(
        reverse("v1:auth:me"),
        {"email": "hacked@example.com"},
        format="json",
    )
    user_client.user.refresh_from_db()
    assert user_client.user.email == original


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_register_disabled_by_default(api_client, settings):
    settings.ALLOW_PUBLIC_REGISTRATION = False
    r = api_client.post(
        reverse("v1:auth:register"),
        {
            "email": "x@example.com",
            "password": "Str0ngPass!23",
            "password2": "Str0ngPass!23",
        },
    )
    assert r.status_code == 403


@pytest.mark.django_db
def test_register_when_enabled(api_client, settings):
    settings.ALLOW_PUBLIC_REGISTRATION = True
    settings.EMAIL_VERIFICATION_ENABLED = False
    settings.REQUIRE_VERIFIED_TO_LOGIN = False
    r = api_client.post(
        reverse("v1:auth:register"),
        {
            "email": "x@example.com",
            "password": "Str0ngPass!23",
            "password2": "Str0ngPass!23",
        },
    )
    assert r.status_code == 201, r.data
    assert r.data["user"]["is_verified"] is False
    assert "access" in r.data


@pytest.mark.django_db
def test_register_password_mismatch(api_client, settings):
    settings.ALLOW_PUBLIC_REGISTRATION = True
    r = api_client.post(
        reverse("v1:auth:register"),
        {
            "email": "x@example.com",
            "password": "Str0ngPass!23",
            "password2": "DifferentPass!23",
        },
    )
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Password change & tokens
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_change_password_blacklists_tokens(user_client):
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    old_refresh = RefreshToken.for_user(user_client.user)

    r = user_client.post(
        reverse("v1:auth:change-password"),
        {"old_password": DEFAULT_PASSWORD, "new_password": "BrandN3w!Pass"},
        format="json",
    )
    assert r.status_code == 200, r.data

    c = APIClient()
    r2 = c.post(reverse("v1:auth:refresh"), {"refresh": str(old_refresh)})
    assert r2.status_code == 401


@pytest.mark.django_db
def test_change_password_wrong_old(user_client):
    r = user_client.post(
        reverse("v1:auth:change-password"),
        {"old_password": "WrongOld!23", "new_password": "BrandN3w!Pass"},
        format="json",
    )
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_password_reset_request_is_silent(api_client):
    UserFactory(email="exists@example.com")
    r1 = api_client.post(
        reverse("v1:auth:password-reset"),
        {"email": "exists@example.com"},
    )
    r2 = api_client.post(
        reverse("v1:auth:password-reset"),
        {"email": "does-not-exist@example.com"},
    )
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.data == r2.data


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_email_verification_flow(api_client, settings):
    settings.ALLOW_PUBLIC_REGISTRATION = True
    settings.EMAIL_VERIFICATION_ENABLED = True

    r = api_client.post(
        reverse("v1:auth:register"),
        {
            "email": "v@example.com",
            "password": "Str0ngPass!23",
            "password2": "Str0ngPass!23",
        },
    )
    assert r.status_code == 201

    user = User.objects.get(email="v@example.com")
    vt = EmailVerificationToken.objects.filter(user=user, used_at__isnull=True).first()
    assert vt is not None

    r2 = api_client.post(
        reverse("v1:auth:email-verification-confirm"),
        {"token": vt.token},
    )
    assert r2.status_code == 200
    user.refresh_from_db()
    assert user.is_verified is True

    # Second use must fail
    r3 = api_client.post(
        reverse("v1:auth:email-verification-confirm"),
        {"token": vt.token},
    )
    assert r3.status_code == 400


@pytest.mark.django_db
def test_verification_resend_invalidates_previous(settings):
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    settings.EMAIL_VERIFICATION_ENABLED = True
    user = UserFactory(is_verified=False)

    c = APIClient()
    t = RefreshToken.for_user(user)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {t.access_token}")

    c.post(reverse("v1:auth:email-verification-request"))
    first = EmailVerificationToken.objects.filter(
        user=user, used_at__isnull=True,
    ).first()
    assert first is not None

    c.post(reverse("v1:auth:email-verification-request"))
    first.refresh_from_db()
    assert first.used_at is not None

    active = EmailVerificationToken.objects.filter(
        user=user, used_at__isnull=True,
    ).count()
    assert active == 1


@pytest.mark.django_db
def test_login_blocked_when_verification_required(api_client, settings):
    settings.REQUIRE_VERIFIED_TO_LOGIN = True
    UserFactory(email="unv@example.com", is_verified=False)

    r = api_client.post(
        reverse("v1:auth:login"),
        {"email": "unv@example.com", "password": DEFAULT_PASSWORD},
    )
    assert r.status_code == 403
    assert r.data["code"] == "email_not_verified"


# ---------------------------------------------------------------------------
# Admin user management
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_regular_user_cannot_manage_users(user_client):
    r = user_client.get(reverse("v1:users:users-list"))
    assert r.status_code == 403


@pytest.mark.django_db
def test_admin_can_grant_permission(admin_client):
    u = UserFactory()
    r = admin_client.patch(
        reverse("v1:users:users-detail", args=[u.id]),
        {"permissions": ["can_create_survey"]},
        format="json",
    )
    assert r.status_code == 200, r.data
    u.refresh_from_db()
    assert u.has_perm("q_accounts.can_create_survey")


@pytest.mark.django_db
def test_admin_sees_group_permissions(admin_client):
    from django.contrib.auth.models import Group, Permission

    u = UserFactory()
    g = Group.objects.create(name="Survey Builders")
    perm = Permission.objects.get(
        content_type__app_label="q_accounts",
        codename="can_create_survey",
    )
    g.permissions.add(perm)
    u.groups.add(g)

    r = admin_client.get(reverse("v1:users:users-detail", args=[u.id]))
    assert r.status_code == 200
    assert r.data["permissions"] == []
    assert "can_create_survey" in r.data["effective_permissions"]
    assert "Survey Builders" in r.data["groups"]


@pytest.mark.django_db
def test_admin_cannot_self_deactivate(admin_client):
    r = admin_client.patch(
        reverse("v1:users:users-detail", args=[admin_client.user.id]),
        {"is_active": False},
        format="json",
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_admin_cannot_self_remove_admin(admin_client):
    r = admin_client.patch(
        reverse("v1:users:users-detail", args=[admin_client.user.id]),
        {"is_admin": False},
        format="json",
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_destroy_user_deactivates_not_deletes(admin_client):
    u = UserFactory()
    r = admin_client.delete(reverse("v1:users:users-detail", args=[u.id]))
    assert r.status_code == 204
    u.refresh_from_db()
    assert u.is_active is False
    assert User.objects.filter(id=u.id).exists()


@pytest.mark.django_db
def test_destroy_user_blacklists_tokens(admin_client):
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    victim = UserFactory()
    victim_refresh = RefreshToken.for_user(victim)

    c = APIClient()
    r1 = c.post(reverse("v1:auth:refresh"), {"refresh": str(victim_refresh)})
    assert r1.status_code == 200

    r2 = admin_client.delete(reverse("v1:users:users-detail", args=[victim.id]))
    assert r2.status_code == 204

    r3 = c.post(reverse("v1:auth:refresh"), {"refresh": str(victim_refresh)})
    assert r3.status_code == 401


@pytest.mark.django_db
def test_email_unique_case_insensitive():
    User.objects.create_user(email="ali@example.com", password="x")
    from django.db import IntegrityError
    with pytest.raises(IntegrityError):
        User.objects.create_user(email="ALI@example.com", password="x")


@pytest.mark.django_db
def test_me_returns_effective_permissions_for_creator(creator_client):
    r = creator_client.get(reverse("v1:auth:me"))
    assert r.status_code == 200
    assert "can_create_survey" in r.data["permissions"]


# ═════════════════════════════════════════════════════════════════
# Email verification tokens
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_verification_token_ttl_expires(settings):
    settings.EMAIL_VERIFICATION_ENABLED = True
    from datetime import timedelta
    from django.utils import timezone
    from apps.q_accounts.models import EmailVerificationToken

    user = UserFactory(is_verified=False)
    token = EmailVerificationToken.issue(user, ttl_hours=1)

    # Force expire
    token.expires_at = timezone.now() - timedelta(seconds=1)
    token.save(update_fields=["expires_at"])

    assert token.is_valid() is False

    # Confirm must fail
    from rest_framework.test import APIClient
    c = APIClient()
    r = c.post(
        reverse("v1:auth:email-verification-confirm"),
        {"token": token.token},
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_verification_confirm_consumes_token_atomically(settings):
    settings.EMAIL_VERIFICATION_ENABLED = True
    from apps.q_accounts.models import EmailVerificationToken
    from rest_framework.test import APIClient

    user = UserFactory(is_verified=False)
    token = EmailVerificationToken.issue(user)

    c = APIClient()
    # First call succeeds
    r1 = c.post(
        reverse("v1:auth:email-verification-confirm"),
        {"token": token.token},
    )
    assert r1.status_code == 200

    # Second call fails (token consumed)
    r2 = c.post(
        reverse("v1:auth:email-verification-confirm"),
        {"token": token.token},
    )
    assert r2.status_code == 400


# ═════════════════════════════════════════════════════════════════
# Password edge cases
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_change_password_rejects_common_password(user_client):
    r = user_client.post(
        reverse("v1:auth:change-password"),
        {"old_password": DEFAULT_PASSWORD, "new_password": "password"},
        format="json",
    )
    # Common password should fail validation
    assert r.status_code == 400


@pytest.mark.django_db
def test_register_rejects_common_password(api_client, settings):
    settings.ALLOW_PUBLIC_REGISTRATION = True
    r = api_client.post(
        reverse("v1:auth:register"),
        {
            "email": "x@example.com",
            "password": "12345678",
            "password2": "12345678",
        },
    )
    assert r.status_code == 400


@pytest.mark.django_db
def test_me_patch_cannot_change_is_active_via_api(user_client):
    user_client.patch(
        reverse("v1:auth:me"),
        {"is_active": False},
        format="json",
    )
    user_client.user.refresh_from_db()
    assert user_client.user.is_active is True


# ═════════════════════════════════════════════════════════════════
# Admin bulk operations (regression: bulk endpoint doesn't exist)
# ═════════════════════════════════════════════════════════════════

@pytest.mark.django_db
def test_admin_can_patch_multiple_users_individually(admin_client):
    users = [UserFactory() for _ in range(3)]
    for u in users:
        r = admin_client.patch(
            reverse("v1:users:users-detail", args=[u.id]),
            {"is_active": False},
            format="json",
        )
        assert r.status_code == 200
    for u in users:
        u.refresh_from_db()
        assert u.is_active is False