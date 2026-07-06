from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from . import views


class UnthrottledTokenObtainPairView(TokenObtainPairView):
    """Login endpoint intentionally bypasses default throttling on this private network."""
    throttle_classes = []


class UnthrottledTokenRefreshView(TokenRefreshView):
    """Token refresh endpoint intentionally bypasses default throttling on this private network."""
    throttle_classes = []


router = DefaultRouter()
router.register(r"technologies", views.TechnologyViewSet, basename="technology")
router.register(r"users", views.UserViewSet, basename="user")
router.register(r"vacations", views.VacationViewSet, basename="vacation")
router.register(r"shifts", views.ShiftViewSet, basename="shift")
router.register(r"assignments", views.AssignmentViewSet, basename="assignment")
router.register(r"standby-details", views.StandbyDetailViewSet, basename="standby-detail")

urlpatterns = [
    path("v1/", include(router.urls)),
    path("", include(router.urls)), # Keep legacy root access for now
    path("v1/health/", views.HealthCheckView.as_view(), name="health_check_v1"),
    path("health/", views.HealthCheckView.as_view(), name="health_check"),
    path("v1/auth/token/", UnthrottledTokenObtainPairView.as_view(), name="token_obtain_pair_v1"),
    path("auth/token/", UnthrottledTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("v1/auth/token/refresh/", UnthrottledTokenRefreshView.as_view(), name="token_refresh_v1"),
    path("auth/token/refresh/", UnthrottledTokenRefreshView.as_view(), name="token_refresh"),
    path(
        "v1/default-crew/<int:pk>/",
        views.DefaultCrewView.as_view(),
        name="default-crew-v1",
    ),
    path(
        "default-crew/<int:pk>/",
        views.DefaultCrewView.as_view(),
        name="default-crew",
    ),
    path(
        "v1/notifications/badge/",
        views.NotificationBadgeView.as_view(),
        name="notification-badge-v1",
    ),
    path(
        "notifications/badge/",
        views.NotificationBadgeView.as_view(),
        name="notification-badge",
    ),
    path(
        "v1/shifts-by-date/<str:date>/<int:technology_id>/",
        views.ShiftByDateTechnologyView.as_view(),
        name="shifts-by-date-tech-v1",
    ),
    path(
        "shifts-by-date/<str:date>/<int:technology_id>/",
        views.ShiftByDateTechnologyView.as_view(),
        name="shifts-by-date-tech",
    ),
    path(
        "v1/settings/",
        views.SiteSettingsView.as_view(),
        name="site-settings-v1",
    ),
    path(
        "settings/",
        views.SiteSettingsView.as_view(),
        name="site-settings",
    ),
    path(
        "v1/settings/test-email/",
        views.TestEmailView.as_view(),
        name="site-settings-test-email-v1",
    ),
    path(
        "settings/test-email/",
        views.TestEmailView.as_view(),
        name="site-settings-test-email",
    ),
    path(
        "v1/settings/public/",
        views.SiteSettingsPublicView.as_view(),
        name="site-settings-public-v1",
    ),
    path(
        "settings/public/",
        views.SiteSettingsPublicView.as_view(),
        name="site-settings-public",
    ),
    path(
        "v1/admin/reset-db/",
        views.ResetDatabaseView.as_view(),
        name="admin-reset-db-v1",
    ),
    path(
        "admin/reset-db/",
        views.ResetDatabaseView.as_view(),
        name="admin-reset-db",
    ),
    path(
        "v1/admin/backup/",
        views.BackupView.as_view(),
        name="admin-backup-v1",
    ),
    path(
        "admin/backup/",
        views.BackupView.as_view(),
        name="admin-backup",
    ),
    path(
        "v1/admin/restore/",
        views.RestoreView.as_view(),
        name="admin-restore-v1",
    ),
    path(
        "admin/restore/",
        views.RestoreView.as_view(),
        name="admin-restore",
    ),
]
