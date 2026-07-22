

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import CustomUser, Shift, SiteSettings, Technology, Vacation
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

    def test_login_endpoints_are_not_throttled(self):
        """Login and refresh endpoints are intentionally unthrottled on this private network."""
        url = reverse("token_obtain_pair")
        for _ in range(3):
            response = self.client.post(url, {
                "username": "admin",
                "password": "adminpassword123",
            })
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_vacation_list_returns_flat_array(self):
        """Vacation list should not be paginated; it returns the full flat array."""
        url = reverse("vacation-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertNotIn("results", response.data)
        self.assertNotIn("count", response.data)

    def test_manager_sees_all_vacations(self):
        """A manager should see all vacations, not just their own role's."""
        from django.contrib.auth.models import Group

        manager_group, _ = Group.objects.get_or_create(name="Manager")
        siae_manager = CustomUser.objects.create_user(
            username="siae_manager", password="password123", email="siae_manager@example.com", role="SIAE"
        )
        siae_manager.groups.add(manager_group)

        siae_user = CustomUser.objects.create_user(
            username="siae_user", password="password123", email="siae_user@example.com", role="SIAE"
        )
        eng_user = CustomUser.objects.create_user(
            username="eng_user", password="password123", email="eng_user@example.com", role="ENG"
        )

        siae_vacation = Vacation.objects.create(user=siae_user, start_date="2026-07-01", end_date="2026-07-05", type="PTO")
        eng_vacation = Vacation.objects.create(user=eng_user, start_date="2026-07-10", end_date="2026-07-15", type="PTO")

        self.client.force_authenticate(user=siae_manager)
        url = reverse("vacation-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 2)
        returned_ids = {v["id"] for v in response.data}
        self.assertEqual(returned_ids, {siae_vacation.id, eng_vacation.id})

    def test_regular_user_cannot_expand_vacation_visibility(self):
        """The shared-list flag must not expose other users' vacations."""
        own_vacation = Vacation.objects.create(
            user=self.user, start_date="2026-07-01", end_date="2026-07-05", type="PTO"
        )
        other_user = CustomUser.objects.create_user(
            username="other_user", password="password123", email="other@example.com", role="ENG"
        )
        other_vacation = Vacation.objects.create(
            user=other_user, start_date="2026-07-10", end_date="2026-07-15", type="PTO"
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse("vacation-list") + "?all=true")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({v["id"] for v in response.data}, {own_vacation.id})
        self.assertNotIn(other_vacation.id, {v["id"] for v in response.data})
