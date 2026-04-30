# Omni-Calendar — API Specification (OpenAPI 3.1 Draft)

> Base URL: `http://localhost:8000/api`
> Authentication: JWT Bearer token in `Authorization` header

---

## 1. Authentication

### POST `/auth/token/`
Obtain access and refresh tokens.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "refresh": "<refresh_token>",
  "access": "<access_token>"
}
```

### POST `/auth/token/refresh/`
Refresh an expired access token.

**Request Body:**
```json
{
  "refresh": "<refresh_token>"
}
```

---

## 2. Users

### GET `/users/`
List all users. Supports pagination (`?page=1&page_size=50`). **Managers only see users from their own domain.**

**Response:**
```json
{
  "count": 10,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "username": "jdoe",
      "email": "jdoe@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "ENG",
      "phone_number": "+39 123 456 7890",
      "technologies": [{ "technology": { "id": 1, "name": "LINUX", "slug": "linux", "color_code": "#3b82f6", "role": "ENG" }, "is_default": true }],
      "vacation_status": null
    }
  ]
}
```

### GET `/users/me/`
Return the currently authenticated user with expanded permission flags.

**Response:**
```json
{
  "id": 1,
  "username": "jdoe",
  "email": "jdoe@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "ENG",
  "phone_number": "+39 123 456 7890",
  "is_staff": false,
  "is_superuser": false,
  "permissions": {
    "is_admin": false,
    "is_manager": false,
    "is_read_only": false,
    "is_siae": false,
    "is_eng": true
  }
}
```

### GET `/users/by_technology/?technology=<id>`
Filter users assigned to a specific technology. **Managers only see users from their own domain.**

---

## 3. Technologies

### GET `/technologies/`
List all technologies. **Managers only see technologies from their own domain.**

**Response:**
```json
[
  { "id": 1, "name": "LINUX", "slug": "linux", "color_code": "#3b82f6", "role": "ENG" }
]
```

### GET `/technologies/:slug/`
Retrieve a single technology by slug.

---

## 4. Vacations

### GET `/vacations/`
List vacations. Admin/CR see all; Managers see their domain; others see own.

**Query Parameters:**
- `start_date__lte` — filter by overlapping start
- `end_date__gte` — filter by overlapping end
- `page`, `page_size` — pagination

**Response:**
```json
{
  "count": 5,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "user": { "id": 1, "username": "jdoe", ... },
      "start_date": "2026-04-01",
      "end_date": "2026-04-10",
      "notes": "Summer break",
      "created_at": "2026-03-15T10:00:00Z"
    }
  ]
}
```

### POST `/vacations/`
Create a vacation entry.

**Request Body:**
```json
{
  "user_id": 1,
  "start_date": "2026-04-01",
  "end_date": "2026-04-10",
  "notes": "Summer break"
}
```

### POST `/vacations/overlapping/`
Find vacations that overlap a date range.

**Request Body:**
```json
{
  "start_date": "2026-04-01",
  "end_date": "2026-04-30",
  "user_ids": [1, 2]
}
```

### GET `/vacations/current_week/`
Return vacations intersecting the current calendar week.

---

## 5. Shifts (Aggregate Root)

### GET `/shifts/`
List shifts. **Dashboard view (month/year) is shared across domains.**

**Query Parameters:**
- `date=YYYY-MM-DD` — returns full Shift objects with assignments. **Managers see all, but can only edit their own.**
- `date__gte` + `date__lte` — returns `ShiftSummary` list (month range, no assignments)
- `month=4&year=2026` — month filter
- `technology=<id>` — filter by technology
- `page`, `page_size` — pagination

**ShiftSummary Response** (list without `date`):
```json
{
  "count": 30,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "date": "2026-04-15",
      "technology": { "id": 1, "name": "LINUX", "slug": "linux", "color_code": "#3b82f6" },
      "assignment_count": 3,
      "notes": ""
    }
  ]
}
```

**Shift Detail Response** (with `date` param):
```json
[
  {
    "id": 1,
    "date": "2026-04-15",
    "technology": { "id": 1, "name": "LINUX", "slug": "linux", "color_code": "#3b82f6" },
    "notes": "",
    "assignments": [
      {
        "id": 10,
        "user": { "id": 1, "username": "jdoe", "role": "ENG", "vacation_status": false },
        "type": "STANDBY",
        "standby_detail": { "role": "PRIMARY", "phone_number": "+39 123 456 7890" }
      }
    ],
    "created_at": "2026-04-01T08:00:00Z",
    "updated_at": "2026-04-01T08:00:00Z"
  }
]
```

### POST `/shifts/`
Create a new shift.

**Request Body:**
```json
{
  "technology_id": 1,
  "date": "2026-04-15",
  "notes": ""
}
```

### GET `/shifts/:id/assignments/`
List assignments for a specific shift.

---

## 6. Assignments

### GET `/assignments/`
List assignments.

**Query Parameters:**
- `shift=<id>` — filter by shift
- `user=<id>` — filter by user

### POST `/assignments/`
Create a base assignment.

**Request Body:**
```json
{
  "shift": 1,
  "user_id": 1,
  "type": "STANDBY"
}
```

---

## 7. Standby Details

### POST `/standby-details/`
Create standby details for a `STANDBY` assignment.

**Request Body:**
```json
{
  "assignment": 10,
  "role": "PRIMARY",
  "phone_number": "+39 123 456 7890"
}
```

### GET `/standby-details/`
List all standby detail records.

### PATCH `/standby-details/:id/`
Update role or phone number.

---

## 8. Notifications

### GET `/notifications/badge/`
Return the count of ENG vacations overlapping the current week.

**Response:**
```json
{
  "count": 2,
  "vacations": [
    { "id": 1, "user": { ... }, "start_date": "2026-04-01", "end_date": "2026-04-10" }
  ]
}
```

---

## 9. Default Crew

### GET `/default-crew/:id/`
Return a technology with its default crew users.

**Response:**
```json
{
  "id": 1,
  "name": "LINUX",
  "slug": "linux",
  "color_code": "#3b82f6",
  "users": [ { "id": 1, "username": "jdoe", ... } ]
}
```

---

## 10. Shifts by Date & Technology

---

## 11. Site Settings

### GET `/settings/`
Retrieve global application configuration (Admin only).

### PUT `/settings/`
Update global application configuration (Admin only).

### POST `/settings/test-email/`
Send a test email to the current user's email address to verify SMTP settings.

### GET `/settings/public/`
Retrieve public site settings (brand name, role labels). No authentication required.
