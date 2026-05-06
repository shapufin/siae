from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    Assignment,
    CustomUser,
    Shift,
    StandbyDetail,
    Technology,
    UserTechnology,
    Vacation,
    SiteSettings,
)


class UserTechnologyInline(admin.TabularInline):
    model = UserTechnology
    extra = 1


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    fieldsets = (
        ("Brand Settings", {"fields": ("brand_name", "client_role_label", "consultant_role_label")}),
        (
            "Announcement Settings",
            {"fields": ("announcement_enabled", "announcement_text", "announcement_color")},
        ),
        (
            "Email Settings",
            {
                "fields": (
                    "smtp_host",
                    "smtp_port",
                    "smtp_user",
                    "smtp_password",
                    "smtp_use_tls",
                    "smtp_from_email",
                )
            },
        ),
        (
            "Notification Settings",
            {"fields": ("notifications_enabled", "notify_on_vacation_change", "notify_on_shift_change")},
        ),
        ("Rate Limiting", {"fields": ("anon_throttle_rate", "user_throttle_rate")}),
        ("JWT Settings", {"fields": ("jwt_access_minutes", "jwt_refresh_days")}),
    )

    def has_add_permission(self, request):
        # Only allow one instance of SiteSettings
        if self.model.objects.exists():
            return False
        return super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        # Prevent deletion of the single instance
        return False

    def has_change_permission(self, request, obj=None):
        return True if request.user.is_superuser else super().has_change_permission(request, obj)

    def has_view_permission(self, request, obj=None):
        return True if request.user.is_superuser else super().has_view_permission(request, obj)

    list_display = ["brand_name", "announcement_enabled", "announcement_color"]
    list_display_links = ["brand_name"]


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Role Info", {"fields": ("role", "phone_number")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            "Role Info",
            {
                "classes": ("wide",),
                "fields": ("role", "phone_number"),
            },
        ),
    )
    list_display = ["username", "email", "first_name", "last_name", "role", "is_staff"]
    list_filter = ["role", "is_staff", "is_superuser", "is_active"]
    inlines = [UserTechnologyInline]


@admin.register(Technology)
class TechnologyAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "color_code"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Vacation)
class VacationAdmin(admin.ModelAdmin):
    list_display = ["user", "start_date", "end_date", "created_at"]
    list_filter = ["start_date", "end_date"]
    date_hierarchy = "start_date"


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ["date", "technology", "notes"]
    list_filter = ["date", "technology"]
    date_hierarchy = "date"


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ["shift", "user", "type"]
    list_filter = ["type", "shift__technology"]


@admin.register(StandbyDetail)
class StandbyDetailAdmin(admin.ModelAdmin):
    list_display = ["assignment", "role", "phone_number"]
    list_filter = ["role"]
