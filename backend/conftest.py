import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    from apps.s_accounts.tests.factories import UserFactory
    return UserFactory()


@pytest.fixture
def other_user(db):
    from apps.s_accounts.tests.factories import UserFactory
    return UserFactory(username="other", email="other@example.com")


@pytest.fixture
def auth_client(api_client, user):
    api_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}"
    )
    return api_client


@pytest.fixture
def other_client(other_user):
    c = APIClient()
    c.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(other_user).access_token}"
    )
    return c


@pytest.fixture
def sport(db):
    from apps.s_sports.models import Sport
    return Sport.objects.create(name="Football", slug="football")


@pytest.fixture
def city(db):
    from apps.s_locations.models import City, Country, Region
    country, _ = Country.objects.get_or_create(code="IR", defaults={"name": "Iran"})
    region, _ = Region.objects.get_or_create(
        country=country, name="Tehran", defaults={"slug": "tehran"}
    )
    city, _ = City.objects.get_or_create(
        region=region, name="Tehran", defaults={"slug": "tehran"}
    )
    return city