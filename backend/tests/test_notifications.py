import pytest
from django.urls import reverse

from apps.q_notifications.models import Notification
from apps.q_notifications.services import notify_user
from tests.factories import NotificationFactory


@pytest.mark.django_db
def test_user_sees_only_own_notifications(user_client):
    NotificationFactory(user=user_client.user)
    NotificationFactory()  # someone else
    r = user_client.get(reverse("v1:notifications:notifications-list"))
    assert r.data["count"] == 1


@pytest.mark.django_db
def test_mark_single_read(user_client):
    n = NotificationFactory(user=user_client.user, is_read=False)
    r = user_client.post(
        reverse("v1:notifications:notifications-read", args=[n.id]),
    )
    assert r.status_code == 200
    n.refresh_from_db()
    assert n.is_read is True


@pytest.mark.django_db
def test_mark_all_read(user_client):
    NotificationFactory(user=user_client.user, is_read=False)
    NotificationFactory(user=user_client.user, is_read=False)
    r = user_client.post(reverse("v1:notifications:notifications-read-all"))
    assert r.status_code == 200
    assert r.data["updated"] == 2
    assert Notification.objects.filter(
        user=user_client.user, is_read=False,
    ).count() == 0


@pytest.mark.django_db
def test_unread_count(user_client):
    NotificationFactory(user=user_client.user, is_read=False)
    NotificationFactory(user=user_client.user, is_read=True)
    NotificationFactory(user=user_client.user, is_read=False)
    r = user_client.get(
        reverse("v1:notifications:notifications-unread-count"),
    )
    assert r.data["unread"] == 2


@pytest.mark.django_db
def test_filter_by_is_read(user_client):
    NotificationFactory(user=user_client.user, is_read=False)
    NotificationFactory(user=user_client.user, is_read=True)
    r = user_client.get(
        reverse("v1:notifications:notifications-list") + "?is_read=false",
    )
    assert r.data["count"] == 1


@pytest.mark.django_db
def test_cannot_access_other_users_notification(user_client):
    n = NotificationFactory()
    r = user_client.get(
        reverse("v1:notifications:notifications-detail", args=[n.id]),
    )
    assert r.status_code == 404


@pytest.mark.django_db
def test_notify_user_service():
    from tests.factories import UserFactory
    u = UserFactory()
    n = notify_user(
        user=u,
        title="Hi",
        message="Body",
        type=Notification.Type.SYSTEM,
    )
    assert n is not None
    assert n.user_id == u.id


@pytest.mark.django_db
def test_notify_user_swallows_errors(monkeypatch):
    """Broken notification must not raise."""
    def boom(*args, **kwargs):
        raise RuntimeError("db down")

    from apps.q_notifications import services
    monkeypatch.setattr(services.Notification.objects, "create", boom)

    from tests.factories import UserFactory
    u = UserFactory()
    result = notify_user(
        user=u, title="x", message="y", type=Notification.Type.SYSTEM,
    )
    assert result is None