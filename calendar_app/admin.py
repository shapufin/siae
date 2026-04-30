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
)


class UserTechnologyInline(admin.TabularInline):
    model = UserTechnology
    extra = 1


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
