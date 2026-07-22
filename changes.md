# Changes Log

## 2026-07-06 - Vacation Hub Manager Diagnostics and Visibility Hardening

### Confirmed Diagnosis
- The local database contains an ENG vacation and the `siae` account is a SIAE user in the `Manager` group.
- An authenticated request as that account to `/api/vacations/?all=true` returns the ENG vacation with HTTP 200.
- Therefore, the current checkout's backend manager path is working. If the deployed page remains empty, the deployed frontend/backend build or the deployed account's `Manager` group differs from the local checkout.

### Backend Changes

#### `calendar_app/views.py`
- Restricted the `all=true` shared-list override so it cannot grant a regular user access to all vacations.
- Admins, managers, and CR users continue to receive all vacations.
- Regular users continue to receive only their own vacations, even if they send `?all=true`.

### Frontend Changes

#### `omni-calendar-ui/src/pages/VacationHub.tsx`
- Requests the shared vacation endpoint with `?all=true`; the backend now enforces whether that scope is allowed.
- Added explicit API error rendering and a retry button so a failed request is no longer displayed as a misleading empty list.
- Added a scope-specific query key to avoid mixing manager and regular-user responses.

### Verification
- Local `siae` manager: `is_manager=True`, group `Manager`, `/api/vacations/?all=true` returned the ENG vacation ✅
- `python manage.py check` ✅ (existing model primary-key warnings only)
- `python manage.py test calendar_app.tests.test_api` ✅ (10/10)
- `npm run build` ✅

### Deployment Requirement
- Rebuild/redeploy both backend and frontend, then log out and back in as the manager. The manager account must show `permissions.is_manager=true` from `/api/users/me/` and must belong to the exact Django group `Manager`.

## 2026-07-06 - Fix Vacation Hub Missing Vacations

### Context
- User reported that vacations were not showing in the Vacation Hub list page, even though they appeared in notifications and shift views.
- Suspected pagination or a per-page limit.

### Root Cause
1. **Pagination**: `VacationViewSet` had `pagination_class = FlexiblePageNumberPagination` added in commit `1305130`. Global `PAGE_SIZE` is `50`, so `/vacations/` was returning only the 50 newest vacations. `VacationHub.tsx` calls `/vacations/` with no `page_size`, so any vacation beyond the first 50 was hidden. `ShiftsTab.tsx` already avoided this by passing `page_size=1000`, which is why vacations appeared correctly in shift/calendar views.
2. **Manager visibility**: `VacationHub.tsx` labels the list as "All Vacations" for managers, but the backend was filtering managers to see only vacations of users with the same role. For an SIAE manager with no SIAE vacations (but with ENG vacations visible in notifications), the page appeared empty.
3. **Frontend cache**: `VacationHub.tsx` used the default `staleTime` of 5 minutes from `QueryClient`. If the page had been loaded before the manager role was assigned or before the backend fix was deployed, the empty result stayed cached for 5 minutes, making the page appear empty even though the backend was now correct.

### Backend Changes

#### `calendar_app/views.py`
- Removed `pagination_class = FlexiblePageNumberPagination` from `VacationViewSet`.
- `VacationViewSet` now returns the full, flat list of vacations again, matching the pre-`1305130` behavior.
- Changed `get_queryset` so managers (like admins and CR users) see **all** vacations, matching the "All Vacations" UI label. Regular users still see only their own vacations.
- `ShiftViewSet` pagination was left unchanged because `ShiftsTab.tsx` already requests `page_size=1000`.

### Frontend Changes

#### `omni-calendar-ui/src/pages/VacationHub.tsx`
- Switched the vacations query key to `queryKeys.vacations.all` so it matches the invalidation keys used by `useVacationMutations`.
- Set `staleTime: 0` so the vacation list always refetches when the user navigates to the page or returns to the browser tab, preventing stale empty results.

### Verification
- `python manage.py check` ✅
- `python manage.py test` ✅ (all tests, including the pre-existing failure)
- `npm run build` ✅

## 2026-07-06 - Remove Login Throttle & Enable Multi-Session Login

### Context
- User decided to remove the login throttle completely because the app runs on a private network.
- User also requested that the same user be allowed to log in from multiple sessions (browsers/tabs) simultaneously without one session invalidating another.
- Working tree was restored to the last committed state (`HEAD`, commit `84348ec`) before making changes because several files had been corrupted and contained syntax errors.

### Backend Changes

#### `calendar_app/throttling.py`
- Removed `LoginRateThrottle` class entirely.
- Kept `DynamicAnonRateThrottle` and `DynamicUserRateThrottle` for general API endpoints.

#### `calendar_app/urls.py`
- Replaced `TokenObtainPairThrottledView` / `TokenRefreshThrottledView` with `UnthrottledTokenObtainPairView` / `UnthrottledTokenRefreshView`.
- Set `throttle_classes = []` on both token views so login and refresh are not throttled.
- Kept the global `DEFAULT_THROTTLE_CLASSES` away from the token endpoints, preventing the `100/day` anonymous throttle from locking users out.

#### `omni_calendar/settings.py`
- Removed `LOGIN_THROTTLE_RATE` setting and env var lookup.
- Changed `SIMPLE_JWT["ROTATE_REFRESH_TOKENS"]` from `True` to `False` so that refreshing an access token does not invalidate the refresh token, allowing multiple simultaneous sessions for the same user.

#### `.env.example`
- Removed `LOGIN_THROTTLE_RATE` documentation.

#### `calendar_app/tests/test_api.py`
- Removed `APIRequestFactory` and `LoginRateThrottle` imports.
- Removed throttle-specific tests.
- Added `test_login_endpoints_are_not_throttled` to verify that repeated login attempts succeed without throttling.

### Frontend Changes

#### `omni-calendar-ui/src/pages/Login.tsx`
- Removed the 429-specific error message since login no longer returns `429`.
- Generic "Invalid username or password" message remains.

### Security Note
- This removes brute-force protection on the login endpoint. Acceptable only because the app runs on a trusted private network.
- Refresh tokens are no longer rotated, so a leaked refresh token can be reused until expiry. Mitigated by the private-network assumption.

### Verification
- `python manage.py check` ✅
- `python manage.py test calendar_app.tests.test_api` ✅ (7/7)
- `python manage.py test` ⚠️ 1 pre-existing failure (`test_siae_user_can_create_shift`) — unrelated.
- `npm run build` ✅

## 2026-05-07 - Settings Persistence Bug Fix

### Backend Changes

#### `calendar_app/serializers.py`
- **Line 621**: Added `from django.core.cache import cache` import
- **Line 637**: Added `cache.delete("site_settings")` after `instance.save()` in `SiteSettingsSerializer.update()`
- **Purpose**: Explicit cache invalidation to ensure settings persist after save
- **Interlinks**: Depends on `calendar_app/models.py` SiteSettings model's cache key "site_settings"

### Frontend Changes

#### `omni-calendar-ui/src/pages/admin/SettingsTab.tsx`
- **Line 1**: Added `useEffect` to React imports: `import { useState, useEffect, useRef } from "react"`
- **Line 85-89**: Changed `useState(() => {...})` to `useEffect(() => {...}, [data])` for form sync
- **Purpose**: Fix form not updating when API data changes after save/refresh
- **Interlinks**: Uses `queryKeys.settings.all` from query invalidation on line 97-98

#### `omni-calendar-ui/src/contexts/SiteSettingsContext.tsx`
- **Line 24**: Changed `staleTime` from `1000 * 60 * 60` (1 hour) to `0`
- **Purpose**: Ensure fresh settings are always fetched, not cached for 1 hour
- **Interlinks**: Provides context to entire app via `SiteSettingsContext.Provider` on line 37

## 2026-05-07 - User Management Enhancements

### Backend Changes

#### `calendar_app/permissions.py`
- **Line 128-141**: Updated `IsOwnerOrSuperUser` to include domain-based access for managers.
- **Purpose**: Allow managers to reset passwords for users within their managed domain.

#### `calendar_app/views.py`
- **Line 28**: Added `IsOwnerOrSuperUser` to imports.
- **Line 216-223**: Updated `set_password` action to use `IsOwnerOrSuperUser` and removed explicit superuser check.
- **Purpose**: Enable manager self-service and domain-level password resets.

### Frontend Changes

#### `omni-calendar-ui/src/components/UserCard.tsx`
- **Line 104-154**: Refactored `compact` mode layout to a stacked flex-column structure with "coefficient" labels (small text above the name).
- **Purpose**: Restores full descriptive labels (PRIMARY, BACKUP, AVAILABLE, VACATION) in a tiny footprint, preventing horizontal overcrowding while maintaining high visibility.

#### `omni-calendar-ui/src/pages/admin/UsersTab.tsx`
- **Line 3**: Added `RefreshCw`, `Eye`, `EyeOff` to Lucide icons.
- **Line 340**: Added "Default Tech" header to user table.
- **Line 391-408**: Added table cell to display default tech badge with color-coding from technology settings.
- **Line 482**: Updated password reset button visibility to allow managers to reset passwords for users in their domain.
- **Line 30-45**: Added `generateSecurePassword` function for user creation.
- **Line 233-266**: Added "Generate" button and visibility toggle to password field in user creation form.
- **Line 757-774**: Added `generateSecurePassword` and visibility state to `PasswordResetDialog`.
- **Line 796-826**: Added password generation and visibility toggle to password reset dialog.
- **Purpose**: Enhanced visual clarity for default technologies, improved usability for standby user cards, and expanded password management capabilities.

## 2026-05-07 - Dual Email Backend Support (SMTP + Postfix)

### Backend Changes

#### `calendar_app/models.py`
- Added `email_backend` field to `SiteSettings` with 'smtp' and 'postfix' choices.
- Added `postfix_host` and `postfix_port` fields for local Postfix configuration.
- Preserved all existing SMTP fields for backward compatibility.

#### `calendar_app/email.py`
- Updated `send_smtp_email()` to support conditional routing based on the selected backend.
- Added logic for local Postfix relay via `host.docker.internal:25` with no authentication.

#### `calendar_app/serializers.py`
- Updated `SiteSettingsSerializer` to include the new email configuration fields.

#### `calendar_app/views.py`
- Enhanced `TestEmailView` to indicate which backend (SMTP or Postfix) was used in the test result message.

### Frontend Changes

#### `omni-calendar-ui/src/pages/admin/SettingsTab.tsx`
- Refactored the SMTP section into an "Email Configuration" section.
- Added a dropdown selector for the active backend.
- Implemented conditional rendering to show/hide fields based on the selected backend (SMTP vs Postfix).
- Updated `SettingsData` interface and `DEFAULT_SETTINGS`.

#### `omni-calendar-ui/src/types/index.ts`
- Updated `SiteSettings` interface to include the new fields.

### Infrastructure Changes

#### `docker-compose.yml`
- Added `extra_hosts` to the `web` service mapping `host.docker.internal` to `host-gateway` to allow container-to-host Postfix communication.

#### `.env.example`
- Updated documentation for email settings to reflect dual backend choice.

### Documentation Changes
- `docs/SMTP_DOCKER_SETUP.md`: Added Postfix configuration guide and Docker networking section.
- `docs/ARCHITECTURE.md`: Added "Email Integration" section describing the dual backend strategy.
- `docs/GROUND_TRUTH.md`: Updated section 3.7 to reflect dual backend support.
- `README.md`: Clarified `DJANGO_FERNET_KEY` requirement for SMTP.

## 2026-05-07 - Client Email Notification System

### Backend Changes

#### `calendar_app/models.py`
- Added `client_email` field to `SiteSettings` for global vacation notifications.

#### `calendar_app/email_templates.py`
- Created `render_vacation_notification_html()` to provide a professional HTML template for client emails.

#### `calendar_app/services.py`
- Updated `NotificationService.send_vacation_notification()` to send beautiful HTML emails to the client when ENG users schedule vacations.

#### `calendar_app/email.py`
- Added `backend_override` parameter to `send_smtp_email()` to support explicit backend testing.

#### `calendar_app/views.py`
- Enhanced `TestEmailView` to support `backend` override from request data.

### Frontend Changes

#### `omni-calendar-ui/src/types/index.ts`
- Added `client_email` to `SiteSettings` interface.

#### `omni-calendar-ui/src/pages/admin/SettingsTab.tsx`
- Added "Client Email" configuration field.
- Added "Test Postfix" button to explicitly test local relay regardless of active backend.
- Updated `testEmailMutation` to handle backend overrides.

## 2026-05-07 - Postfix Fix and Custom Email Templates

### Infrastructure Fix
- Postfix: Changed `inet_interfaces` to `all`, updated `mynetworks` for Docker access.

### Backend Changes
- `calendar_app/models.py`: Added `email_template_enabled`, `email_template_subject`, `email_template_body` to SiteSettings.
- `calendar_app/email_templates.py`: Added variable substitution and custom template support.
- `calendar_app/services.py`: Client notification uses custom templates when enabled.
- `calendar_app/serializers.py`: Added template fields to serializer.

### Frontend Changes
- `omni-calendar-ui/src/types/index.ts`: Added template fields to SiteSettings interface.
- `omni-calendar-ui/src/contexts/SiteSettingsContext.tsx`: Added template fields to defaults.
- `omni-calendar-ui/src/pages/admin/SettingsTab.tsx`: Added Email Template Customization section.

## 2026-05-07 - Postfix Localhost Networking Fix

### Backend Changes

#### `calendar_app/email.py`
- Added `_get_docker_host_ip()` function to detect Docker bridge gateway IP for container-to-host communication.
- Updated `send_smtp_email()` to automatically resolve "localhost" to Docker bridge gateway (172.17.0.1) when Postfix is selected.
- Fixes connection issue where container's localhost != host's localhost.

### Frontend Changes

#### `omni-calendar-ui/src/pages/admin/SettingsTab.tsx`
- Added help text for Postfix Host field explaining "localhost" auto-resolution.

## 2026-05-08 - Vacation Notification Bug Fix

### Backend Changes

#### `calendar_app/services.py`
- Refactored `send_vacation_notification` to decouple internal and client notifications.
- Removed early `return` when internal recipients are empty, allowing client notifications to proceed.
- Added descriptive logging for both successful sends and cases where no recipients are found.
- Ensured external client notifications work independently of internal system users.

## 2026-05-08 - Email Content and Template Parsing Fix

### Backend Changes

#### `calendar_app/email.py`
- Fixed `send_smtp_email` logic to correctly use `html_body` as the primary message content when provided. Previously, it would only set the subtype to "html" but kept using the plain text `body`, leading to empty or malformed emails when only HTML was intended.

#### `calendar_app/models.py`
- Added `default_technology` property to `CustomUser` model. This ensures that the notification service can reliably retrieve the user's primary technology for template substitution, preventing "N/A" or empty values in emails.

#### `calendar_app/services.py`
- Updated `send_vacation_notification` to use the new `default_technology` property and improved variable extraction for template rendering.

#### `calendar_app/views.py`
- Updated `TestEmailView` to include a proper HTML payload, ensuring that test emails are no longer empty and accurately represent the system's email capabilities.

### Infrastructure/Configuration Requirements
- **Admin UI**: "Enable email notifications" must be toggled ON.
- **Admin UI**: "Client Email" must be populated for external notifications.
- **Admin UI**: "Notify on vacation changes" must be toggled ON.

## 2026-05-08 - Email Formatting and Deletion Logic Enhancements

### Backend Changes

#### `calendar_app/email_templates.py`
- Updated `_substitute_variables` to automatically convert newlines (`\n`) to HTML line breaks (`<br/>`). This ensures that custom templates entered in the admin textarea maintain their formatting when sent as HTML emails.
- Enhanced `render_vacation_notification_html` to accept an `action` parameter.
- Added specialized intro text for "created", "updated", and "deleted" actions in the default professional template.

#### `calendar_app/services.py`
- Updated `send_vacation_notification` to pass the `action` ("created", "updated", "deleted") to the template renderer.
- Implemented intelligent subject line handling for deletions:
  - Default: Changes "Notification" to "Deleted" in the subject.
  - Custom: Prefixes "CANCELLED: " to the subject if it's a deletion and the word "cancelled" or "deleted" isn't already present.

## Related Files
- `calendar_app/models.py` - SiteSettings model with cache logic (line 353-365)
- `calendar_app/views.py` - SiteSettingsView using SiteSettings.load() (line 673-674)
- `omni-calendar-ui/src/lib/queryKeys.ts` - Query key definitions
- `calendar_app/models.py` - CustomUser and UserTechnology models.
- `omni-calendar-ui/src/types/index.ts` - User and Technology type definitions.
- `omni-calendar-ui/src/contexts/AuthContext.tsx` - Authentication context for role/permission checks.
