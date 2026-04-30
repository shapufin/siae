from typing import Any

from django.contrib.auth.models import AbstractUser, UserManager
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, QuerySet, UniqueConstraint
from django.utils.text import slugify


class Technology(models.Model):
    """Technology container (e.g., LINUX, DB, CLOUD)."""
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    color_code = models.CharField(max_length=7, default="#3b82f6")
    role = models.CharField(
        max_length=10,
        choices=[
            ("CR", "Read-Only"),
            ("SIAE", "Client Domain"),
            ("ENG", "Consultant Domain"),
        ],
        default="CR",
    )

    class Meta:
        verbose_name = "Technology"
        verbose_name_plural = "Technologies"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
        from django.core.cache import cache
        # Invalidate all role-specific lists
        cache.delete("technologies_list_all")
        cache.delete("technologies_list_SIAE")
        cache.delete("technologies_list_ENG")
        cache.delete("technologies_list_CR")

    def delete(self, *args: Any, **kwargs: Any) -> None:
        super().delete(*args, **kwargs)
        from django.core.cache import cache
        # Invalidate all role-specific lists
        cache.delete("technologies_list_all")
        cache.delete("technologies_list_SIAE")
        cache.delete("technologies_list_ENG")
        cache.delete("technologies_list_CR")


class CustomUserManager(UserManager["CustomUser"]):
    def with_vacation_status(self, date: Any) -> QuerySet["CustomUser"]:
        """Annotate users with vacation status for a specific date."""
        return self.annotate(
            vacation_status=models.Exists(
                Vacation.objects.filter(
                    user=models.OuterRef("pk"),
                    start_date__lte=date,
                    end_date__gte=date,
                )
            )
        )


class CustomUser(AbstractUser):
    """Extended user with group and technology assignments."""
    ROLE_CHOICES = [
        ("CR", "Read-Only"),
        ("SIAE", "Client Domain"),
        ("ENG", "Consultant Domain"),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="CR")
    technologies = models.ManyToManyField(
        Technology,
        through="UserTechnology",
        related_name="assigned_users",
        blank=True,
    )
    phone_number = models.CharField(max_length=20, blank=True)

    objects = CustomUserManager()

    class Meta:
        ordering = ["username"]
        indexes = [
            models.Index(fields=["role"]),
        ]

    def __str__(self) -> str:
        return f"{self.username} ({self.get_role_display()})"

    @property
    def is_admin(self) -> bool:
        return self.is_staff or self.is_superuser

    @property
    def is_manager(self) -> bool:
        return self.groups.filter(name="Manager").exists() or self.is_admin

    @property
    def is_read_only(self) -> bool:
        return self.role == "CR"

    @property
    def is_siae(self) -> bool:
        return self.role == "SIAE"

    @property
    def is_eng(self) -> bool:
        return self.role == "ENG"


class UserTechnology(models.Model):
    """Through model for User-Technology M2M with default flag."""
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    technology = models.ForeignKey(Technology, on_delete=models.CASCADE)
    is_default = models.BooleanField(default=False)

    class Meta:
        constraints = [
            UniqueConstraint(fields=["user", "technology"], name="unique_user_technology")
        ]

    def __str__(self) -> str:
        return f"{self.user.username} -> {self.technology.name}"


class Vacation(models.Model):
    """Vacation period for a user."""
    VACATION_TYPE_CHOICES = [
        ("PTO", "Paid Time Off"),
        ("SICK", "Sick Leave"),
        ("HOLIDAY", "Public Holiday"),
        ("OTHER", "Other"),
    ]
    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="vacations"
    )
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    type = models.CharField(
        max_length=20, choices=VACATION_TYPE_CHOICES, default="PTO"
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date"]
        indexes = [
            models.Index(fields=["user", "start_date", "end_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.username}: {self.start_date} - {self.end_date}"

    def clean(self) -> None:
        if self.end_date < self.start_date:
            raise ValidationError("End date must be after start date.")


class Shift(models.Model):
    """Daily entry linked to a specific technology."""
    date = models.DateField(db_index=True)
    technology = models.ForeignKey(
        Technology, on_delete=models.CASCADE, related_name="shifts"
    )
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, related_name="created_shifts"
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            UniqueConstraint(fields=["date", "technology"], name="unique_shift_date_technology")
        ]
        ordering = ["-date", "technology__name"]
        indexes = [
            models.Index(fields=["date"]),
            models.Index(fields=["date", "technology"]),
        ]

    def __str__(self) -> str:
        return f"{self.date} | {self.technology.name}"


class Assignment(models.Model):
    """Links a user to a shift with a specific assignment type."""
    TYPE_CHOICES = [
        ("WORK_HOURS", "Work Hours"),
        ("STANDBY", "Standby"),
    ]
    shift = models.ForeignKey(
        Shift, on_delete=models.CASCADE, related_name="assignments"
    )
    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="assignments"
    )
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["shift", "user", "type"],
                name="unique_assignment_shift_user_type",
            )
        ]
        indexes = [
            models.Index(fields=["type"]),
            models.Index(fields=["shift", "type"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} @ {self.shift} ({self.type})"


class StandbyDetail(models.Model):
    """Details for standby assignments."""
    ROLE_CHOICES = [
        ("PRIMARY", "Primary"),
        ("BACKUP", "Backup"),
    ]
    assignment = models.OneToOneField(
        Assignment,
        on_delete=models.CASCADE,
        related_name="standby_detail",
        limit_choices_to={"type": "STANDBY"},
    )
    shift = models.ForeignKey(
        Shift,
        on_delete=models.CASCADE,
        related_name="standby_details",
        editable=False,
        null=True,
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    phone_number = models.CharField(max_length=20, blank=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["shift", "role"],
                condition=Q(role="PRIMARY"),
                name="unique_primary_standby_per_shift",
            )
        ]

    def __str__(self) -> str:
        return f"{self.role} standby: {self.assignment.user.username}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.shift_id and self.assignment_id:
            self.shift = self.assignment.shift

        # Auto-relegate existing PRIMARY to BACKUP if this is a new PRIMARY
        if self.role == "PRIMARY" and self.shift:
            existing_primary = StandbyDetail.objects.filter(
                shift=self.shift,
                role="PRIMARY"
            ).exclude(pk=self.pk).first()

            if existing_primary:
                # If we are making this one primary, the old one must become backup.
                # If there's already a backup, we delete it to maintain exactly 1 PRI / 1 BCK.
                existing_backup = StandbyDetail.objects.filter(
                    shift=self.shift,
                    role="BACKUP"
                ).exclude(pk=self.pk).first()
                if existing_backup:
                    existing_backup.delete()

                existing_primary.role = "BACKUP"
                existing_primary.save()

        super().save(*args, **kwargs)

    def clean(self) -> None:
        if not self.shift_id and self.assignment_id:
            self.shift = self.assignment.shift
        # We allow auto-relegation in save(), so no need to block in clean()
        pass


class SiteSettings(models.Model):
    """Singleton model for global application configuration."""
    brand_name = models.CharField(max_length=100, default="Omni Calendar")
    client_role_label = models.CharField(max_length=50, default="Client")
    consultant_role_label = models.CharField(max_length=50, default="Consultant")

    smtp_host = models.CharField(max_length=255, blank=True)
    smtp_port = models.PositiveIntegerField(default=587)
    smtp_user = models.CharField(max_length=255, blank=True)
    smtp_password = models.CharField(max_length=500, blank=True)
    smtp_use_tls = models.BooleanField(default=True)
    smtp_from_email = models.EmailField(default="noreply@omni-calendar.local")

    notifications_enabled = models.BooleanField(default=False)
    notify_on_vacation_change = models.BooleanField(default=True)
    notify_on_shift_change = models.BooleanField(default=True)

    # Dynamic throttling rates (stored as Django-style strings, e.g. "100/day")
    anon_throttle_rate = models.CharField(max_length=20, default="100/day")
    user_throttle_rate = models.CharField(max_length=20, default="1000/hour")

    # Dynamic JWT lifetimes (minutes / days)
    jwt_access_minutes = models.PositiveIntegerField(default=60)
    jwt_refresh_days = models.PositiveIntegerField(default=7)

    class Meta:
        verbose_name = "Site Settings"
        verbose_name_plural = "Site Settings"

    def __str__(self) -> str:
        return self.brand_name

    def clean(self) -> None:
        import re
        # Validate throttle rates (Django/DRF format: "num/period")
        rate_pattern = r'^\d+/(second|minute|hour|day)$'
        if not re.match(rate_pattern, self.anon_throttle_rate):
            raise ValidationError({"anon_throttle_rate": "Invalid rate format. Use 'num/period' (e.g., '100/day')."})
        if not re.match(rate_pattern, self.user_throttle_rate):
            raise ValidationError({"user_throttle_rate": "Invalid rate format. Use 'num/period' (e.g., '1000/hour')."})

        # Validate JWT lifetimes
        if not (1 <= self.jwt_access_minutes <= 1440):
            raise ValidationError({"jwt_access_minutes": "Access token lifetime must be between 1 and 1440 minutes (24 hours)."})
        if not (1 <= self.jwt_refresh_days <= 30):
            raise ValidationError({"jwt_refresh_days": "Refresh token lifetime must be between 1 and 30 days."})

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        self.pk = 1
        super().save(*args, **kwargs)
        from django.core.cache import cache
        cache.delete("site_settings")

    @classmethod
    def load(cls: type["SiteSettings"]) -> "SiteSettings":
        from django.core.cache import cache
        key = "site_settings"
        obj = cache.get(key)
        if obj is None:
            obj, _ = cls.objects.get_or_create(pk=1)
            cache.set(key, obj, 3600)  # Cache for 1 hour
        return obj

