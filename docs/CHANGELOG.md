# Changelog

All notable changes to this project will be documented in this file. This project adheres to [Conventional Commits](https://www.conventionalcommits.org/).

---

## [1.2.0] — 2026-04-26

### feat
- **frontend**: introduce optional Tabbed View in sidebar for even higher density (Work Hours vs Standby)
- **frontend**: implement global layout toggle in sidebar (Stacked vs Tabbed) with localStorage persistence
- **frontend**: fix accordion logic in sidebar to ensure manual toggles override default behaviors
- **frontend**: implement accordion-style collapsible technology cards in day sidebar to eliminate vertical bloat
- **frontend**: add "Expand All" / "Collapse All" bulk actions for rapid sidebar navigation
- **frontend**: introduce "Modern Strip" UserCard design with full-text status labels and prominent CR actions
- **frontend**: add assignment count badges to technology headers for instant activity visibility
- **frontend**: implement side-by-side layout for Work Hours and Standby in day sidebar to reduce vertical bloat
- **frontend**: add "Standby Ready" summary badge on calendar cells for quick status visibility
- **frontend**: enhance calendar cell hover effects with smooth transitions and elevation
- **frontend**: refine sidebar clutter with compact horizontal `UserCard` layout and tighter vertical spacing
- **frontend**: increase sidebar width to 800px and rename labels for better readability
- **frontend**: implement delete option for shifts in admin dashboard for managers and admins
- **frontend**: improve mobile responsiveness with sticky header, scrollable nav, and optimized calendar cell heights
- **backend**: add `created_by` field to `Shift` model for domain-specific ownership tracking
- **backend**: add `has_standby` annotation to shift API endpoints
- **backend**: implement auto-population of work hours for all assigned users when creating a technology shift

### fix
- **frontend**: refine color scales for PRIMARY (emerald) and BACKUP (sky) roles for better distinction
- **frontend**: improve contrast for "Available" and "Vacation" status badges to meet accessibility standards
- **frontend**: restrict visibility of empty technology shifts to their respective domain columns
- **frontend**: update "Add User" button visibility to include Admin, Superuser, and CR roles

## [1.1.0] — 2026-04-26

### feat
- **backend**: implement automated regression tests for primary standby uniqueness and vacation date validation
- **backend**: harden `settings.py` environment variable parsing (specifically `EMAIL_PORT`)
- **docs**: create comprehensive `ARCHITECTURE.md` and `README.md`, update `API_SPEC.md`

### fix
- **frontend**: resolve critical date mutation bug in `CalendarDashboard.tsx` where iterating over a date range mutated original state
- **frontend**: fix broken literal unions in `types/index.ts` by removing open-ended `| string` overrides
- **backend**: replace deprecated `unique_together` with modern `UniqueConstraint` in all models
- **backend**: eliminate N+1 query in `VacationViewSet` by adding `select_related("user")`
- **backend**: fix local `slugify` import in `Technology` model to improve startup performance

### refactor
- **frontend**: simplify redundant `isManager` checks in `DayDrawer.tsx`
- **backend**: debloat `permissions.py` by removing unused `IsAdmin`, `IsManager`, and `ReadOnlyForCR` classes
- **backend**: merge shared logic into `CanManageAssignment` for better maintainability

## [1.0.0] — 2026-04-25

### feat

- **backend**: introduce aggregate root schema (`Technology`, `Shift`, `Assignment`, `StandbyDetail`) with unique constraints and model-level validation
- **backend**: add `CustomUser` with role-based fields (`CR`, `SIAE`, `ENG`) and `UserTechnology` through-model
- **backend**: implement `Vacation` model with date-range indexing and overlap detection
- **backend**: add RBAC permission matrix (`IsAdmin`, `IsManager`, `RoleBasedPermission`, `CanEditShift`, `CanManageAssignment`, `ReadOnlyForCR`)
- **backend**: implement JWT authentication via `djangorestframework-simplejwt`
- **backend**: add `ENV_MODE`-driven database switching (SQLite dev / PostgreSQL prod)
- **backend**: enforce password complexity via `AUTH_PASSWORD_VALIDATORS` (min length 12)
- **frontend**: build calendar dashboard with FullCalendar `dayGridMonth`, custom `dayCellContent` for shift dots and vacation badges
- **frontend**: implement shadcn/ui `Sheet` slide-over for day detail view (SIAE / ENG two-column layout)
- **frontend**: add `DayDrawer` with nested technology cards and user chips, vacation-aware red styling
- **frontend**: integrate TanStack Query with cache keys `["shifts", "month", ...]` and `["shifts", "date", ...]`
- **frontend**: implement optimistic mutations for assignment create/delete with `onMutate` injection and `onError` rollback
- **frontend**: add `NotificationBadge` with ENG vacation count and hover list for current week
- **frontend**: add `VacationHub` with admin override (create vacations for other users)
- **devops**: add `Dockerfile` with Gunicorn and static collection
- **devops**: add `docker-compose.yml` with PostgreSQL 16 healthchecks
- **devops**: add `requirements.txt` with pinned major versions
- **docs**: add `GROUND_TRUTH.md`, `API_SPEC.md`, `ONBOARDING.md`, `CHANGELOG.md`

### fix

- **backend**: resolve $N+1$ vacation status query by replacing per-instance `exists()` with `Exists` subquery annotation on user querysets
- **backend**: fix `ShiftViewSet.list` to return full `ShiftSerializer` (with assignments) when `?date=` parameter is present
- **backend**: add `Prefetch` hydration for `assignments → user → standby_detail` in date-filtered shift queries
- **frontend**: replace hand-rolled drawer markup with accessible shadcn/ui `Sheet` using Radix Dialog primitives
- **frontend**: map serializer field-level errors to specific toast messages with resolution steps

### refactor

- **frontend**: extract reusable `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` components in `components/ui/sheet.tsx`
- **frontend**: adopt `tailwindcss-animate` for standardized enter/exit transitions
