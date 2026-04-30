

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import CustomUser, Shift, SiteSettings, Technology
from ..throttling import DynamicAnonRateThrottle, DynamicUserRateThrottle


class APITests(APITestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_superuser(
            username="admin", password="adminpassword123", email="admin@example.com"
        )
        self.user = CustomUser.objects.create_user(
            username="user", password="userpassword123", email="user@example.com", role="SIAE"
        )
        self.tech = Technology.objects.create(name="Linux", color_code="#000000")

        # Get token
        response = self.client.post(reverse("token_obtain_pair"), {
            "username": "admin",
            "password": "adminpassword123"
        })
        self.token = response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

    def test_get_technologies(self):
        url = reverse("technology-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_create_shift(self):
        url = reverse("shift-list")
        data = {
            "date": "2023-01-01",
            "technology_id": self.tech.id,
            "notes": "Test shift"
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Shift.objects.count(), 1)

    def test_health_check(self):
        url = reverse("health_check")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "healthy")

    def test_me_endpoint(self):
        url = reverse("user-me")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "admin")

    def test_dynamic_jwt_lifetimes(self):
        """Token lifetimes should follow SiteSettings values."""
        conf = SiteSettings.load()
        conf.jwt_access_minutes = 5
        conf.jwt_refresh_days = 1
        conf.save()

        response = self.client.post(reverse("token_obtain_pair"), {
            "username": "admin",
            "password": "adminpassword123"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        access = response.data["access"]
        refresh = response.data["refresh"]

        import jwt
        from django.conf import settings
        access_payload = jwt.decode(
            access, settings.SECRET_KEY, algorithms=["HS256"]
        )
        refresh_payload = jwt.decode(
            refresh, settings.SECRET_KEY, algorithms=["HS256"]
        )
        access_delta = access_payload["exp"] - access_payload["iat"]
        refresh_delta = refresh_payload["exp"] - refresh_payload["iat"]
        self.assertEqual(access_delta, 5 * 60)
        self.assertEqual(refresh_delta, 1 * 24 * 60 * 60)

    def test_dynamic_throttle_rates(self):
        """Throttle classes should read rates from SiteSettings."""
        conf = SiteSettings.load()
        conf.anon_throttle_rate = "200/day"
        conf.user_throttle_rate = "500/hour"
        conf.save()

        anon = DynamicAnonRateThrottle()
        user = DynamicUserRateThrottle()
        self.assertEqual(anon.get_rate(), "200/day")
        self.assertEqual(user.get_rate(), "500/hour")
