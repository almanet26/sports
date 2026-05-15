# Cricket Analytics and Highlight Platform

Full-stack cricket analytics platform for OCR-driven highlight extraction and AI-assisted batting and bowling biomechanics.

Status: Production-ready monorepo with FastAPI backend and React + Vite frontend.

## Features
- Video ingestion from direct upload and YouTube sources
- OCR event detection for scoring events and supercut generation
- Biomechanics analysis pipelines for batting and bowling
- Coach workflows: player inbox, annotations, dashboard exports, academy branding
- Subscription-aware feature gating and usage quotas

## Project Structure
Current repository hierarchy (trimmed to key modules):

```text
sports/
├── backend/
│   ├── api/
│   │   ├── highlights_async.py
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── videos.py
│   │       ├── jobs.py
│   │       ├── requests.py
│   │       ├── admin.py
│   │       ├── admin_coaches.py
│   │       ├── player_stats.py
│   │       ├── batting.py
│   │       ├── bowling.py
│   │       ├── submissions.py
│   │       ├── storage.py
│   │       ├── worker.py
│   │       ├── usage.py
│   │       ├── report.py
│   │       ├── chat.py
│   │       ├── benchmarks.py
│   │       ├── profile.py
│   │       ├── annotations.py
│   │       ├── dashboard.py
│   │       ├── coach_inbox.py
│   │       ├── academy.py
│   │       ├── match.py
│   │       └── notification.py
│   ├── config/
│   ├── database/
│   │   ├── crud/
│   │   └── models/
│   ├── dependencies/
│   ├── schemas/
│   ├── scripts/
│   ├── services/
│   ├── tests/
│   ├── utils/
│   ├── Dockerfile
│   ├── Dockerfile.worker
│   ├── cloudrun.yaml
│   ├── requirements.txt
│   └── main.py
├── frontend/
│   ├── src/
│   ├── public/
│   ├── docs/
│   ├── package.json
│   └── vite.config.ts
├── docs/
├── storage/
├── cloudbuild.yaml
└── package.json
```

## API Endpoints
Base API prefix: /api/v1

### Health
| Method | Endpoint | Purpose |
|---|---|---|
| GET | / | API root metadata |
| GET | /api/v1/health | Service health check |
| GET | /api/v1/db-health | Database connectivity check |

### Authentication and User Session
Source: backend/api/routes/auth.py

| Method | Endpoint |
|---|---|
| POST | /auth/register |
| POST | /auth/login |
| GET | /auth/me |
| PUT | /auth/me |
| POST | /auth/logout |

### Video and OCR Workflows
Sources: backend/api/routes/videos.py, jobs.py, storage.py, worker.py

| Method | Endpoint |
|---|---|
| POST | /videos/upload |
| POST | /videos/upload/youtube |
| GET | /videos/all |
| GET | /videos/public |
| GET | /videos/private |
| GET | /videos/mine |
| GET | /videos/{video_id} |
| GET | /videos/{video_id}/stream |
| GET | /videos/{video_id}/supercut |
| GET | /videos/{video_id}/events |
| POST | /videos/{video_id}/publish |
| DELETE | /videos/{video_id} |
| POST | /videos/process |
| GET | /videos/highlights/{video_id} |
| GET | /videos/status/{job_id} |
| POST | /videos/create-reel |
| POST | /jobs/trigger |
| GET | /jobs/{video_id}/status/poll |
| GET | /jobs/{video_id}/status |
| GET | /jobs/{video_id}/result |
| POST | /jobs/{video_id}/retry |
| GET | /jobs/pending |
| GET | /storage/upload-url |
| PUT | /storage/local-upload/{blob_path} |
| POST | /storage/resumable-session |
| POST | /storage/confirm-upload |
| POST | /storage/start-processing |

Internal worker endpoints:
- POST /internal/worker/process-video
- POST /internal/worker/ocr-task

### Biomechanics and Reports
Sources: backend/api/routes/batting.py, bowling.py, report.py, benchmarks.py

| Method | Endpoint |
|---|---|
| POST | /batting/analyze |
| GET | /batting/history |
| GET | /batting/{analysis_id} |
| POST | /bowling/analyze |
| GET | /bowling/history |
| GET | /bowling/{analysis_id} |
| GET | /batting/{analysis_id}/report |
| GET | /bowling/{analysis_id}/report |
| GET | /benchmarks |
| POST | /batting/{analysis_id}/compare |
| POST | /bowling/{analysis_id}/compare |

### Submissions and Coach Collaboration
Sources: backend/api/routes/submissions.py, coach_inbox.py, annotations.py, dashboard.py, academy.py

| Method | Endpoint |
|---|---|
| GET | /submissions/coaches |
| POST | /submissions/upload |
| GET | /submissions/player/me |
| GET | /submissions/player/all |
| GET | /submissions/coach/me |
| POST | /submissions/{submission_id}/analyze |
| PUT | /submissions/{submission_id}/publish |
| GET | /submissions/{submission_id} |
| POST | /coach/submissions |
| GET | /coach/submissions/inbox |
| PATCH | /coach/submissions/{submission_id}/status |
| POST | /annotations |
| GET | /annotations/{video_id} |
| PUT | /annotations/{annotation_id} |
| DELETE | /annotations/{annotation_id} |
| POST | /dashboard/players/invite |
| GET | /dashboard/players |
| DELETE | /dashboard/players/{player_id} |
| GET | /dashboard/export |
| POST | /academy/branding |
| GET | /academy/branding |

### Community, Profile, Chat, Notifications
Sources: backend/api/routes/requests.py, profile.py, chat.py, player_stats.py, match.py, notification.py

| Method | Endpoint |
|---|---|
| POST | /requests/ |
| GET | /requests/ |
| POST | /requests/{request_id}/vote |
| DELETE | /requests/{request_id}/vote |
| GET | /requests/admin/dashboard |
| PATCH | /requests/{request_id}/status |
| POST | /profile/setup |
| PATCH | /profile/scouting |
| GET | /profile/{user_id}/public |
| POST | /chat/message |
| GET | /chat/sessions |
| DELETE | /chat/sessions/{session_id} |
| GET | /player-stats |
| GET | /player-stats/{player_id} |
| GET | /matches/upcoming |
| GET | /notifications |

### Billing and Admin
Sources: backend/api/routes/usage.py, admin.py, admin_coaches.py, subscription.py

| Method | Endpoint |
|---|---|
| POST | /billing/create-order |
| GET | /billing/usage |
| GET | /admin/plans |
| PATCH | /admin/plans/{plan_key} |
| GET | /admin/users |
| GET | /admin/users/{user_id} |
| PATCH | /admin/users/{user_id} |
| PATCH | /admin/users/{user_id}/subscription |
| POST | /admin/users/{user_id}/impersonate |
| GET | /admin/stats |
| GET | /admin/audit-log |
| GET | /admin/coaches/pending |
| PATCH | /admin/coaches/{coach_id}/verify |
| GET | /admin/activity |
| GET | /admin/coaches/pending (legacy admin_coaches module) |
| POST | /admin/coaches/{coach_id}/approve |
| POST | /admin/coaches/{coach_id}/reject |
| GET | /admin/coaches/all |
| GET | /admin/coaches/{coach_id}/document |
| POST | /subscriptions/subscribe |
| GET | /subscriptions/user/{user_id} |

Internal usage endpoint:
- POST /internal/usage/report

Notes:
- Endpoints are listed from route modules currently mounted in backend/main.py.
- Some older route files remain in backend/api/routes but are not mounted by default.

## Monetization Tiers

**Players:**
- `free`: No credits, can view public videos
- `basic`: 15 analyses/month (batting + bowling combined)
- `platinum`: 50 analyses/month

**Coaches:**
- `coach_free`: Can receive submissions from players (no analysis capability)
- `coach_starter`: 150 submissions/month, 50 OCR hours, full analysis suite
- `coach_pro`: 600 submissions/month, 150 OCR hours
- `academy`: 1500 submissions/month, 500 OCR hours, full dashboard + team management

All plans are **fixed-duration** (90/180/365 days), not recurring monthly billing.

## Prerequisites

### Core Runtime
- Python 3.11
- Node.js 20 LTS or newer
- npm 10 or newer
- PostgreSQL 15 on Supabase (or local)
- FFmpeg available in PATH
- GCP credentials (for Cloud Storage, Cloud Tasks, Secret Manager)

### Frontend Toolchain (from frontend/package.json)
- Vite 7
- React 19 and React DOM 19
- TypeScript 5.9
- Tailwind CSS 3.4 and PostCSS
- ESLint 8 with typescript-eslint

### Frontend Runtime Libraries
- State management: Zustand
- Routing: React Router DOM 7
- Data/HTTP: Axios
- Charts: Chart.js, React Chartjs 2, Recharts
- UI primitives: Radix UI packages
- Uploads and animations: Mux Upchunk, Framer Motion

### Repository-level JavaScript Tooling (from root package.json)
- Husky
- lint-staged

## Quick Start (Local Development)

### 1. Clone and install JS tooling
```bash
git clone https://github.com/almanet26/sports.git
cd sports
npm install
```

### 2. Backend setup
```bash
cd backend
python -m venv venv
.\venv\scripts\activate.ps1  # Windows PowerShell
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# (Optional) Seed test accounts with fresh JWTs
python scripts/seed_roles.py

# Start the server
uvicorn main:app --reload
```

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev
```

## Test Accounts (Local Development)

After running `python scripts/seed_roles.py`, the following accounts are available for testing roles and quota gates:

| Email | Role | Tier | Password |
|-------|------|------|----------|
| player.free@test.com | PLAYER | free | Test@12345 |
| player.basic@test.com | PLAYER | basic | Test@12345 |
| player.platinum@test.com | PLAYER | platinum | Test@12345 |
| coach.free@test.com | COACH | coach_free | Test@12345 |
| coach.starter@test.com | COACH | coach_starter | Test@12345 |
| coach.pro@test.com | COACH | coach_pro | Test@12345 |
| coach.academy@test.com | COACH | academy | Test@12345 |
| admin@test.com | ADMIN | academy | Test@12345 |

To regenerate fresh JWTs and print them to the terminal, run:
```bash
cd backend
python scripts/seed_roles.py
```

## Environment Variables

### Backend (.env)
Create `backend/.env` with:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sports
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your-anon-key

# JWT
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# GCP
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# APIs
GOOGLE_GEMINI_API_KEY=your-gemini-api-key
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret

# Feature Flags
ENABLE_COACH_SUBMISSIONS=true
ENABLE_AI_FEEDBACK=true
```

### Frontend (.env.local)
Create `frontend/.env.local` with:
```env
VITE_API_URL=http://localhost:8000
VITE_BACKEND_PORT=8001
```

## Architecture

- **Frontend**: React 18 + Vite (SSPA, deployed on Vercel)
- **Backend**: FastAPI + SQLAlchemy async ORM (deployed on GCP Cloud Run)
- **Database**: PostgreSQL 15 on Supabase
- **Storage**: GCP Cloud Storage (videos, reports, artifacts)
- **Task Queue**: GCP Cloud Tasks (async video processing)
- **Secrets**: GCP Secret Manager
- **CI/CD**: GCP Cloud Build (Docker builds → Cloud Run deployment)