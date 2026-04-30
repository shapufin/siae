# Omni-Calendar Resource Orchestrator

Multi-tenant shift and vacation management system designed for SIAE (Client) and ENG (Consultant) domain orchestration.

## 🚀 Tech Stack

- **Backend**: Django 6.0, Django REST Framework, PostgreSQL (Production) / SQLite (Dev)
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, TanStack Query, Zustand
- **Auth**: JWT (djangorestframework-simplejwt)
- **Infrastructure**: Docker, Docker Compose

## 🛠️ Getting Started

### Prerequisites
- Python 3.12+
- Node.js 20+
- Docker & Docker Compose (optional, recommended for production)

### Docker Setup (Production) — Recommended

The fastest way to get the entire stack running:

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd SIAE
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env and set a secure DJANGO_SECRET_KEY and DJANGO_FERNET_KEY
   ```

3. **Launch the stack**
   ```bash
   docker compose up --build -d
   ```

4. **Create a superuser**
   ```bash
   docker compose exec web python manage.py createsuperuser
   ```

5. **Access the application**
   - App: http://localhost
   - API: http://localhost/api/
   - Admin: http://localhost/admin/

6. **Stop the stack**
   ```bash
   docker compose down
   # To also remove the database volume:
   docker compose down -v
   ```

### Development Setup (Local)

1. **Backend Setup**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
   ```

2. **Frontend Setup**
   ```bash
   cd omni-calendar-ui
   npm install
   npm run dev
   ```
   The frontend will be available at http://localhost:5173

## 🔐 Role-Based Access Control (RBAC)

- **Admin**: Full system access, user management, and global orchestration.
- **Manager**: Domain-specific management (SIAE or ENG).
- **ENG/SIAE**: View calendar, manage own assignments and vacations.
- **CR**: Read-only access for coordination.

## 📄 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and technical decisions.
- [API_SPEC.md](./API_SPEC.md) - Detailed API endpoint documentation.
- [CHANGELOG.md](./CHANGELOG.md) - Project history and updates.
- [GROUND_TRUTH.md](./GROUND_TRUTH.md) - Core project definitions.

## 🧪 Testing

```bash
# Backend tests
python manage.py test

# Frontend type check
cd omni-calendar-ui
npm run build  # includes tsc
```
