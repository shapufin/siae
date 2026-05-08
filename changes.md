# Changes Log

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

### Infrastructure/Configuration Requirements
- **Admin UI**: "Enable email notifications" must be toggled ON.
- **Admin UI**: "Client Email" must be populated for external notifications.
- **Admin UI**: "Notify on vacation changes" must be toggled ON.

## Related Files
- `calendar_app/models.py` - SiteSettings model with cache logic (line 353-365)
- `calendar_app/views.py` - SiteSettingsView using SiteSettings.load() (line 673-674)
- `omni-calendar-ui/src/lib/queryKeys.ts` - Query key definitions
- `calendar_app/models.py` - CustomUser and UserTechnology models.
- `omni-calendar-ui/src/types/index.ts` - User and Technology type definitions.
- `omni-calendar-ui/src/contexts/AuthContext.tsx` - Authentication context for role/permission checks.
