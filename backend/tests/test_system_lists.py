import pytest
from django.urls import reverse

from tests.factories import ListItemFactory, SystemListFactory


@pytest.mark.django_db
def test_authenticated_user_can_list_system_lists(user_client):
    SystemListFactory()
    SystemListFactory()
    r = user_client.get(reverse("v1:surveys:system-lists-list"))
    assert r.status_code == 200
    assert r.data["count"] == 2


@pytest.mark.django_db
def test_unauthenticated_cannot_list(api_client):
    r = api_client.get(reverse("v1:surveys:system-lists-list"))
    assert r.status_code == 401


@pytest.mark.django_db
def test_list_includes_items(user_client):
    sl = SystemListFactory()
    ListItemFactory(system_list=sl, label="Iran", value="IR", order=0)
    ListItemFactory(system_list=sl, label="USA", value="US", order=1)

    r = user_client.get(reverse("v1:surveys:system-lists-detail", args=[sl.id]))
    assert r.status_code == 200
    assert len(r.data["items"]) == 2
    # Items should be ordered
    assert r.data["items"][0]["label"] == "Iran"


@pytest.mark.django_db
def test_cannot_create_via_api(user_client):
    """System lists are read-only from the public API."""
    r = user_client.post(
        reverse("v1:surveys:system-lists-list"),
        {"name": "Test", "slug": "test"},
    )
    assert r.status_code == 405


@pytest.mark.django_db
def test_filter_by_type(user_client):
    SystemListFactory(type="CUSTOM")
    SystemListFactory(type="COUNTRY")

    r = user_client.get(
        reverse("v1:surveys:system-lists-list") + "?type=COUNTRY",
    )
    assert r.data["count"] == 1