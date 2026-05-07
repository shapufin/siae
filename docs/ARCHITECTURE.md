# Omni-Calendar Architecture

## 🏛️ System Overview

Omni-Calendar is a multi-tenant resource orchestration platform designed to manage shifts, standby assignments, and vacations across two primary domains: **SIAE (Client)** and **ENG (Consultant)**.

## 🧱 Layered Architecture

### 1. Backend (Django + DRF)
- **Persistence**: Django Models with strict constraints.
- **Business Logic**: Centralized in ViewSets and custom Permission classes.
- **API**: RESTful interface using Django REST Framework.
- **Auth**: JWT-based authentication with role-based access control (RBAC).

### 2. Frontend (React + TypeScript)
- **State Management**: 
  - `Zustand`: Global UI state (selected date, active month).
  - `TanStack Query`: Server state synchronization, caching, and optimistic UI updates.
- **Components**: Functional React components using Radix UI primitives for accessible primitives.
- **Styling**: Tailwind CSS for utility-first responsive design.

## 🗄️ Data Model

### Aggregate Root: `Shift`
The `Shift` model (date + technology) serves as the primary container for orchestration.
- `Assignment`: Links a `User` to a `Shift`.
- `StandbyDetail`: Extended metadata for standby assignments (Primary/Backup role, phone number).

### User & Domain Management
- `CustomUser`: Extended Django user with `role` (Admin, Manager, SIAE, ENG, CR).
- `Technology`: Categorizes shifts and assignments. Includes a `role` field for hard domain separation.
- `UserTechnology`: Links users to technologies with a `is_default` flag for auto-population.

## 🔐 Security Model (RBAC & Domain Isolation)

Access control is enforced at both the API level (Django Permissions) and UI level (AuthContext flags).

| Role | Domain Scope | Permissions |
|---|---|---|
| **Admin** | Global | Full CRUD on all resources. |
| **Manager** | Domain-specific | Management of users, technologies, and assignments within their own domain (SIAE or ENG). **Hard isolation**: Managers only see/assign users and technologies from their own domain in management interfaces, but can view both domains on the shared dashboard. |
| **SIAE/ENG** | Personal | View calendar, manage own vacations/assignments. |
| **CR** | Global | Read-only access to all orchestration data across both domains. |

## 🚀 Performance Strategies

1. **N+1 Prevention**: Extensive use of `select_related` and `prefetch_related` in Django ViewSets.
2. **Subquery Annotation**: Vacation status is calculated via `Exists` subqueries to avoid per-row database hits.
3. **Optimistic UI**: Frontend updates immediately on user action, rolling back only on server failure to maintain perceived performance.
4. **Debounced Search**: Technology and user searches are debounced to reduce API pressure.

## � Email Integration

The application features a flexible email notification system managed via the `SiteSettings` singleton.

1. **Dual Backend Support**: Supports external SMTP (with Fernet-encrypted credentials) and local Postfix (MTA relay).
2. **Encryption at Rest**: SMTP passwords are encrypted using `cryptography.fernet` before storage in the database.
3. **Infrastructure Mapping**: Docker containers use `host.docker.internal` to reach the host's Postfix service.
4. **Trigger Points**: Notifications are triggered by vacation changes and shift assignment updates.

## �🛠️ Infrastructure

- **Dockerized Environment**: Consistent dev/prod parity.
- **Environment Driven**: `ENV_MODE` toggles between SQLite (Dev) and PostgreSQL (Prod).
