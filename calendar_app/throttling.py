import logging

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from .models import SiteSettings

logger = logging.getLogger(__name__)


class DynamicAnonRateThrottle(AnonRateThrottle):
    """Anonymous throttle rate pulled from SiteSettings (cached)."""

    def get_cache_key(self, request, view) -> str:
        return super().get_cache_key(request, view)

    def get_rate(self) -> str | None:
        try:
            return SiteSettings.load().anon_throttle_rate
        except Exception as e:
            logger.error(f"Error loading anon throttle rate from SiteSettings: {e}")
            return "100/day"


class DynamicUserRateThrottle(UserRateThrottle):
    """Authenticated throttle rate pulled from SiteSettings (cached)."""

    def get_cache_key(self, request, view) -> str:
        return super().get_cache_key(request, view)

    def get_rate(self) -> str | None:
        try:
            return SiteSettings.load().user_throttle_rate
        except Exception as e:
            logger.error(f"Error loading user throttle rate from SiteSettings: {e}")
            return "1000/hour"


class LoginRateThrottle(AnonRateThrottle):
    """
    Dedicated throttle for login/token endpoints.
    Separated from the global dynamic anon throttle so that API abuse
    cannot accidentally lock users out of authentication.
    Rate is configurable via the LOGIN_THROTTLE_RATE environment variable.
    """
    scope = "login"

    def get_rate(self) -> str | None:
        from django.conf import settings
        return getattr(settings, "LOGIN_THROTTLE_RATE", "100/minute")

    def get_cache_key(self, request, view) -> str:
        # Use a distinct cache key so login attempts do not share the bucket
        # with the global anonymous API throttle.
        return f"throttle_{self.scope}_{self.get_ident(request)}"
