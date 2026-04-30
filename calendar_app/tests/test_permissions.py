from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import CustomUser, Technology


class PermissionTests(APITestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_superuser(
            username="admin", password="pw", email="admin@example.com"
        )
        self.manager_group, _ = Group.objects.get_or_create(name="Manager")

        self.siae_user = CustomUser.objects.create_user(
            username="siae", password="pw", email="siae@example.com", role="SIAE"
        )
        self.siae_user.groups.add(self.manager_group)

        self.eng_user = CustomUser.objects.create_user(
            username="eng", password="pw", email="eng@example.com", role="ENG"
        )
        self.eng_user.groups.add(self.manager_group)

        self.readonly_user = CustomUser.objects.create_user(
            username="readonly", password="pw", email="ro@example.com", role="CR"
        )
        self.tech = Technology.objects.create(name="Linux")

    def _get_token(self, username):
        response = self.client.post(reverse("token_obtain_pair"), {
            "username": username,
            "password": "pw"
        })
        return response.data["access"]

    def test_readonly_user_cannot_create_tech(self):
        token = self._get_token("readonly")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        url = reverse("technology-list")
        response = self.client.post(url, {"name": "New Tech", "slug": "new-tech"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_siae_user_can_create_shift(self):
        token = self._get_token("siae")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        url = reverse("shift-list")
        data = {"date": "2023-01-01", "technology_id": self.tech.id}
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_can_manage_settings(self):
        token = self._get_token("admin")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        url = reverse("site-settings")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_eng_user_cannot_manage_settings(self):
        token = self._get_token("eng")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        url = reverse("site-settings")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_readonly_user_can_list_shifts(self):
        token = self._get_token("readonly")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        url = reverse("shift-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_readonly_user_cannot_create_shift(self):
        token = self._get_token("readonly")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        url = reverse("shift-list")
        response = self.client.post(url, {"date": "2023-01-01", "technology_id": self.tech.id})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_siae_manager_cannot_access_eng_domain_data(self):
        """SIAE manager listing users should only see SIAE users."""
        token = self._get_token("siae")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        url = reverse("user-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = [u["username"] for u in response.data.get("results", response.data)]
        self.assertNotIn("eng", usernames)
