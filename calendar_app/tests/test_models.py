from datetime import date

from django.core.exceptions import ValidationError
from django.test import TestCase

from ..models import Assignment, CustomUser, Shift, StandbyDetail, Technology, Vacation


class ModelTests(TestCase):
    def setUp(self):
        self.tech = Technology.objects.create(name="Linux", color_code="#000000")
        self.user = CustomUser.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpassword123",
            role="SIAE"
        )

    def test_technology_slug_auto_creation(self):
        tech = Technology.objects.create(name="Cloud Computing")
        self.assertEqual(tech.slug, "cloud-computing")

    def test_vacation_clean_validation(self):
        vacation = Vacation(
            user=self.user,
            start_date=date(2023, 1, 10),
            end_date=date(2023, 1, 5)  # End before start
        )
        with self.assertRaises(ValidationError):
            vacation.clean()

    def test_standby_detail_auto_shift_assignment(self):
        shift = Shift.objects.create(date=date(2023, 1, 1), technology=self.tech)
        assignment = Assignment.objects.create(shift=shift, user=self.user, type="STANDBY")
        detail = StandbyDetail.objects.create(assignment=assignment, role="PRIMARY")
        self.assertEqual(detail.shift, shift)

    def test_standby_detail_relegation(self):
        shift = Shift.objects.create(date=date(2023, 1, 1), technology=self.tech)

        # First primary
        user1 = CustomUser.objects.create_user(username="u1", password="pw")
        assign1 = Assignment.objects.create(shift=shift, user=user1, type="STANDBY")
        detail1 = StandbyDetail.objects.create(assignment=assign1, role="PRIMARY")

        # Second primary - should relegate first to backup
        user2 = CustomUser.objects.create_user(username="u2", password="pw")
        assign2 = Assignment.objects.create(shift=shift, user=user2, type="STANDBY")
        detail2 = StandbyDetail.objects.create(assignment=assign2, role="PRIMARY")

        detail1.refresh_from_db()
        self.assertEqual(detail1.role, "BACKUP")
        self.assertEqual(detail2.role, "PRIMARY")
