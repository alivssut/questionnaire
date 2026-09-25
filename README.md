<div align="center">

# FORMly

**SaaS platform for building, distributing, and analyzing professional questionnaires and surveys.**

[![Backend](https://img.shields.io/badge/Backend-Django%206.1-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%2016-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%2016-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Start with Docker](#quick-start-with-docker)
  - [Manual Setup](#manual-setup)
  - [First-Time Configuration](#first-time-configuration)
- [Running the Project](#running-the-project)
  - [Day-to-Day Commands](#day-to-day-commands)
  - [Viewing Logs](#viewing-logs)
  - [Accessing Shells](#accessing-shells)
  - [Resetting the Database](#resetting-the-database)
  - [Troubleshooting](#troubleshooting)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Overview](#api-overview)
- [User Roles & Permissions](#user-roles--permissions)
- [Question Types](#question-types)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**FORMly** is a full-featured questionnaire platform designed for teams that need to create, distribute, and analyze surveys at scale. It ships with a modern admin dashboard, a builder supporting **23 different question types**, per-survey analytics, a full notification system, and role-based access control.

Whether you're running a customer satisfaction survey, an employee engagement pulse, or a market research study, FORMly gives you the tooling to launch in minutes and understand the results immediately.

---

## Features

### 🎨 Questionnaire Builder

- **23 question types** — short/long text, email, phone, URL, number, rating, linear scale, NPS, slider, single choice, multiple choice, dropdown, yes/no, Likert, ranking, date, time, datetime, matrix, file upload, text block, and section
- **Inline editing** — click any question on the canvas to edit it directly
- **System lists** — reusable option lists (countries, languages, currencies, …) managed from the admin panel
- **Live preview** — see exactly how each question will look to respondents
- **Duplicate questions** with one click
- **Reorder** via drag or arrow buttons
- **Publish workflow** — draft → published → closed → archived

### 📋 Assignment System

- Assign a survey to one or many users in a single request
- Set an optional **due date** with automatic **overdue** detection
- Toggle **allow resume** to let respondents continue later
- Track per-user progress: pending, in progress, completed, overdue

### 📝 Response Collection

- **Save draft** with autosave on navigation
- **Server-side validation** per question type (regex, range, choice membership)
- **File uploads** with drag-and-drop, progress bar, image previews, and multi-file support
- **Anonymous responses** for surveys configured as such
- **Submission lock** — prevents duplicate submissions
- **Users can review their own responses** from `/my-questionnaires` — completed assignments link straight to the response detail view

### 📊 Analytics

- **Global KPIs** — total users, surveys, responses, assignments, completion rate
- **Per-survey breakdown** — response count, average completion time, completion rate, and per-question distributions
- **Choice questions** show bar charts with percentages
- **Numeric questions** show averages and counts
- **Matrix questions** show per-cell counts
- **File upload questions** show total files collected
- **PDF export** — print-ready, professionally designed reports with image grids

### 🔔 Notifications

- In-app notification center with unread count
- Polling-based live updates (30-second interval)
- User-controlled preferences (email, assignments, reminders, completions)
- Bulk notification on survey assignment

### 👥 User Management

- Custom email-based user model
- Role-based access: **admin**, **creator**, **user**
- Bulk actions: activate, deactivate, promote, demote, soft delete
- Avatar upload with automatic initials fallback
- Search, filter, and paginate across all user lists

### 📈 Activity Logging

- Full audit trail of every important action
- Filterable by action, object type, and user
- Admin-only access

### 🎨 User Experience

- **Light / Dark / System theme** with `next-themes`
- **Full RTL support** with Vazirmatn font
- **Responsive** — works on mobile, tablet, and desktop
- **Beautiful UI** with Tailwind 4 and custom design tokens
- **Consistent loading states** with skeletons and spinners
- **Toast notifications** for every action

---

## Tech Stack

### Backend

| Layer | Technology | Version |
|---|---|---|
| Framework | Django | 6.1.1 |
| API | Django REST Framework | 3.18.1 |
| Auth | SimpleJWT | 5.5.1 |
| API Docs | drf-spectacular | 0.30.0 |
| Filtering | django-filter | 26.1 |
| CORS | django-cors-headers | 4.9.0 |
| Database | PostgreSQL | 16 |
| DB adapter | psycopg | 3.3.5 |
| Image handling | Pillow | 12.3.0 |
| Env config | python-dotenv | 1.2.3 |
| Cache | redis | 7.x |
| Server | Gunicorn | 23.0.0 |
| Testing | pytest + pytest-django + factory-boy | 8.3 / 4.9 / 3.3 |

### Frontend

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router + Turbopack) | 16.3.6 |
| UI Library | React | 19 |
| Language | TypeScript | 5.6 |
| Styling | Tailwind CSS | 4 |
| Icons | lucide-react | 0.454 |
| Forms | react-hook-form + zod | 7.53 / 3.23 |
| Themes | next-themes | 0.4 |
| Toasts | sonner | 1.7 |
| HTTP | axios | 1.7 |
| Font | Vazirmatn | — |

### DevOps

| Tool | Purpose |
|---|---|
| Docker | Container runtime |
| Docker Compose | Multi-service orchestration |
| Nginx | Reverse proxy (dev + prod) |
| Git | Version control |

---

## Architecture

FORMly follows a **modular monolith** architecture on the backend and a **feature-based** architecture on the frontend.

### Backend — Modular Apps

Each Django app (`q_*`) is a self-contained module with its own models, serializers, views, and URLs:

```
q_core          → Base models, permissions, pagination, exceptions, validators
q_accounts      → Custom user, JWT auth, email verification, admin user API
q_surveys       → Survey, Question, QuestionOption, Matrix, SystemList
q_assignments   → Survey assignment with due dates and status tracking
q_responses     → Survey responses, answers, and file uploads
q_analytics     → Aggregated statistics and per-question distributions
q_notifications → User notifications with preferences
q_activity      → Activity log for audit trail
```

### Frontend — Feature-Based

Shared code lives under `shared/`, feature code under `features/`:

```
shared/         → Cross-cutting: UI kit, providers, hooks, lib, types
features/       → Feature modules: auth, surveys, builder, answer, ...
app/            → Next.js App Router pages
```

Path aliases:

- `@/*` → `./`
- `@/shared/*` → `./shared/*`
- `@/features/*` → `./features/*`

---

## Project Structure

```
formly/
│
├── backend/
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── development.py
│   │   │   ├── production.py
│   │   │   └── test.py
│   │   ├── api/v1/urls.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   │
│   ├── apps/
│   │   ├── q_core/
│   │   ├── q_accounts/
│   │   ├── q_surveys/
│   │   ├── q_assignments/
│   │   ├── q_responses/
│   │   ├── q_analytics/
│   │   ├── q_notifications/
│   │   └── q_activity/
│   │
│   ├── tests/
│   ├── manage.py
│   ├── requirements/
│   │   ├── base.txt
│   │   ├── development.txt
│   │   └── production.txt
│   ├── pytest.ini
│   ├── Dockerfile.dev
│   └── .env.example
│
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   ├── builder/[id]/
│   │   ├── answer/[id]/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   └── globals.css
│   │
│   ├── shared/
│   ├── features/
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── postcss.config.mjs
│   └── .env.local.example
│
├── nginx/
│   ├── nginx.dev.conf
│   └── nginx.prod.conf
│
├── docker-compose.dev.yml
├── .env.example
├── .gitignore
├── .gitattributes
└── README.md
```

---

## Getting Started

### Prerequisites

Choose one of the two setup methods below.

**For Docker setup:**

- Docker Desktop 4.x+ (with Docker Compose v2)
- 4 GB free RAM (minimum)
- ~2 GB free disk space

**For manual setup:**

- Python 3.12+
- Node.js 20+ (LTS)
- PostgreSQL 16+
- Redis 7+ *(optional — used only when `REDIS_URL` is set)*
- Git

Verify your tools:

```bash
docker --version
docker compose version

# Or, for manual setup:
python --version           # Python 3.12+
node --version             # v20+
npm --version              # v10+
psql --version             # PostgreSQL 16+
```

---

### Quick Start with Docker

This is the fastest way to get a working environment.

#### Step 1 — Clone the repository

```bash
git clone <your-repo-url>
cd formly
```

#### Step 2 — Create environment file

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
DJANGO_SECRET_KEY=change-me-to-a-long-random-string-at-least-32-bytes
POSTGRES_PASSWORD=choose-a-strong-password
```

> ⚠️ **Never commit `.env` to Git.** It's already in `.gitignore`.

#### Step 3 — Build and start the stack

```bash
docker compose -f docker-compose.dev.yml up --build -d
```

This starts four services: **db** (PostgreSQL), **redis**, **backend** (Django + Gunicorn), and **nginx** (reverse proxy on port 80).

Wait until the containers are healthy:

```bash
docker compose -f docker-compose.dev.yml ps
```

You should see `db`, `redis`, and `backend` as running.

#### Step 4 — Create the database schema

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate
```

#### Step 5 — Create an admin user

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
```

#### Step 6 — (Optional) Seed demo data

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py seed_demo
```

This creates demo users, surveys, assignments, and responses. All demo accounts use the password `Demo!2345`:

| Email | Role |
|---|---|
| `admin@formly.local` | superuser |
| `creator1@formly.local` | creator |
| `user1@formly.local` | regular user |

#### Step 7 — Set up and run the frontend

In a separate terminal:

```bash
cd frontend
cp .env.local.example .env.local
npm install --legacy-peer-deps
npm run dev
```

#### Step 8 — Open the app

| Service | URL |
|---|---|
| **Frontend** | http://localhost:3000 |
| **Backend (via nginx)** | http://localhost/api/v1/ |
| **Backend (direct)** | http://localhost:8000/api/v1/ |
| **API Docs (Swagger)** | http://localhost:8000/api/docs/ |
| **Admin Panel** | http://localhost:8000/admin/ |
| **Health Check** | http://localhost:8000/health/ |

---

### Manual Setup

Use this if you prefer to run services directly on your machine.

#### Step 1 — Start PostgreSQL

```sql
CREATE DATABASE formly;
CREATE USER formly WITH PASSWORD 'formly';
ALTER ROLE formly SET client_encoding TO 'utf8';
ALTER ROLE formly SET default_transaction_isolation TO 'read committed';
ALTER ROLE formly SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE formly TO formly;
```

#### Step 2 — Set up backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Linux / macOS
venv\Scripts\activate             # Windows

pip install --upgrade pip
pip install -r requirements/development.txt

cp .env.example .env
# Edit .env:
#   - Set POSTGRES_HOST=localhost (not "db")
#   - Set DJANGO_SECRET_KEY
```

#### Step 3 — Run migrations

```bash
python manage.py migrate
```

#### Step 4 — Create superuser

```bash
python manage.py createsuperuser
```

#### Step 5 — Start the backend

```bash
python manage.py runserver 8000
```

#### Step 6 — Set up frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install --legacy-peer-deps
npm run dev
```

---

### First-Time Configuration

After the app is running, do these steps once:

#### 1. Grant creator permission

By default, only superusers can create surveys. To let a regular user create surveys:

1. Go to **Admin Panel** → **Users** → select a user.
2. Under **User permissions**, add `q_accounts | user | Can create surveys`.
3. Save.

#### 2. Create system lists (optional)

1. Go to **Admin Panel** → **System lists** → **Add**.
2. Fill in **Name**, **Slug**, **Type** (COUNTRY, LANGUAGE, …).
3. Add **List items** inline (label + value).
4. Save.

#### 3. Configure email (optional)

Edit `.env`:

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-user
EMAIL_HOST_PASSWORD=your-password
DEFAULT_FROM_EMAIL=no-reply@formly.example.com
```

Restart the backend.

#### 4. Enable public registration (optional)

Edit `.env`:

```env
ALLOW_PUBLIC_REGISTRATION=True
```

Restart the backend.

---

## Running the Project

Once the initial setup is complete, here are the day-to-day commands.

### Day-to-Day Commands

**Start everything (Docker):**

```bash
docker compose -f docker-compose.dev.yml up -d
```

**Stop everything (Docker) — keeps data:**

```bash
docker compose -f docker-compose.dev.yml down
```

**Restart backend only (after code changes):**

```bash
docker compose -f docker-compose.dev.yml restart backend
```

**Rebuild backend after dependency changes:**

```bash
docker compose -f docker-compose.dev.yml build --no-cache backend
docker compose -f docker-compose.dev.yml up -d backend
```

**Frontend dev server:**

```bash
cd frontend
npm run dev
```

**Frontend production build (local check):**

```bash
cd frontend
npm run build
npm run start
```

**Backend without Docker:**

```bash
cd backend
source venv/bin/activate          # Linux / macOS
venv\Scripts\activate             # Windows
python manage.py runserver 8000
```

### Viewing Logs

**All services:**

```bash
docker compose -f docker-compose.dev.yml logs -f
```

**Backend only:**

```bash
docker compose -f docker-compose.dev.yml logs -f backend
```

**Database only:**

```bash
docker compose -f docker-compose.dev.yml logs -f db
```

**Last 100 lines:**

```bash
docker compose -f docker-compose.dev.yml logs --tail=100 backend
```

### Accessing Shells

**Django shell (Python REPL with models loaded):**

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py shell
```

**Bash inside backend container:**

```bash
docker compose -f docker-compose.dev.yml exec backend bash
```

**PostgreSQL psql:**

```bash
docker compose -f docker-compose.dev.yml exec db psql -U formly -d formly
```

**Common Django management commands:**

```bash
# Create a new superuser
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser

# Create migrations after model changes
docker compose -f docker-compose.dev.yml exec backend python manage.py makemigrations

# Apply migrations
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate

# Collect static files (for production)
docker compose -f docker-compose.dev.yml exec backend python manage.py collectstatic

# Seed demo data
docker compose -f docker-compose.dev.yml exec backend python manage.py seed_demo

# Inspect migration status
docker compose -f docker-compose.dev.yml exec backend python manage.py showmigrations
```

### Resetting the Database

> ⚠️ **Warning:** These commands will permanently delete all data.

**Reset everything including volumes:**

```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
```

**Reset just the database (keep containers):**

```bash
docker compose -f docker-compose.dev.yml exec db psql -U formly -d postgres -c "DROP DATABASE formly;"
docker compose -f docker-compose.dev.yml exec db psql -U formly -d postgres -c "CREATE DATABASE formly;"
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate
```

**Clear only media files (uploaded avatars, covers, etc.):**

```bash
# Windows
rmdir /s /q backend\media

# Linux / macOS
rm -rf backend/media
```

### Troubleshooting

**Port already in use (80, 3000, or 8000):**

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# Linux / macOS
lsof -ti:3000 | xargs kill -9
```

Or change ports in `docker-compose.dev.yml`.

**"Cannot connect to Docker daemon":**

Make sure Docker Desktop is running.

**Backend can't connect to database:**

```bash
# Check db is healthy
docker compose -f docker-compose.dev.yml ps db

# Check logs
docker compose -f docker-compose.dev.yml logs db

# Test connection
docker compose -f docker-compose.dev.yml exec backend python -c "import psycopg; print('psycopg OK')"
```

**Migrations fail with "table already exists":**

```bash
# Check applied migrations
docker compose -f docker-compose.dev.yml exec backend python manage.py showmigrations

# Fake a specific migration (only if you're sure)
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate q_surveys --fake
```

**Frontend: Module not found errors:**

```bash
cd frontend
rm -rf node_modules .next package-lock.json
npm install --legacy-peer-deps
npm run dev
```

**Frontend: CORS errors in browser console:**

Make sure `.env` has:

```env
CORS_ALLOW_ALL_ORIGINS=True
```

Then restart:

```bash
docker compose -f docker-compose.dev.yml restart backend
```

**Images not loading (avatars, covers):**

Verify `MEDIA_URL` in `backend/config/settings/base.py`:

```python
MEDIA_URL = "/media/"   # with leading slash
```

Then restart the backend.

**Frontend can't reach API:**

Check `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Then restart `npm run dev`.

---

## Environment Variables

### Root `.env` (Docker Compose)

| Variable | Default | Description |
|---|---|---|
| `DJANGO_SETTINGS_MODULE` | `config.settings.development` | Django settings module |
| `DJANGO_SECRET_KEY` | — | **Required in production** (≥ 32 bytes) |
| `DJANGO_DEBUG` | `True` | Debug mode |
| `DJANGO_ALLOWED_HOSTS` | `*` | Comma-separated allowed hosts |
| `POSTGRES_DB` | `formly` | Database name |
| `POSTGRES_USER` | `formly` | Database user |
| `POSTGRES_PASSWORD` | `formly` | Database password |
| `POSTGRES_HOST` | `db` | Database host (`localhost` for manual) |
| `POSTGRES_PORT` | `5432` | Database port |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated origins |
| `CORS_ALLOW_ALL_ORIGINS` | `True` (dev) | Allow all origins (dev only) |
| `ALLOW_PUBLIC_REGISTRATION` | `True` (dev) | Allow public sign-up |
| `EMAIL_VERIFICATION_ENABLED` | `True` | Require email verification |
| `REQUIRE_VERIFIED_TO_LOGIN` | `False` | Block login until verified |
| `FRONTEND_URL` | `http://localhost:3000` | Used in email links |
| `JWT_ACCESS_LIFETIME_MIN` | `30` | Access token lifetime (minutes) |
| `JWT_REFRESH_LIFETIME_DAYS` | `7` | Refresh token lifetime (days) |
| `EMAIL_BACKEND` | `django.core.mail.backends.console.EmailBackend` | Email backend |
| `DEFAULT_FROM_EMAIL` | `no-reply@formly.local` | From address |
| `MAX_UPLOAD_SIZE_MB` | `10` | Max file upload size |
| `REDIS_URL` | — | Redis URL (optional; falls back to LocMem in dev) |

### Frontend `.env.local`

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | Backend API base URL |

---

## Database Schema

### Core Models

```
User
  ├── id (UUID)
  ├── email (unique, case-insensitive)
  ├── first_name, last_name
  ├── avatar (ImageField)
  ├── is_active, is_staff, is_superuser, is_verified
  ├── notification_preferences (JSONField)
  └── created_at, updated_at, last_login

Survey
  ├── id (UUID)
  ├── created_by → User
  ├── title, description, category, cover_image
  ├── status: DRAFT | PUBLISHED | CLOSED | ARCHIVED
  ├── visibility: PUBLIC | ASSIGNED
  ├── response_mode: IDENTIFIED | ANONYMOUS
  ├── estimated_time_minutes
  ├── published_at
  └── is_deleted (Soft Delete)

Question
  ├── id (UUID)
  ├── survey → Survey
  ├── type (23 choices)
  ├── title, description, required, order
  ├── settings (JSONField)
  └── system_list → SystemList (nullable)

QuestionOption / MatrixRow / MatrixColumn
  └── belong to Question

SurveyAssignment
  ├── id (UUID)
  ├── survey → Survey
  ├── user → User
  ├── assigned_by → User
  ├── status: PENDING | IN_PROGRESS | COMPLETED | OVERDUE
  ├── start_date, due_date, completed_at
  └── allow_resume

SurveyResponse
  ├── id (UUID)
  ├── survey → Survey
  ├── user → User (nullable for anonymous)
  ├── assignment → SurveyAssignment (nullable)
  ├── status: DRAFT | SUBMITTED
  ├── started_at, submitted_at, completion_time
  └── answers → Answer[]

Answer
  ├── response → SurveyResponse
  ├── question → Question
  ├── value (JSONField)
  └── files → AnswerFile[]

AnswerFile
  ├── answer → Answer (nullable)
  ├── survey → Survey
  ├── uploaded_by → User
  ├── file (FileField)
  ├── original_name, content_type, size
  └── order

SystemList
  ├── name, slug, type
  ├── is_system
  └── items → ListItem[]

Notification
  ├── user → User
  ├── title, message, type
  ├── is_read
  └── metadata (JSONField)

ActivityLog
  ├── user → User (nullable)
  ├── action, object_type, object_id
  ├── description
  └── metadata (JSONField)
```

---

## API Overview

All endpoints are prefixed with `/api/v1/`.

### Authentication — `/auth/`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register/` | Register a new user |
| POST | `/auth/login/` | Obtain access + refresh tokens |
| POST | `/auth/logout/` | Blacklist a refresh token |
| POST | `/auth/refresh/` | Refresh an access token |
| GET/PATCH | `/auth/me/` | Retrieve or update the current user |
| POST | `/auth/change-password/` | Change password |
| POST | `/auth/password-reset/` | Request a password reset email |
| POST | `/auth/password-reset/confirm/` | Confirm password reset |
| POST | `/auth/email-verification/request/` | Request an email verification link |
| POST | `/auth/email-verification/confirm/` | Confirm email verification |

### Users — `/users/`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users/` | List users (admin only) |
| GET | `/users/{id}/` | Retrieve a user |
| PATCH | `/users/{id}/` | Update a user |
| DELETE | `/users/{id}/` | Soft-deactivate a user |

### Surveys — `/surveys/`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/surveys/` | List surveys |
| POST | `/surveys/` | Create a survey |
| GET | `/surveys/{id}/` | Retrieve a survey with questions |
| PATCH | `/surveys/{id}/` | Update a survey |
| DELETE | `/surveys/{id}/` | Soft-delete a survey |
| POST | `/surveys/{id}/publish/` | Publish |
| POST | `/surveys/{id}/close/` | Close |
| POST | `/surveys/{id}/archive/` | Archive |
| POST | `/surveys/{id}/duplicate/` | Duplicate (with all questions) |
| GET | `/surveys/mine/` | List surveys created by the current user |

### Questions — `/surveys/questions/`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/surveys/questions/` | List questions |
| POST | `/surveys/questions/` | Create a question |
| PATCH | `/surveys/questions/{id}/` | Update a question |
| DELETE | `/surveys/questions/{id}/` | Delete a question |
| POST | `/surveys/questions/reorder/` | Reorder questions |

### System Lists — `/surveys/system-lists/`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/surveys/system-lists/` | List all system lists with items |
| GET | `/surveys/system-lists/{id}/` | Retrieve a single list |

### Assignments — `/assignments/`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/assignments/` | List assignments (admins see all, users see own) |
| POST | `/assignments/` | Assign a survey to one user |
| POST | `/assignments/bulk/` | Bulk assign to multiple users |
| POST | `/assignments/{id}/start/` | Mark as in-progress |
| GET | `/assignments/mine/` | Current user's assignments |

### Responses — `/responses/`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/responses/` | List responses (admins see all, users see own) |
| GET | `/responses/{id}/` | Retrieve a response with all answers |
| POST | `/responses/save-draft/` | Create or update a draft |
| POST | `/responses/{id}/submit/` | Submit a draft |
| GET | `/responses/my-draft/{survey_id}/` | Get the current draft for a survey |
| POST | `/responses/upload/` | Upload a file for a FILE_UPLOAD question |

### Analytics — `/analytics/`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/analytics/global/` | Global platform statistics (admin only) |
| GET | `/analytics/surveys/{id}/` | Per-survey analytics |

### Notifications — `/notifications/`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/notifications/` | List notifications |
| POST | `/notifications/{id}/read/` | Mark one as read |
| POST | `/notifications/read-all/` | Mark all as read |
| GET | `/notifications/unread-count/` | Get unread count |

### Activity — `/activity/`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/activity/` | List activity logs (admin only) |

---

## User Roles & Permissions

FORMly uses Django's built-in permission system. Roles are derived from flags:

| Role | Criteria | Capabilities |
|---|---|---|
| **admin** | `is_superuser = True` | Full access: manage users, surveys, assignments, responses, analytics, activity |
| **creator** | Has permission `q_accounts.can_create_survey` | Create and edit surveys, assign them, view analytics for own surveys |
| **user** | Default | View and answer assigned surveys, review own responses |

**Frontend route guards:**

- `AuthGuard` — requires authentication
- `RoleGuard` — requires one of the specified roles

**Backend permissions:**

- `IsSuperUser` — admin only
- `CanCreateSurvey` — admin or creator
- `SurveyPermission` — owner or superuser
- `QuestionPermission` — owner or superuser (with published-with-responses restriction)

---

## Question Types

| Code | Description |
|---|---|
| `SHORT_TEXT` | Single-line text |
| `LONG_TEXT` | Multi-line text |
| `EMAIL` | Email address (validated) |
| `PHONE` | Phone number (validated) |
| `URL` | Web URL (validated) |
| `NUMBER` | Numeric input with optional min/max |
| `RATING` | Star rating (default 1–5) |
| `LINEAR_SCALE` | Numeric scale (default 1–10) |
| `NPS` | Net Promoter Score (0–10) |
| `SLIDER` | Numeric slider |
| `SINGLE_CHOICE` | Radio buttons |
| `MULTIPLE_CHOICE` | Checkboxes |
| `DROPDOWN` | Select menu |
| `YES_NO` | Two-button toggle |
| `LIKERT` | Likert scale |
| `RANKING` | Ranked list |
| `DATE` | Date picker |
| `TIME` | Time picker |
| `DATETIME` | Date and time picker |
| `MATRIX` | Grid of rows × columns |
| `FILE_UPLOAD` | Multi-file upload with drag-and-drop |
| `TEXT_BLOCK` | Static text content |
| `SECTION` | Section header |

---

## Testing

### Backend

```bash
# Run all tests
docker compose -f docker-compose.dev.yml exec backend pytest --create-db -q

# With coverage report
docker compose -f docker-compose.dev.yml exec backend pytest --create-db --cov=apps --cov-report=html

# Run a specific test file
docker compose -f docker-compose.dev.yml exec backend pytest tests/test_surveys.py -v
```

Expected result: **173 passing tests**, coverage ≈ 83%.

Coverage includes:

- Auth flows (login, register, verify, password reset, change password)
- Survey CRUD, question CRUD, reorder, publish / close / archive
- Assignments (single, bulk, `/mine` scoping, status transitions, overdue)
- Responses (draft, submit, file upload, anonymous)
- Analytics (query-count regression tests, cache invalidation, comparison)
- Notifications and activity logs
- Performance regression tests (assert constant query counts)

### Frontend

```bash
cd frontend
npm run lint          # ESLint
npm run build         # Production build check
```

---

## Deployment

### Production Checklist

- [ ] Set `DJANGO_DEBUG=False`
- [ ] Set a strong `DJANGO_SECRET_KEY` (≥ 32 bytes)
- [ ] Configure `DJANGO_ALLOWED_HOSTS` with your domain
- [ ] Set `CORS_ALLOWED_ORIGINS` to your frontend origin(s)
- [ ] Set `CORS_ALLOW_ALL_ORIGINS=False`
- [ ] Use a production database (managed PostgreSQL recommended)
- [ ] Serve media files from object storage or a CDN
- [ ] Set up HTTPS/TLS termination (reverse proxy)
- [ ] Configure `SECURE_SSL_REDIRECT=True` and HSTS
- [ ] Set `SECURE_HSTS_PRELOAD=True` after verifying HTTPS
- [ ] Configure email backend (SMTP)
- [ ] Set `TRUST_PROXY=True` if behind a reverse proxy
- [ ] Configure Redis for caching (`REDIS_URL`)
- [ ] Build the frontend with `npm run build` and serve with `next start`
- [ ] Set up monitoring and error tracking

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m "feat: add amazing feature"`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:     A new feature
fix:      A bug fix
docs:     Documentation only
style:    Formatting, missing semicolons, etc.
refactor: Code change that neither fixes a bug nor adds a feature
perf:     Performance improvement
test:     Adding or updating tests
chore:    Build process or auxiliary tool changes
```

---

## License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for more information.

---

## Acknowledgements

- [Django REST Framework](https://www.django-rest-framework.org/)
- [SimpleJWT](https://django-rest-framework-simplejwt.readthedocs.io/)
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Vazirmatn](https://github.com/rastikerdar/vazirmatn) — Persian font
- [Lucide](https://lucide.dev/) — Icons

---

<div align="center">

Made with ❤️ by the FORMly team

</div>