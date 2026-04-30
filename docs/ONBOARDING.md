# Omni-Calendar — 5-Minute Onboarding

> Get the full stack running locally or in Docker.

---

## Prerequisites

- Python 3.12+
- Node.js 20+ and npm
- Docker Desktop (optional, for production-like environment)

---

## Quick Start: Development (Windows + SQLite)

### 1. Clone & Enter

```powershell
cd C:\Users\EDEMNUSHIW\Desktop\SIAE
```

### 2. Backend Bootstrap

```powershell
# Create venv if missing
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install deps
pip install -r requirements.txt

# Migrate and create superuser
python manage.py migrate
python manage.py createsuperuser

# Run dev server
python manage.py runserver
```

Backend now serves at `http://127.0.0.1:8000/api`.

### 3. Frontend Bootstrap

Open a **second** terminal:

```powershell
cd C:\Users\EDEMNUSHIW\Desktop\SIAE\omni-calendar-ui
npm install
npm run dev
```

Frontend now serves at `http://localhost:5173`.

---

## Docker Quick Start (Production-like)

```powershell
cd C:\Users\EDEMNUSHIW\Desktop\SIAE
docker-compose up --build
```

- API: `http://localhost:8000/api`
- PostgreSQL 16: `localhost:5432`

---

## Default Roles

| Role | Purpose |
|---|---|
| `Admin` | Full global CRUD via Django admin |
| `Manager` | Super-tenant CRUD, bypasses client association |
| `SIAE` | Client-domain user; manages client-side shifts |
| `ENG` | Consultant-domain user; manages consultant-side shifts |
| `CR` | Read-only; sees calendar and vacations but cannot mutate |

---

## First-Time Setup Checklist

- [ ] Run `python manage.py migrate`
- [ ] Create at least one `Technology` via admin or API
- [ ] Create users with roles `SIAE` and `ENG`
- [ ] Assign technologies to users via `UserTechnology`
- [ ] Log in at `http://localhost:5173`

---

## Frontend Architecture

### State Management

- **ShiftStore** (`src/stores/shiftStore.ts`) — Zustand store for local UI state:
  - `selectedDate: Date | null` — Currently selected day (opens DayDrawer)
  - `activeMonth: Date` — Current calendar month view
  - `activeTechnology: number | null` — Optional technology filter
  - Actions: `setSelectedDate`, `setActiveMonth`, `setActiveTechnology`, `nextMonth()`, `prevMonth()`

- **React Query** — Handles all server-side data fetching and caching:
  - Key patterns: `["shifts", "month", start, end]`, `["vacations", "month", start, end]`, `["shifts", "date", dateStr]`
  - Mutations invalidate relevant query keys to trigger re-fetches

- **SiteSettingsContext** (`src/contexts/SiteSettingsContext.tsx`) — Global context for dynamic branding:
  - Fetches public settings (brand name, role labels) on load
  - Automatically updates the browser tab title

### Data Flow

```
CalendarMonthView (custom CSS grid)
  ↓ click day
ShiftStore.selectedDate = date
  ↓ reactive
DayDrawer (Sheet floating panel)
  ↓ mutate
React Query mutation → api.patch/post/delete
  ↓ onSuccess
Query invalidation → CalendarMonthView re-renders
```

### Component Map

| Component | Responsibility |
|---|---|
| `CalendarMonthView` | Custom 7-column month grid; renders `CalendarCell` per day |
| `CalendarCell` | Aspect-square day cell; 2px color strips for shifts; 4px red left-border for vacations |
| `DayDrawer` | Floating Sheet panel (420px, rounded-2xl, backdrop-blur); two-column SIAE/ENG layout |
| `ShiftColumn` | Reusable column for a role filter; renders `UserCard` per assignment |
| `UserCard` | Assignment card with vacation highlight, standby badge, phone link |
| `AddAssignmentDialog` / `CreateShiftDialog` | Modal forms for mutations |
| `AdminDashboard` | Tabbed admin shell with pill-style navigation |
| `UsersTab` | User CRUD with inline table and edit Sheet |

### Key Files for New Engineers

- `src/stores/shiftStore.ts` — Calendar UI state
- `src/pages/CalendarDashboard.tsx` — Month data fetching and grid wiring
- `src/components/CalendarMonthView.tsx` — Grid renderer
- `src/components/DayDrawer.tsx` — Detail panel
- `src/lib/utils.ts` — `cn()`, `getDisplayName()`, `getApiErrorMessage()`

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `CORS error` | Ensure `CORS_ALLOWED_ORIGINS` includes `http://localhost:5173` |
| `JWT expired` | Token lifetime is 60 minutes; refresh or re-login |
| `No shifts visible` | Create a Technology first, then create a Shift for a date |
| `Primary standby collision` | Only one `PRIMARY` standby is allowed per shift per day |
