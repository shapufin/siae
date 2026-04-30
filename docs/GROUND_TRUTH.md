# Omni-Calendar — Ground Truth

> The single source of architectural truth for the Omni-Calendar Resource Orchestrator.

---

## 1. Project DNA

| Attribute | Value |
|---|---|
| **Purpose** | Multi-tenant shift and vacation orchestrator for SIAE (Client) and ENG (Consultant) domains |
| **Stack** | Django 6 + DRF backend; React 18 + Vite + TypeScript + Tailwind CSS frontend |
| **Calendar Engine** | Custom CSS Grid month view (7-column, Mon-Sun) with `date-fns` — no external calendar library |
| **State Management** | Zustand (`ShiftStore`) for local UI state (selectedDate, activeMonth, activeTechnology); TanStack Query for server sync with optimistic mutations |
| **Auth** | JWT via djangorestframework-simplejwt; RBAC with Admin, Manager, ENG, SIAE, CR roles |
| **DB** | SQLite (dev), PostgreSQL 16 (production via Docker) |

---

## 2. Agent Roster & Ownership

| Agent | Domain | Color | Files Owned |
|---|---|---|---|
| **Backend Architect** | Models, Serializers, Views, Migrations | `#3b82f6` | `calendar_app/models.py`, `serializers.py`, `views.py` |
| **Database Optimizer** | Indexes, Query Plans, N+1 Prevention | `#10b981` | `calendar_app/models.py` (Meta.indexes), `views.py` (Prefetch/SelectRelated) |
| **Frontend Developer** | React Components, Hooks, API Integration | `#f59e0b` | `omni-calendar-ui/src/**/*.tsx` |
| **UI Designer** | Visual Design System, Component Library | `#8b5cf6` | `omni-calendar-ui/src/style.css`, `tailwind.config.js`, `components/ui/*` |
| **Security Engineer** | RBAC, Validation, Password Policy | `#ef4444` | `calendar_app/permissions.py`, `settings.py` (AUTH_PASSWORD_VALIDATORS) |
| **DevOps Automator** | Docker, Compose, Infrastructure | `#06b6d4` | `Dockerfile`, `docker-compose.yml`, `requirements.txt` |
| **Technical Writer** | Documentation, Onboarding, Changelog | `#64748b` | `GROUND_TRUTH.md`, `API_SPEC.md`, `ONBOARDING.md`, `CHANGELOG.md` |

---

## 3. Architecture Decisions

### 3.1 Aggregate Root: Shift
The `Shift` model is the central orchestrator. All assignments and standby details attach to a `Shift` instance, which is uniquely constrained on `(date, technology)`. This prevents temporal fragmentation.
- **Ownership**: Each `Shift` tracks its creator (`created_by`), enabling domain-specific visibility for empty shifts (e.g., an ENG manager adding a technology placeholder only shows it in the ENG column until assignments are added).

### 3.2 Vacation Calculation
Vacation status is calculated via an `Exists` subquery annotated onto user querysets:

```python
User.objects.annotate(
    vacation_status=Exists(
        Vacation.objects.filter(
            user=OuterRef("pk"),
            start_date__lte=date,
            end_date__gte=date,
        )
    )
)
```

This eliminates $N+1$ degradation when serializing assignment lists.

### 3.3 Frontend Optimistic UI
Assignments are optimistically injected into the TanStack Query cache before the API confirms. On error (e.g., PRIMARY standby collision), the previous cache state is restored automatically via `onError` rollback.

### 3.4 Sidebar Layout & Density Orchestration
The `DayDrawer` provides two optional layouts to manage high-density resource orchestration:
- **Stacked View (Default)**: A hierarchical accordion pattern where each technology card is collapsible. Cards start collapsed by default unless they contain assignments and are the only visible technology.
- **Tabbed View**: A horizontal switcher within each technology card that swaps between "Work Hours" and "Standby" in the same vertical container, maximizing space efficiency.
- **Global Toggle**: Users can switch between these modes via a persistent toggle in the sidebar header. Preferences are saved to `localStorage`.
- **Lifecycle Management**: Managers and admins can create, update notes, and delete entire shifts (including nested assignments) directly from the Admin Dashboard or Day sidebar.
- **Modern Strip Design**: `UserCard` components use a horizontal strip layout in the sidebar to ensure full-text semantic labels (AVAILABLE, VACATION, etc.) and complete user names are visible without truncation.
- **Mobile Optimized**: The sidebar and main navigation automatically adapt to smaller viewports with responsive widths, scrollable navigation, and adjusted grid densities.

### 3.5 Environment Switching
`ENV_MODE` controls the database backend. `development` → SQLite, `production` → PostgreSQL. This is handled entirely in `settings.py` with zero runtime branching in application code.

### 3.6 Dynamic Branding
The application brand name and role labels (Client/Consultant) are managed via `SiteSettings`. The frontend dynamically updates the browser tab title and UI labels based on these settings fetched via `/api/settings/public/`.

### 3.7 SMTP & Diagnostics
SMTP configuration is stored in the database with encrypted passwords. Admins can verify connectivity via a "Send Test Email" feature in the settings panel.

---

## 4. Boot Sequence

1. `docker-compose up --build` (production target)
2. Or `python manage.py migrate && python manage.py runserver` (dev)
3. `cd omni-calendar-ui && npm run dev` (frontend dev server)

---

## 5. Change Log Anchor

See `CHANGELOG.md` for versioned history. All commits follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`).
