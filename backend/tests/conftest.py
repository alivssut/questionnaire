import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


@pytest.fixture(autouse=True)
def _clear_cache():
    """Throttle counters are cached — reset between tests."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client():
    """Unauthenticated client."""
    return APIClient()


def _auth(client, user):
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    client.user = user
    return client


@pytest.fixture
def admin_client():
    from tests.factories import SuperUserFactory
    return _auth(APIClient(), SuperUserFactory())


@pytest.fixture
def user_client():
    from tests.factories import UserFactory
    return _auth(APIClient(), UserFactory())


@pytest.fixture
def creator_client():
    from tests.factories import CreatorUserFactory
    return _auth(APIClient(), CreatorUserFactory())


@pytest.fixture
def make_client():
    """Factory to build an authenticated client for an arbitrary user."""
    def _make(user):
        return _auth(APIClient(), user)
    return _make