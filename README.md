# Cricket Analytics and Highlight Platform

A production-ready full-stack platform for cricket video analysis, highlight extraction, and AI-driven biomechanics coaching. Features OCR-powered automatic highlight detection, MediaPipe pose analysis for batting and bowling technique, real-time coach collaboration tools, and comprehensive subscription management.

**Status:** Production deployment on GCP Cloud Run (asia-south1) + Vercel. Database: PostgreSQL on Supabase. Storage: Google Cloud Storage. Queue: Google Cloud Tasks.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Local Setup](#local-setup)
- [Deployment](#deployment)
- [API Overview](#api-overview)
- [AI Pipeline](#ai-pipeline)
- [Data Flow](#data-flow)
- [Security](#security)
- [Performance Optimizations](#performance-optimizations)
- [Current Status](#current-status)
- [Testing](#testing)
- [Contributing](#contributing)
- [API Examples](#api-examples)
- [Environment Variables Reference](#environment-variables-reference)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

### 🎥 Video Management
- **Multi-source ingestion:** Direct file upload, YouTube URL import
- **Resumable uploads:** Mux Upchunk for reliable large-file handling
- **Signed URL uploads:** Direct GCS uploads bypass backend
- **Visibility control:** Public/private video management
- **Metadata tracking:** Title, description, match date, teams, venue

### 🔍 OCR Highlight Detection
- **Automatic scoring event extraction:** Detects 4s, 6s, wickets from scoreboard OCR
- **RapidOCR + ONNX:** Lightweight, no-PyTorch OCR pipeline
- **Median smoothing:** Anti-flicker detection prevents false positives
- **ROI calibration:** Custom region-of-interest for different video resolutions
- **Supercut generation:** Auto-compiled highlight reels
- **Event classification:** Timestamps with event type and score deltas

### 💪 Biomechanics Analysis

#### Batting Analysis
- **MediaPipe Pose tracking:** Full-body joint detection
- **Stance metrics:** Angle, balance, head position stability
- **Swing analysis:** Bat lift height, follow-through quality, timing
- **Technique flaws:** Automated detection with severity levels
- **Drill recommendations:** AI-generated practice routines
- **PDF reports:** Professional downloadable performance sheets
- **Historical tracking:** Comparative analysis across sessions

#### Bowling Analysis
- **Run-up speed tracking:** Consistency and velocity estimation
- **Release point analysis:** Height, stability, arm alignment
- **Action classification:** Fast/medium/spin bowling detection
- **Delivery flaws:** Front arm drift, inconsistent release, stride issues
- **Performance metrics:** Ball speed estimation, release stability, stride length
- **Specialized drills:** Action-specific improvement recommendations
- **Action categorization:** Seam, swing, bounce, spin variants

### 📊 Player Submission Workflow
- **Coach review inbox:** Pending, processing, draft, and published states
- **AI-assisted feedback:** MediaPipe + Gemini pre-analysis
- **Coach annotations:** Manual feedback and corrections
- **PDF generation:** Coach-customized performance reports
- **Player visibility:** Secure access to published feedback
- **Status tracking:** Real-time processing updates

### 🏆 Coach Features
- **Private content library:** Coaching videos, drills, tutorials
- **Player roster management:** Dashboard with athlete tracking
- **Training plans:** Create and manage personalized programs
- **Session scheduling:** Availability calendar and booking management
- **Video annotations:** Mark points of interest with drawn feedback
- **CSV data export:** Athlete progress and metrics export
- **Academy branding:** White-label reports with custom logos
- **Earnings tracking:** Revenue from submissions and coaching

### 💳 Subscription & Billing
- **Player tiers:**
  - **Bronze (Free):** 3 analyses/month, streak counters
  - **Silver (₹200/mo):** 15 analyses/month, PDF reports, AI chat, ad-free
  - **Gold (₹500/mo):** 50 analyses/month, pro benchmarking, scouting visibility

- **Coach tiers:**
  - **Coach Basic (Free):** 10 OCR hours, 5 submissions/month, 5-player roster
  - **Coach Platinum (₹1,200/yr):** 50 OCR hours, 100 submissions/month, 25-player roster, full toolkit

- **Razorpay integration:** Payment processing and order creation
- **Usage tracking:** Real-time quota monitoring
- **Subscription expiry:** Automatic plan transitions
- **Dynamic entitlements:** Database-driven feature catalog

### 👥 Community & Social
- **Match request voting:** Community-driven content requests
- **Public video library:** Browse and vote on popular content
- **Scouting profiles:** Verified player visibility for scouts/franchises
- **Scouting directory:** Scout browsing and shortlist management
- **Leaderboard:** Top-performing and most-improved athletes
- **Chat system:** Real-time messaging between users
- **Notifications:** Event updates and submission alerts

### 👨‍💼 Admin Features
- **User management:** Role assignment, subscription control
- **Coach verification:** Document-based coach approval
- **Plan management:** Dynamic feature/quota configuration
- **Usage monitoring:** User quota and billing analytics
- **Audit logging:** Complete activity trail
- **Admin impersonation:** Debug user-specific flows

### 🎮 Gamification
- **Streak counters:** Consecutive analysis tracking
- **Milestone badges:** Achievement unlocking
- **Performance metrics:** User activity dashboard
- **Leaderboards:** Competitive rankings

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                        Users / Browser                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ▼
        ┌──────────────────────────────┐
        │     React 19 + Vite SPA      │
        │   (Vercel / Vercel + Render) │
        │      (TypeScript)            │
        └──────────────┬───────────────┘
                       │ REST API
                       │ /api/v1/*
                       ▼
        ┌────────────────────────────────┐
        │      FastAPI Backend           │
        │  (Cloud Run / Render)          │
        │   JWT Auth + CORS              │
        │  Gunicorn + Uvicorn            │
        └──┬────────────────┬────────────┘
           │                │
           │ SQL ORM        │ Async HTTP
           │                │
           ▼                ▼
     ┌──────────┐      ┌──────────────────┐
     │PostgreSQL│      │Google Cloud Tasks│
     │(Supabase)│      └────────┬─────────┘
     └──────────┘               │
                                │ HTTP Webhook
                                ▼
                    ┌──────────────────────┐
                    │Cloud Run - Workers   │
                    │(Background Jobs)     │
                    └─────┬────────────────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
            ▼             ▼             ▼
        ┌────────┐   ┌─────────┐  ┌──────────┐
        │ OCR    │   │MediaPipe│  │FFmpeg    │
        │Engine  │   │Pose     │  │Clipper   │
        │(ONNX)  │   │(CPU)    │  │(static)  │
        └────────┘   └─────────┘  └──────────┘
            │             │             │
            └─────────────┼─────────────┘
                          │
                          ▼
                  ┌─────────────────┐
                  │Google Cloud     │
                  │Storage (videos, │
                  │reports, reports)│
                  └─────────────────┘
```

### Component Interactions

1. **User flows through frontend:** React SPA via Vercel (global CDN)
2. **API requests:** JWT-authenticated REST calls to FastAPI backend
3. **Real-time updates:** WebSocket support for live processing status
4. **Heavy lifting:** Cloud Tasks queues async jobs to worker pool
5. **Background workers:** Isolated Cloud Run instances for OCR, pose analysis, PDF generation
6. **Persistent storage:** PostgreSQL (Supabase) for state; GCS for binaries
7. **Signed URLs:** Direct browser→GCS uploads, bypassing API layer

---

## Tech Stack

### Frontend

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | React | 19 |
| **Build Tool** | Vite | 7 |
| **Language** | TypeScript | 5.9 |
| **Styling** | Tailwind CSS + PostCSS | 3.4 + 8.5 |
| **State Management** | Zustand | 5.0 |
| **Routing** | React Router DOM | 7 |
| **HTTP Client** | Axios | 1.13 |
| **UI Primitives** | Radix UI | Various |
| **Charts** | Chart.js, Recharts, React Chartjs 2 | Latest |
| **Animations** | Framer Motion | 12.29 |
| **Video Upload** | Mux Upchunk | 3.5 |
| **Icons** | Lucide React | 0.562 |
| **Testing** | Vitest, Testing Library | Latest |
| **Linting** | ESLint + typescript-eslint | 8+ |

### Backend

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | FastAPI | REST API, async support |
| **WSGI Server** | Gunicorn + Uvicorn workers | Production workload handling |
| **Language** | Python | 3.11 |
| **ORM** | SQLAlchemy 2.0 (async) | Database abstraction |
| **Migrations** | Alembic | Schema versioning |
| **Auth** | PyJWT, passlib, bcrypt | JWT & password hashing |
| **HTTP Client** | httpx, aiofiles | Async operations |
| **OCR** | RapidOCR-ONNX | Lightweight text extraction |
| **Pose Estimation** | MediaPipe 0.10.14 | Body landmark detection |
| **Video Processing** | OpenCV, FFmpeg (static) | Clip extraction |
| **PDF Generation** | ReportLab, FPDF2, Pillow | Document creation |
| **AI Integration** | Google Gemini API | Feedback generation |
| **Cloud Storage** | Google Cloud Storage SDK | Signed URLs, bucket access |
| **Task Queue** | Google Cloud Tasks SDK | Job dispatching |
| **Payments** | Razorpay SDK | Order creation, webhooks |
| **Data Analysis** | Pandas, NumPy, SciPy | Metrics computation |
| **Caching** | cachetools | TTL-based entitlement cache |

### Database

| System | Version | Hosting | Purpose |
|--------|---------|---------|---------|
| **PostgreSQL** | 15 | Supabase | Primary OLTP store |
| **Tables** | ~35+ | - | Users, videos, analyses, submissions, plans, features, entitlements, usage, audits |

### Cloud Platform (GCP)

| Service | Region | Purpose |
|---------|--------|---------|
| **Cloud Run** | asia-south1 (Mumbai) | API + async worker hosting |
| **Cloud Storage** | asia-south1 | Video storage, reports, artifacts |
| **Cloud Tasks** | asia-south1 | Async job queue |
| **Artifact Registry** | asia-south1 | Docker image hosting |
| **Secret Manager** | - | Sensitive env vars (API keys, DB URL) |
| **Cloud Build** | - | CI/CD pipeline (Docker build → push → deploy) |

### DevOps

| Tool | Purpose |
|------|---------|
| **Docker** | Container packaging (multi-stage: builder + runtime) |
| **Cloud Build** | Automated deployment pipeline |
| **Vercel** | Frontend CDN + edge functions |
| **Render.yaml** | Deployment config (Docker runtime) |
| **Git** | Version control |
| **Husky + lint-staged** | Pre-commit hooks for code quality |

---

## Folder Structure

```
sports/
├── backend/                    # FastAPI backend (deployment context for Cloud Build)
│   ├── api/
│   │   ├── routes/             # All API endpoint modules (auth, videos, jobs, etc.)
│   │   │   ├── auth.py         # JWT login/register/logout
│   │   │   ├── videos.py       # Video CRUD + streaming
│   │   │   ├── jobs.py         # OCR job creation & status polling
│   │   │   ├── batting.py      # Batting analysis endpoint
│   │   │   ├── bowling.py      # Bowling analysis endpoint
│   │   │   ├── submissions.py  # Player submission workflows
│   │   │   ├── coach_inbox.py  # Coach review inbox
│   │   │   ├── dashboard.py    # Coach player dashboard
│   │   │   ├── annotations.py  # Video annotation tools
│   │   │   ├── admin.py        # Admin user management
│   │   │   ├── admin_plans.py  # Plan configuration
│   │   │   ├── usage.py        # Quota tracking
│   │   │   ├── chat.py         # Messaging
│   │   │   ├── notification.py # Event notifications
│   │   │   ├── storage.py      # GCS signed URLs
│   │   │   ├── worker.py       # Internal worker endpoints
│   │   │   ├── subscription.py # Billing management
│   │   │   └── ... (15+ more routes)
│   │   └── highlights_async.py # Async highlight processing
│   ├── database/
│   │   ├── models/             # SQLAlchemy ORM models
│   │   │   ├── user.py         # User, UserSession
│   │   │   ├── video.py        # Video, HighlightEvent, HighlightJob
│   │   │   ├── batting.py      # BattingAnalysis
│   │   │   ├── bowling.py      # BowlingAnalysis
│   │   │   ├── submission.py   # VideoSubmission, PlayerSubmission
│   │   │   ├── plan.py         # Plan, Feature, PlanEntitlement
│   │   │   ├── subscription.py # Subscription, Transaction
│   │   │   ├── coach_*.py      # Coach training plans, sessions, availability
│   │   │   ├── notification.py # Notification, Message
│   │   │   └── ... (15+ more models)
│   │   ├── crud/                # SQLAlchemy CRUD operations per model
│   │   └── config.py            # SessionLocal, engine, Base
│   ├── services/
│   │   ├── ocr_task.py         # OCR job dispatch & monitoring
│   │   ├── entitlement_service.py # Dynamic entitlement resolution
│   │   ├── gcs_storage_service.py # Signed URL generation
│   │   ├── cloud_tasks_service.py # Task queue management
│   │   ├── razorpay_service.py  # Payment order creation
│   │   └── usage_service.py     # Quota tracking
│   ├── schemas/                # Pydantic request/response models
│   ├── dependencies/           # Auth middleware, DB session injection
│   ├── config/
│   │   ├── default_entitlements.py # Plan/feature baseline catalog
│   │   ├── gcs_config.py       # Cloud Storage configuration
│   │   └── cors.json           # CORS policy
│   ├── scripts/
│   │   ├── seed_roles.py       # Test account generation
│   │   ├── seed_entitlements.py # Dynamic entitlement seeding
│   │   └── ... (debug & utility scripts)
│   ├── utils/                  # Helper functions (email, logging, etc.)
│   ├── tests/                  # Unit + integration tests
│   ├── alembic/                # Database migrations
│   │   └── versions/           # Migration files
│   ├── src/engine/             # AI pipeline modules
│   │   ├── downloader.py       # YouTube DL integration
│   │   ├── data_fetcher.py     # Match data loading
│   │   ├── highlight_generator.py # Event→supercut pipeline
│   │   ├── ocr_engine.py       # Frame extraction + OCR
│   │   ├── batting_engine.py   # Pose → batting metrics
│   │   └── bowling_engine.py   # Pose → bowling metrics
│   ├── storage/                # Local file storage (dev mode)
│   │   ├── uploads/            # User videos
│   │   ├── highlight/          # Generated supercuts
│   │   ├── reports/            # PDF reports
│   │   └── ... (other storage dirs)
│   ├── Dockerfile              # Multi-stage (builder + runtime)
│   ├── Dockerfile.worker       # (optional) Standalone worker image
│   ├── cloudbuild.yaml         # GCP Cloud Build pipeline
│   ├── cloudrun.yaml           # Cloud Run service definition
│   ├── .gcloudignore           # Build context exclusions
│   ├── requirements.txt        # Python dependencies
│   ├── main.py                 # FastAPI app entry point
│   └── venv/                   # Python virtual environment (local dev)
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable React components
│   │   │   ├── common/         # Layout, buttons, forms
│   │   │   ├── pages/          # Page-level components
│   │   │   └── ui/             # Radix UI wrapper components
│   │   ├── pages/              # Full-page route components
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── BattingAnalysisPage.tsx
│   │   │   ├── BowlingAnalysisPage.tsx
│   │   │   ├── CoachDashboard.tsx
│   │   │   ├── CoachInboxPage.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── BillingPage.tsx
│   │   │   └── ... (20+ more pages)
│   │   ├── routes.tsx          # React Router configuration
│   │   ├── services/           # API client functions (Axios)
│   │   ├── store/ / stores/    # Zustand state management
│   │   ├── lib/                # Utilities (formatting, validation)
│   │   ├── utils/              # Helper functions
│   │   ├── types/              # TypeScript interfaces
│   │   ├── App.tsx             # Root component
│   │   ├── main.tsx            # ReactDOM.createRoot() entry
│   │   ├── index.css           # Global styles
│   │   └── App.css             # App-specific styles
│   ├── public/                 # Static assets
│   ├── docs/                   # Frontend-specific documentation
│   ├── package.json            # Dependencies & scripts
│   ├── vite.config.ts          # Vite build configuration
│   ├── tsconfig.json           # TypeScript config
│   ├── tailwind.config.js      # Tailwind CSS config
│   └── .env.local              # Local env vars
│
├── docs/                       # Project documentation
│   ├── FEATURES.md             # Detailed feature guide
│   ├── ARCHITECTURE.md         # System design & components
│   ├── SETUP_GUIDE.md          # Installation instructions
│   ├── DEPLOYMENT_CONFIG.md    # GCP deployment steps
│   ├── DATABASE_SCHEMA.md      # Table definitions
│   ├── GCP_INTEGRATION.md      # Cloud Platform setup
│   ├── PUBLIC_PRIVATE_CONTENT.md # Visibility rules
│   ├── TESTING.md              # Test suite docs
│   ├── CONTRIBUTING.md         # Dev contribution guide
│   └── TROUBLESHOOTING.md      # Common issues & fixes
│
├── .github/
│   ├── appmod/                 # GitHub app configuration
│   └── copilot-instructions.md # GitHub Copilot context
│
├── .husky/                     # Git hooks
├── .claude/                    # Claude Code configuration
├── render.yaml                 # Render.com deployment config (Docker)
├── package.json                # Root npm scripts (lint-staged, Husky)
└── .env.local                  # (Local) Root env vars

Key Models (in database/models/):
- User (authentication, roles: PLAYER/COACH/ADMIN)
- Subscription (plan assignment with expiry)
- Plan, Feature, PlanEntitlement (dynamic entitlements)
- Video, HighlightEvent, HighlightJob (video pipeline state)
- BattingAnalysis, BowlingAnalysis (biomechanics results)
- VideoSubmission, PlayerSubmission (coach review workflow)
- VideoAnnotation (feedback markup)
- CoachPlayer, CoachTrainingPlan, CoachAvailability (coach tools)
- Message, Notification (social)
- AdminAuditLog (compliance)
- Match (fixture data)
- GameStat (gamification)
- CoachContent (teaching library)
```

---

## Local Setup

### Prerequisites

#### System Requirements
- **Python:** 3.11+
- **Node.js:** 20 LTS or newer  
- **npm:** 10+
- **Docker:** 20.10+ (for Docker Compose setup, optional)
- **PostgreSQL:** 15 (local or via Supabase or Docker)
- **FFmpeg:** 6.0+ (install: `apt-get install ffmpeg` or `brew install ffmpeg`)
- **Git:** 2.30+

#### Optional
- **GCP Account:** For Cloud Storage, Cloud Tasks, Secret Manager (if testing cloud features)
- **Razorpay Account:** For payment testing
- **Docker Compose:** For single-command setup

### Quick Start with Docker Compose (Backend + Database)

If you have Docker installed, you can start the backend and database with one command:

```bash
# Create docker-compose.yml in repo root (see template below)
docker-compose up -d

# Backend: http://localhost:8000/docs
# Database: localhost:5432 (postgres/password)
# Frontend: Run separately with npm (see below)

# View logs
docker-compose logs -f backend
docker-compose logs -f postgres

# Stop services
docker-compose down
```

**Docker Compose Template** (`docker-compose.yml` at repo root):
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: sports_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/sports_db
      SECRET_KEY: dev-secret-key-change-in-production
      JWT_ALGORITHM: HS256
      ACCESS_TOKEN_EXPIRE_MINUTES: 30
      CLOUD_RUN: "0"
      ENABLE_COACH_SUBMISSIONS: "true"
      ENABLE_AI_FEEDBACK: "true"
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: uvicorn main:app --reload --host 0.0.0.0 --port 8000

volumes:
  postgres_data:
```

**Frontend Setup (Manual):**
Run the frontend in a separate terminal:
```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:5173
```

### Traditional Setup (Manual)

#### Backend Setup

1. **Clone & navigate:**
   ```bash
   git clone https://github.com/almanet26/sports.git
   cd sports/backend
   ```

2. **Create virtual environment & install dependencies:**
   ```bash
   python -m venv venv
   # Windows PowerShell:
   .\venv\Scripts\Activate.ps1
   # macOS/Linux:
   source venv/bin/activate
   
   pip install -r requirements.txt
   ```

3. **Set environment variables:**
   ```bash
   # Copy and edit .env template
   cp .env.example .env
   ```

   **Minimum `.env` for local dev:**
   ```env
   # Database
   DATABASE_URL=postgresql://postgres:password@localhost:5432/sports_db
   
   # JWT (generate with: python -c "import secrets; print(secrets.token_urlsafe(32))")
   SECRET_KEY=your-secret-key-here
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   
   # GCP (optional for local dev, required for cloud storage features)
   GOOGLE_CLOUD_PROJECT=your-gcp-project-id
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   GCS_BUCKET_NAME=sports-ai-storage
   
   # APIs
   GOOGLE_GEMINI_API_KEY=your-gemini-key
   RAZORPAY_KEY_ID=your-razorpay-key
   RAZORPAY_KEY_SECRET=your-razorpay-secret
   
   # Features
   ENABLE_COACH_SUBMISSIONS=true
   ENABLE_AI_FEEDBACK=true
   CLOUD_RUN=0  # Set to 1 when deployed on Cloud Run
   ```

4. **Initialize database:**

   **Create tables from migrations:**
   ```bash
   # Run all pending migrations
   alembic upgrade head
   
   # Check current migration status
   alembic current
   
   # View migration history
   alembic history --verbose
   ```

   **Seed initial data (test accounts & entitlements):**
   ```bash
   # Create test accounts with sample credentials
   python scripts/seed_roles.py
   # Output: Prints test account emails + passwords
   
   # Create plan/feature catalog (dynamic entitlements)
   python scripts/seed_entitlements.py
   # Creates: 5 plans (bronze/silver/gold/coach_basic/coach_platinum)
   # Creates: 20+ features (biomechanics_analysis, ocr_highlights, etc.)
   ```

   **Database Migrations (Alembic):**
   - Located: `backend/alembic/versions/`
   - Each file represents a schema change (auto-generated or manual)
   - Idempotent: Safe to run multiple times
   
   **Creating a new migration:**
   ```bash
   # After changing a model in backend/database/models/
   alembic revision --autogenerate -m "add new_column to users"
   
   # Review the generated file in alembic/versions/
   # Then apply it
   alembic upgrade head
   ```

   **Rollback (dev only):**
   ```bash
   # Downgrade one step
   alembic downgrade -1
   
   # Rollback to specific migration
   alembic downgrade abc123de456
   
   # Reset to base (CAUTION: deletes all data)
   alembic downgrade base
   ```

5. **Start the API server:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   Server runs at `http://localhost:8000`. API docs: `http://localhost:8000/docs`

### Frontend Setup

1. **Navigate to frontend:**
   ```bash
   cd ../frontend
   npm install
   ```

2. **Set environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```

   **`.env.local`:**
   ```env
   VITE_API_URL=http://localhost:8000
   VITE_BACKEND_PORT=8001
   ```

3. **Start dev server:**
   ```bash
   npm run dev
   ```
   Opens `http://localhost:5173` (Vite default). Hot-reload enabled.

### Test Accounts

After running `python scripts/seed_roles.py`, use these credentials locally:

| Email | Role | Plan | Password |
|-------|------|------|----------|
| `bronze.test@sports.com` | PLAYER | Bronze (free) | `Test@12345` |
| `silver.test@sports.com` | PLAYER | Silver (₹200/mo) | `Test@12345` |
| `gold.test@sports.com` | PLAYER | Gold (₹500/mo) | `Test@12345` |
| `coach_basic.test@sports.com` | COACH | Coach Basic (free) | `Test@12345` |
| `coach_platinum.test@sports.com` | COACH | Coach Platinum (₹1200/yr) | `Test@12345` |
| `admin@test.com` | ADMIN | — | `1234567890` |
| `coach@test.com` | COACH | — | `1234567890` |
| `player@test.com` | PLAYER | — | `1234567890` |

### Verify Setup

```bash
# Backend health check
curl http://localhost:8000/health

# Database connectivity
curl http://localhost:8000/db-health

# Frontend builds & runs without errors
cd frontend && npm run build
```

---

## Deployment

### Frontend Deployment (Vercel)

1. **Connect repository:**
   - Push code to GitHub
   - Import project in Vercel console
   - Select `frontend` as root directory

2. **Environment variables:**
   ```
   VITE_API_URL=https://sports-backend-xxxxx.a.run.app  (Cloud Run URL)
   ```

3. **Deploy:**
   Automatic on push to `main` branch.

### Backend Deployment (GCP Cloud Run)

#### Prerequisites

1. **GCP Project:** `sports-ai-489110`
2. **Enabled APIs:**
   - Cloud Build, Cloud Run, Artifact Registry
   - Cloud Storage, Cloud Tasks, Secret Manager

3. **Infrastructure setup (one-time):**
   ```bash
   # Create storage bucket
   gcloud storage buckets create gs://sports-ai-storage --location=asia-south1
   
   # Apply CORS policy
   gcloud storage buckets update gs://sports-ai-storage --cors-file=backend/gcs-cors.json
   
   # Create Cloud Tasks queue
   gcloud tasks queues create video-processing --location=asia-south1
   
   # Create secrets (one per secret)
   echo -n "postgresql://..." | gcloud secrets create DATABASE_URL --data-file=-
   echo -n "your-jwt-key" | gcloud secrets create JWT_SECRET_KEY --data-file=-
   echo -n "your-gemini-key" | gcloud secrets create GEMINI_API_KEY_1 --data-file=-
   # ... (repeat for other secrets in cloudbuild.yaml)
   ```

#### Deploy via Cloud Build

```bash
# From repo root, deploy backend
gcloud builds submit backend/ \
  --config=backend/cloudbuild.yaml \
  --project=sports-ai-489110 \
  --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD)
```

**What the pipeline does:**
1. Builds Docker image with static FFmpeg, Python 3.11, MediaPipe, ONNX runtime
2. Pushes to Artifact Registry with `$COMMIT_SHA` and `latest` tags
3. Deploys to Cloud Run (`sports-backend` service) in `asia-south1` with:
   - 2 CPUs, 4GB memory, CPU boost on cold start
   - 3600s timeout (for long video processing)
   - Concurrency: 4 requests per instance
   - Min instances: 0, Max instances: 3 (auto-scale)
4. Injects env vars and secrets from GCP Secret Manager

#### Background Worker Deployment

The platform uses a separate Cloud Run instance for resource-heavy background jobs (OCR, pose analysis).

**How it works:**
```
User triggers OCR job
  ↓
Backend creates HighlightJob record
  ↓
Backend enqueues task to Cloud Tasks
  ↓
Cloud Tasks webhook → POST /internal/worker/process-video
  ↓
Worker processes video (OCR, MediaPipe, FFmpeg)
  ↓
Updates DB with results
  ↓
Frontend polls and displays results
```

**Worker Deployment:**
```bash
# Option 1: Same image as main backend (included in cloudbuild.yaml)
# The worker Cloud Run service must have the same Docker image

# Option 2: Separate worker image (if using Dockerfile.worker)
gcloud builds submit backend/ \
  --config=backend/cloudbuild.yaml.worker \
  --project=sports-ai-489110

# Verify worker is running
gcloud run services list --platform=managed --region=asia-south1
# Look for: sports-backend-worker
```

**Monitoring Worker Jobs:**
```bash
# Check Cloud Tasks queue
gcloud tasks queues list --location=asia-south1

# View pending tasks
gcloud tasks list --queue=video-processing --location=asia-south1

# View Cloud Run logs for worker
gcloud run logs read sports-backend --region=asia-south1 --limit=50

# Manually trigger test job (dev)
curl -X POST https://sports-backend-xxxxx.a.run.app/internal/worker/process-video \
  -H "Content-Type: application/json" \
  -d '{
    "video_id": "test-video",
    "job_id": "test-job"
  }'
```

**Worker Configuration (in cloudbuild.yaml):**
```yaml
# Environment variables specific to worker
WORKER_MODE: "1"
MEDIAPIPE_DISABLE_GPU: "1"  # CPU-only (Cloud Run doesn't have GPU)
CLOUD_RUN: "1"               # Use /tmp/ instead of local storage
```

### Alternative: Render.com Deployment

1. **Configure in render.yaml:**
   ```yaml
   services:
     - type: web
       name: sports-backend
       runtime: docker
       dockerfilePath: ./backend/Dockerfile
       dockerContext: ./backend
   ```

2. **Push to GitHub + connect Render:**
   - Import repo in Render dashboard
   - Set environment variables
   - Deploy on push

---

## API Overview

### Base URL
- **Local:** `http://localhost:8000/api/v1`
- **Production:** `https://sports-backend-xxxxx.a.run.app/api/v1`

### Authentication
All endpoints (except `/auth/register`, `/auth/login`) require JWT Bearer token:
```bash
Authorization: Bearer <access_token>
```

### Major Endpoint Groups

#### 🔐 Authentication (`/auth`)
- `POST /auth/register` — Create account (PLAYER or COACH)
- `POST /auth/login` — Issue JWT
- `GET /auth/me` — Current user profile
- `PUT /auth/me` — Update profile
- `POST /auth/logout` — Invalidate token

#### 🎥 Videos (`/videos`)
- `POST /videos/upload` — Direct backend upload
- `POST /videos/upload/youtube` — YouTube URL ingestion
- `GET /videos/all` — List all videos (admin)
- `GET /videos/public` — Public video library
- `GET /videos/mine` — User's private videos
- `GET /videos/{id}` — Video metadata
- `GET /videos/{id}/stream` — Streaming playback
- `GET /videos/{id}/events` — Extracted highlight events
- `GET /videos/{id}/supercut` — Download supercut

#### 🔍 Highlight Jobs (`/jobs`)
- `POST /jobs/trigger` — Start OCR analysis
- `GET /jobs/{video_id}/status` — Polling status
- `GET /jobs/{video_id}/result` — Final events + supercut

#### 💪 Biomechanics (`/batting`, `/bowling`)
- `POST /batting/analyze` — Upload + analyze batting video
- `GET /batting/history` — User's batting analyses
- `GET /batting/{id}` — Specific analysis
- `GET /batting/{id}/report` — PDF report URL
- `POST /bowling/analyze` — Upload + analyze bowling video
- `GET /bowling/history` — User's bowling analyses
- `GET /bowling/{id}` — Specific analysis

#### 📨 Player Submissions (`/submissions`)
- `POST /submissions/upload` — Player submits to coach
- `GET /submissions/coach/me` — Coach inbox
- `GET /submissions/player/me` — Player's published reports
- `POST /submissions/{id}/analyze` — Coach triggers AI
- `PUT /submissions/{id}/publish` — Coach publishes report

#### 🏆 Coach Features (`/coach/*`)
- `GET /coach/submissions/inbox` — Submission inbox with filters
- `POST /annotations` — Add video annotation
- `GET /annotations/{video_id}` — Get annotations
- `POST /dashboard/players/invite` — Add player to dashboard
- `GET /dashboard/players` — Player roster

#### 💳 Subscriptions & Billing (`/subscriptions`, `/billing`)
- `POST /subscriptions/subscribe` — Create subscription
- `GET /subscriptions/user/{user_id}` — Check subscription status
- `POST /billing/create-order` — Razorpay order creation
- `GET /billing/usage` — Current quota usage

#### 👨‍💼 Admin (`/admin`, `/admin/plans`)
- `GET /admin/users` — List all users
- `PATCH /admin/users/{id}` — Edit user
- `PATCH /admin/users/{id}/subscription` — Force subscription change
- `GET /admin/plans` — List all plans
- `PATCH /admin/plans/{plan_key}` — Modify plan features

#### 💬 Community & Chat (`/chat`, `/requests`, `/notifications`)
- `POST /chat/message` — Send message
- `GET /chat/sessions` — User conversations
- `POST /requests/` — Create match request
- `POST /requests/{id}/vote` — Vote on request
- `GET /notifications` — User notifications

#### 📊 Analytics & Profile (`/player-stats`, `/profile`, `/performance`)
- `GET /player-stats` — Public player performance metrics
- `POST /profile/setup` — Initialize user profile
- `GET /profile/{user_id}/public` — Public profile view
- `GET /performance/metrics` — User analytics

#### 🔗 Storage & Uploads (`/storage`)
- `GET /storage/upload-url` — Get signed URL for direct GCS upload
- `POST /storage/confirm-upload` — Mark upload complete
- `POST /storage/resumable-session` — Start resumable upload

### Error Responses

All errors follow a consistent format:

```json
{
  "detail": "String error message or array of validation errors"
}
```

**Common HTTP Status Codes:**

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Request completed successfully |
| 201 | Created | Resource created (subscription, submission) |
| 400 | Bad Request | Invalid input, validation error |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | Insufficient permissions (not a coach) |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists (duplicate email) |
| 422 | Unprocessable Entity | Type validation error (Pydantic) |
| 429 | Too Many Requests | Rate limited (if implemented) |
| 500 | Server Error | Unexpected backend error |
| 503 | Service Unavailable | Cloud Run cold start / maintenance |

**Example Error Response:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "wrong@example.com", "password": "wrong"}'

# Response (401):
{
  "detail": "Invalid email or password"
}

# Another example (422 - validation):
{
  "detail": [
    {
      "loc": ["body", "password"],
      "msg": "ensure this value has at least 8 characters",
      "type": "value_error.string.too_short"
    }
  ]
}
```

---

## AI Pipeline

### OCR Highlight Detection

**Inputs:** Cricket match video (any resolution, 1080p optimal)

**Process:**
```
1. Frame Extraction (1 FPS)
   └─ Reduces compute: 1 frame/second vs. 30 fps
   
2. Scoreboard ROI Detection
   └─ Region of Interest: default x=240, y=940, w=170, h=80 (1080p)
   └─ Override via API for custom resolutions
   
3. RapidOCR-ONNX Text Recognition
   └─ No PyTorch dependency, lightweight (ONNX runtime)
   └─ Extracts score digits from ROI
   
4. Median Smoothing (Anti-Flicker)
   └─ Tracks last 5 frames in rolling deque
   └─ Uses MEDIAN (not mean) to ignore temporary spikes
   └─ Example: [98, 99, 100, 101, 102] → median=100 (stable)
   
5. Score Delta Detection
   └─ Compares current score vs. previous frame
   └─ Triggers on delta: +4 (FOUR), +6 (SIX), +0/+1 (WICKET)
   
6. Event Classification
   └─ Assigns timestamp and event type
   └─ High confidence filtering
   
7. FFmpeg Clip Extraction
   └─ Zero-copy cutting (no re-encoding)
   └─ Context windows: 2 sec before/after
   
8. Supercut Compilation
   └─ Concatenates all clips with transitions
   └─ Outputs MP4 to GCS
```

**Outputs:**
- Array of `HighlightEvent` (timestamp, event_type, score_delta)
- Supercut video file (GCS path)
- Processing status & progress

**Performance:**
- ~2–5 min per hour of video (depending on resolution, ROI complexity)
- Parallelizable: Multiple jobs on separate Cloud Run instances

### Batting Biomechanics Analysis

**Inputs:** Batting video (player performing shot)

**Process:**
```
1. MediaPipe Pose Loading
   └─ Loads 33-point pose model (CPU mode: MEDIAPIPE_DISABLE_GPU=1)
   └─ Tracks: shoulders, elbows, wrists, hips, knees, ankles, head
   
2. Frame-by-Frame Pose Tracking
   └─ Extracts joint coordinates for each frame
   └─ Normalizes to video resolution
   
3. Biomechanics Computation
   └─ Stance Angle: angle between shoulders and hips
   └─ Bat Lift Height: wrist height relative to shoulders
   └─ Follow-Through Quality: elbow extension post-shot
   └─ Front Foot Movement: hip displacement from setup
   └─ Back Knee Bend: angle between hip-knee-ankle
   
4. Flaw Detection
   └─ Compares metrics against optimal ranges
   └─ High elbow, late swing, poor foot movement → flagged
   └─ Severity: low/medium/high based on deviation
   
5. Drill Recommendations (AI)
   └─ Google Gemini API: generates targeted practice routines
   └─ Example: "High elbow → lower 90°, practice front-foot drives"
   
6. PDF Report Generation
   └─ ReportLab + Pillow: embed metrics, flaws, recommendations
   └─ Include key frames showing issues
   └─ Compare to previous analysis (if exists)
   
7. Storage & Notification
   └─ Upload PDF to GCS
   └─ Store BattingAnalysis record in DB
   └─ Notify user of completion
```

**Outputs:**
- `BattingAnalysis` record (metrics, flaws, recommendations)
- PDF report (GCS path)
- Analysis ID for history tracking

**Performance:**
- ~1–2 min per video (30 sec to 2 min depending on length)
- Pose inference: ~50–100 ms per frame
- PDF generation: ~20–30 sec

### Bowling Biomechanics Analysis

**Inputs:** Bowling action video (full run-up to delivery)

**Process:**
```
1. MediaPipe Pose Setup (same as batting)
   
2. Action Phase Detection
   └─ Identifies run-up start, delivery, follow-through
   └─ Uses frame-by-frame velocity of body points
   
3. Bowling Metrics Extraction
   └─ Run-up Speed: distance/time from start to crease
   └─ Release Height: hand position at release frame
   └─ Release Point Stability: variance across deliveries
   └─ Ball Speed Estimate: arm velocity scaled heuristic
   └─ Front Arm Alignment: angle between shoulders
   └─ Stride Length: hip displacement at release
   
4. Flaw Identification
   └─ Front arm drift, inconsistent release, poor alignment
   └─ Severity: low/medium/high
   
5. Action Classification
   └─ Determines bowling type: Fast/Medium/Spin
   └─ If fast: Seam/Swing/Bounce subtype
   └─ If spin: Off-spin/Leg-spin/Orthodox
   
6. Recommendations (AI)
   └─ Google Gemini: action-specific drills
   └─ Example: "Release variance 3cm → crease line practice"
   
7. PDF Generation & Storage
   └─ Same as batting workflow
```

**Outputs:**
- `BowlingAnalysis` record (metrics, flaws, action type, recommendations)
- PDF report
- Analysis ID

---

## Data Flow

### Video Upload → Supercut Generation

```
User (Frontend)
  ↓ POST /api/v1/videos/upload
  ↓ (multipart/form-data: file, title, description, match_date, etc.)
  ↓
FastAPI Backend (main.py)
  ↓ Validates JWT, parses metadata
  ↓ Generates signed URL via GCS service
  ↓
Browser
  ↓ Direct upload to GCS (signed URL)
  ↓ Notifies backend: POST /api/v1/storage/confirm-upload
  ↓
Backend
  ↓ Creates Video record (status: PENDING)
  ↓ Stores metadata in PostgreSQL
  ↓ Returns video_id to frontend
  ↓
Frontend
  ↓ Shows "Processing..." UI
  ↓ Polls GET /api/v1/jobs/{video_id}/status
  ↓
(User clicks "Trigger OCR")
  ↓ POST /api/v1/jobs/trigger {video_id, roi_override?}
  ↓
Backend
  ↓ Validates user quota (feature gate)
  ↓ Creates HighlightJob record (status: QUEUED)
  ↓ Enqueues task to Google Cloud Tasks
  ↓ Returns job_id to frontend
  ↓
Cloud Tasks
  ↓ HTTP POST to Worker Cloud Run instance
  ↓ Payload: {video_id, roi_override, job_id}
  ↓
Worker (background.py)
  ├─ Fetches video from GCS
  ├─ Extracts 1 FPS frames
  ├─ Runs OCR on ROI (RapidOCR-ONNX)
  ├─ Applies median smoothing
  ├─ Detects score deltas → events
  ├─ Uses FFmpeg to clip (0 copy)
  ├─ Concatenates clips → supercut
  ├─ Uploads supercut to GCS
  └─ Updates DB: HighlightJob status: COMPLETED, supercut_path
  ↓
Frontend (polling)
  ↓ Receives status: COMPLETED
  ↓ Displays: "Supercut ready!"
  ↓
User
  ↓ GET /api/v1/videos/{video_id}/supercut
  ↓ Browser downloads supercut MP4
```

### Player Submission → Coach Feedback → Report

```
Player (Frontend)
  ↓ POST /api/v1/submissions/upload {file, coach_id}
  ↓ Direct GCS upload (signed URL)
  ↓
Backend
  ├─ Creates PlayerSubmission (status: PENDING)
  └─ Notifies coach: submission added to inbox
  ↓
Coach (Frontend)
  ↓ GET /api/v1/submissions/coach/me
  ↓ Sees submission in inbox
  ↓
(Coach clicks "Analyze")
  ↓ POST /api/v1/submissions/{id}/analyze
  ↓
Backend
  ├─ Enqueues background job
  └─ Updates status: PROCESSING
  ↓
Worker
  ├─ Fetches video from GCS
  ├─ Runs MediaPipe pose analysis (batting or bowling)
  ├─ Generates metrics & flaws
  ├─ Calls Google Gemini for drill recommendations
  ├─ Returns structured analysis
  └─ Updates DB: PlayerSubmission status: DRAFT_REVIEW, analysis_json
  ↓
Backend
  └─ Notifies coach: "Analysis complete, ready for feedback"
  ↓
Coach (Frontend)
  ↓ Views AI analysis
  ↓ Edits feedback text manually
  ↓ POST /api/v1/submissions/{id}/publish {feedback_text, is_public}
  ↓
Backend
  ├─ Validates entitlement: pdf_report feature available?
  ├─ Calls ReportLab to generate PDF with metrics + feedback
  ├─ Uploads PDF to GCS
  ├─ Updates PlayerSubmission: status: PUBLISHED, pdf_url
  └─ Notifies player: "Report ready!"
  ↓
Player (Frontend)
  ↓ GET /api/v1/submissions/player/me
  ↓ Sees published report
  ↓ Downloads PDF
```

### Subscription Lifecycle

```
New User Registration
  ↓ POST /auth/register {email, password, role}
  ↓
Backend
  ├─ Creates User record
  ├─ Looks up FREE_PLAN_BY_ROLE: PLAYER → "bronze", COACH → "coach_basic"
  └─ Creates Subscription (plan_key: "bronze", expires_at: 30 days from now)
  ↓
Frontend
  ↓ User sees quota gates: "3 analyses/month (Bronze)"
  ↓
(User wants more capacity)
  ↓ POST /api/v1/subscriptions/subscribe {plan_key: "silver"}
  ↓
Backend
  ├─ Validates plan availability for role
  ├─ Calls Razorpay: create order (₹200 for 30 days)
  └─ Returns order_id + checkout URL
  ↓
Frontend
  ↓ Opens Razorpay checkout modal
  ↓ User completes payment
  ↓
Razorpay Webhook
  ├─ POST /api/v1/razorpay_webhook (signature verified)
  ├─ Payment successful → updates User subscription to "silver"
  ├─ Creates Transaction record (payment proof)
  └─ Notifies user: upgrade successful
  ↓
Frontend
  ↓ Refreshes entitlements (Zustand store)
  ↓ New quota: "15 analyses/month (Silver)"
  ↓
(Subscription expires after 30 days)
  ↓ Background job (subscription_expiry.py)
  ├─ Detects expired subscriptions
  ├─ Downgrades User to FREE tier (plan_key: "bronze")
  ├─ Creates new Subscription with 30-day expiry
  └─ Notifies user: "Subscription expired, downgraded to Free"
```

---

## Security

### Authentication & Authorization

- **JWT Tokens:** Signed with HS256 + SECRET_KEY (rotate in production)
- **Password Hashing:** bcrypt (cost 12, salted automatically)
- **Token Expiry:** 30 minutes (configurable via ACCESS_TOKEN_EXPIRE_MINUTES)
- **Refresh Tokens:** Optional additional layer (store in secure HTTP-only cookies)
- **Role-Based Access Control (RBAC):** PLAYER, COACH, ADMIN roles enforced at endpoint level

### Data Protection

- **Database:**
  - Passwords: Never stored in plaintext; always hashed with bcrypt
  - Connections: Encrypted via TLS to Supabase
  - Secrets: DATABASE_URL, API keys stored in GCP Secret Manager (never in `.env` files in repo)

- **File Storage:**
  - Signed URLs: Short-lived (default 1 hour), single-use per upload
  - Access Control: Private by default; public videos require explicit visibility flag
  - Encryption: GCS default server-side encryption (AES-256)

### API Security

- **CORS:** Restricted to frontend domain (configurable in `cors.json`)
- **CSRF Protection:** JWT-based (not vulnerable to CSRF like session cookies)
- **Rate Limiting:** Not currently implemented; can add via middleware (e.g., slowapi)
- **Input Validation:** Pydantic models validate all request data types, ranges, formats
- **SQL Injection:** SQLAlchemy ORM prevents injection via parameterized queries
- **XSS:** React auto-escapes JSX values by default; DOMPurify for user-generated HTML

### Cloud Platform Security

- **GCP IAM:** Service accounts with minimal required permissions (least privilege)
- **Secret Manager:** Centralized secret storage, audit-logged access
- **Signed URLs:** Restrict methods (GET only for downloads), expiry times
- **VPC:** (optional) Isolate Cloud Run from internet on private VPC

### Compliance

- **Audit Logging:** All admin actions logged to `admin_audit_log` table
- **User Consent:** Subscription terms accepted at signup
- **Data Retention:** No automatic data deletion (manual admin cleanup)

---

## Performance Optimizations

### Backend Optimizations

- **Async-First Architecture:** FastAPI with `async`/`await` reduces thread overhead
- **Connection Pooling:** SQLAlchemy async engine with pool_size=5, max_overflow=10
- **Database Indexing:** Indexes on frequently queried columns (user_id, video_id, created_at)
- **ORM Query Caching:** Custom TTL cache for entitlement resolution (cachetools library)
- **Static FFmpeg:** Self-contained binary, no system-wide installation required
- **Zero-Copy Video Clipper:** FFmpeg with `-c copy` (no re-encoding) for instant cuts
- **Lazy Model Loading:** MediaPipe and OCR models loaded on-demand, cached in memory
- **Batch Processing:** OCR processes 1 FPS (vs. 30 FPS), 30× speedup
- **Median Smoothing:** Reduces false positives, fewer redundant frames processed

### Frontend Optimizations

- **Code Splitting:** Vite automatically chunks routes for lazy loading
- **Image Optimization:** Lucide icons (SVG-based), minimal bundle size
- **State Management:** Zustand (lightweight vs. Redux)
- **Memoization:** React.memo for expensive component re-renders
- **Streaming:** Video playback via signed URL (no full download before play)
- **Resumable Uploads:** Mux Upchunk resumes on network failure (no restart)
- **CDN Delivery:** Vercel global edge network caches static assets

### Cloud Infrastructure Optimizations

- **Cloud Run Auto-Scaling:**
  - Min instances: 0 (scale to zero when idle)
  - Max instances: 3 (cap costs)
  - Concurrency per instance: 4 (balance latency vs. resource use)

- **Artifact Registry Layer Caching:**
  - Docker build cache preserves Python dependency layer (~2 GB)
  - Subsequent builds skip re-pip-installing
  - CloudBuild flag: `--cache-from $_IMAGE:latest`

- **Cloud Tasks Batching:**
  - Accumulate jobs into batches, dispatch during off-peak
  - Reduces queue churn

### Database Optimizations

- **Connection Pooling:** PgBouncer on Supabase (connection multiplexing)
- **Query Analysis:** `EXPLAIN ANALYZE` to find slow queries
- **Partial Indexes:** For filtering on (status='COMPLETED', created_at>date)
- **Materialized Views:** (optional) for analytics dashboards

### Caching Strategies

- **Frontend:**
  - React Query caching of API responses (TTL configurable)
  - LocalStorage for non-sensitive user preferences

- **Backend:**
  - In-memory entitlement cache (TTL 5 min, cachetools)
  - Redis (optional) for session store

---

## Current Status

### ✅ Implemented & Production-Ready

- **Core Video Pipeline:**
  - Video upload (direct + YouTube)
  - OCR highlight detection
  - Supercut generation

- **Biomechanics Analysis:**
  - Batting analysis (MediaPipe + metrics)
  - Bowling analysis (pose tracking + action classification)
  - PDF report generation

- **Subscription Management:**
  - Dynamic entitlement engine (DB-driven)
  - Razorpay payment integration
  - Plan/feature configuration
  - Usage quota tracking

- **Coach Features:**
  - Player submission inbox
  - Training plan management
  - Session scheduling
  - Availability calendar
  - Video annotations
  - CSV export

- **User Features:**
  - Authentication (JWT)
  - Profile management
  - Scouting visibility
  - Chat messaging
  - Notifications
  - Gamification (streaks, badges)

- **Admin Dashboard:**
  - User management
  - Plan configuration
  - Audit logging
  - Coach verification
  - Usage analytics

- **Community Features:**
  - Match request voting
  - Public video library
  - Leaderboards

### 📌 Roadmap

- **Multi-Language Support:** i18n framework
- **Mobile Apps:** React Native or Flutter
- **Franchise Integration:** Scout-to-team workflows
- **Live Streaming Analytics:** Real-time pose tracking during matches
- **Video Recommendations:** ML-based content discovery with training data
- **Advanced Pose Comparison:** Side-by-side professional benchmark matching
- **Federated Learning:** Privacy-preserving model improvements across users

---

## Testing

### Backend Tests

**Install test dependencies:**
```bash
cd backend
pip install -r requirements-test.txt
```

**Run all tests:**
```bash
pytest
```

**Run tests with coverage:**
```bash
pytest --cov=. --cov-report=html
# Opens htmlcov/index.html in browser
```

**Run specific test file:**
```bash
pytest tests/test_auth.py -v
```

**Run tests matching pattern:**
```bash
pytest -k "test_upload" -v
```

**Run async tests (includes cloud tasks, database operations):**
```bash
pytest tests/test_jobs.py -v -s
```

**Test Configuration:**
- **Pytest config:** `backend/pytest.ini` or `pyproject.toml`
- **Fixtures:** Shared test utilities in `tests/conftest.py`
- **Database:** Uses SQLite in-memory by default (fast, isolated)
- **Mocking:** Cloud Storage, Cloud Tasks mocked via `pytest-mock`

**Test Organization:**
```
backend/tests/
├── conftest.py           # Shared fixtures, database setup
├── test_auth.py          # Authentication tests
├── test_videos.py        # Video CRUD tests
├── test_jobs.py          # OCR job lifecycle tests
├── test_submissions.py   # Player submission workflow
├── test_biomechanics.py  # Batting/bowling analysis
└── data/                 # Test fixtures (sample videos, data)
```

### Frontend Tests

**Run tests:**
```bash
cd frontend
npm run test
```

**Run tests in watch mode (dev):**
```bash
npm run test -- --watch
```

**Generate coverage:**
```bash
npm run test -- --coverage
```

**Test files match components:**
```
src/
├── components/
│   ├── VideoUpload.tsx
│   └── VideoUpload.test.tsx    # Test file co-located
```

### Integration Testing (Local)

**Full stack local test:**
```bash
# Terminal 1: Backend
cd backend && uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Run integration tests
cd backend && pytest tests/integration/

# Test flow: Frontend POST → Backend → Database → Response
```

### Pre-commit Hooks

The project uses Husky + lint-staged for automatic checks:

```bash
# Husky runs on git commit:
# 1. Backend: Black formatter + Flake8 linter
# 2. Frontend: ESLint + Prettier

# Install hooks (automatic on npm install):
npm install

# Run manually:
npm run lint-staged
```

**Bypass hooks (dev only, not recommended):**
```bash
git commit --no-verify
```

---

## Contributing

### Getting Started

1. **Fork and clone:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/sports.git
   cd sports
   git remote add upstream https://github.com/almanet26/sports.git
   ```

2. **Create feature branch:**
   ```bash
   git checkout -b feat/your-feature-name
   # or: bug/issue-description
   # or: docs/update-readme
   ```

3. **Make changes and test:**
   ```bash
   # Backend: add tests in tests/
   # Frontend: add tests co-located with components
   pytest                    # Backend tests
   npm run test             # Frontend tests
   npm run lint             # Code quality
   ```

4. **Commit with conventional commits:**
   ```bash
   git commit -m "feat(auth): add passwordless login"
   # Types: feat, fix, docs, refactor, test, chore, perf
   ```

5. **Push and create PR:**
   ```bash
   git push origin feat/your-feature-name
   # Create PR on GitHub with description
   ```

### Code Style & Standards

**Backend (Python):**
- **Formatter:** Black (line length: 100)
- **Linter:** Flake8
- **Type hints:** Required (mypy checking)
- **Docstrings:** Google-style for public APIs

**Frontend (TypeScript):**
- **Formatter:** Prettier
- **Linter:** ESLint + typescript-eslint
- **Type checking:** TypeScript strict mode
- **Component patterns:** Functional components + hooks

**Run locally before commit:**
```bash
# Backend
black backend/
flake8 backend/

# Frontend
npm run lint
npm run lint -- --fix  # Auto-fix
```

### Development Workflow

**Branch Strategy:**
- `main` — Stable production code, protected branch
- `dev` (optional) — Integration branch for features
- `feat/*` — Feature branches
- `fix/*` — Bug fix branches
- `docs/*` — Documentation updates

**PR Requirements:**
- ✅ Tests pass (GitHub Actions)
- ✅ No merge conflicts
- ✅ Code review approval (2+ reviewers for features)
- ✅ Conventional commit messages
- ✅ Documentation updated (if applicable)

**PR Description Template:**
```markdown
## Description
Brief summary of changes

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation update

## Testing
How to test this change? Include reproduction steps.

## Screenshots (if UI change)
[Add screenshots]

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
```

### Adding a New Feature

**Example: Add new biomechanics metric**

1. **Backend:**
   ```python
   # 1. Add model (backend/database/models/batting.py)
   class BattingAnalysis(Base):
       new_metric: float
   
   # 2. Create migration
   alembic revision --autogenerate -m "add batting new_metric"
   alembic upgrade head
   
   # 3. Add calculation (backend/src/engine/batting_engine.py)
   def calculate_new_metric(pose_data):
       return computed_value
   
   # 4. Write test (backend/tests/test_biomechanics.py)
   def test_new_metric():
       assert calculate_new_metric(sample_data) == expected
   
   # 5. Update API schema (backend/schemas/batting.py)
   class BattingAnalysisResponse(BaseModel):
       new_metric: float
   ```

2. **Frontend:**
   ```typescript
   // 1. Update types (frontend/src/types/analysis.ts)
   export interface BattingAnalysis {
       newMetric: number;
   }
   
   // 2. Update component (frontend/src/components/BattingResults.tsx)
   function BattingResults({ analysis }: Props) {
       return <div>Metric: {analysis.newMetric}</div>;
   }
   
   // 3. Add test (frontend/src/components/BattingResults.test.tsx)
   describe('BattingResults', () => {
       it('displays new metric', () => {
           // ...
       });
   });
   ```

3. **Documentation:**
   ```bash
   # Update docs/FEATURES.md with new metric
   # Update schema in docs/DATABASE_SCHEMA.md
   # Update API docs comment in backend
   ```

### Commit Message Convention

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation only
- `refactor` — Code restructuring (no behavior change)
- `perf` — Performance improvement
- `test` — Test additions/fixes
- `chore` — Build, CI, dependencies

**Examples:**
```
feat(batting): add elbow angle metric
fix(ocr): handle scoreboard glare in low light
docs(setup): clarify PostgreSQL prerequisites
perf(worker): batch OCR requests for 3x speedup
```

### PR Review Checklist

**Reviewers check:**
- ✅ Code correctness and logic
- ✅ Test coverage (>70% for new code)
- ✅ Performance implications
- ✅ Security (no SQL injection, XSS, secrets exposed)
- ✅ Documentation accuracy
- ✅ Backward compatibility
- ✅ Error handling & edge cases

---

## API Examples

### Authentication

**Register:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player@example.com",
    "password": "SecurePass123!",
    "role": "PLAYER"
  }'

# Response:
{
  "id": "user-uuid",
  "email": "player@example.com",
  "role": "PLAYER",
  "subscription_plan": "bronze"
}
```

**Login:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player@example.com",
    "password": "SecurePass123!"
  }'

# Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

**Get Current User:**
```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer {access_token}"

# Response:
{
  "id": "user-uuid",
  "email": "player@example.com",
  "role": "PLAYER",
  "subscription_plan": "silver",
  "created_at": "2026-07-01T10:00:00Z"
}
```

### Video Operations

**Upload Video (get signed URL first):**
```bash
# Step 1: Get upload URL
curl -X GET http://localhost:8000/api/v1/storage/upload-url \
  -H "Authorization: Bearer {access_token}" \
  -d '{"filename": "match_video.mp4", "content_type": "video/mp4"}'

# Response:
{
  "upload_url": "https://storage.googleapis.com/...",
  "blob_path": "uploads/user-uuid/match_video.mp4"
}

# Step 2: Upload directly to GCS (browser or curl)
curl -X PUT "{signed_upload_url}" \
  -H "Content-Type: video/mp4" \
  --data-binary @match_video.mp4

# Step 3: Confirm upload
curl -X POST http://localhost:8000/api/v1/storage/confirm-upload \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "blob_path": "uploads/user-uuid/match_video.mp4",
    "title": "India vs Pakistan T20",
    "description": "Match highlights",
    "match_date": "2026-07-01",
    "teams": "India, Pakistan",
    "venue": "Mumbai",
    "visibility": "private"
  }'

# Response:
{
  "video_id": "video-uuid",
  "status": "PROCESSING",
  "blob_path": "uploads/user-uuid/match_video.mp4"
}
```

**Trigger OCR Analysis:**
```bash
curl -X POST http://localhost:8000/api/v1/jobs/trigger \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "video_id": "video-uuid",
    "roi_override": {
      "x": 240,
      "y": 940,
      "width": 170,
      "height": 80
    }
  }'

# Response:
{
  "job_id": "job-uuid",
  "video_id": "video-uuid",
  "status": "QUEUED",
  "created_at": "2026-07-01T10:30:00Z"
}
```

**Poll Job Status:**
```bash
curl -X GET http://localhost:8000/api/v1/jobs/video-uuid/status \
  -H "Authorization: Bearer {access_token}"

# Response (while processing):
{
  "job_id": "job-uuid",
  "status": "PROCESSING",
  "progress_percent": 45,
  "phase": "Extracting clips...",
  "events_found": 12
}

# Response (completed):
{
  "job_id": "job-uuid",
  "status": "COMPLETED",
  "progress_percent": 100,
  "events": [
    {
      "timestamp": 120.5,
      "event_type": "SIX",
      "score_delta": 6,
      "confidence": 0.95
    },
    {
      "timestamp": 145.2,
      "event_type": "WICKET",
      "score_delta": 0,
      "confidence": 0.87
    }
  ],
  "supercut_url": "gs://sports-ai-storage/highlights/video-uuid.mp4",
  "processing_time_seconds": 187
}
```

### Biomechanics Analysis

**Batting Analysis (upload & analyze):**
```bash
curl -X POST http://localhost:8000/api/v1/batting/analyze \
  -H "Authorization: Bearer {access_token}" \
  -F "file=@batting_video.mp4"

# Response:
{
  "id": "analysis-uuid",
  "status": "PROCESSING",
  "created_at": "2026-07-01T11:00:00Z",
  "estimated_completion_seconds": 120
}

# Poll for results
curl -X GET http://localhost:8000/api/v1/batting/analysis-uuid \
  -H "Authorization: Bearer {access_token}"

# When complete:
{
  "id": "analysis-uuid",
  "created_at": "2026-07-01T11:00:00Z",
  "status": "COMPLETED",
  "biometrics": {
    "stance_angle": 45.2,
    "bat_lift_height": 120,
    "follow_through_quality": "good",
    "front_foot_movement": 0.85,
    "back_knee_bend": 32.5
  },
  "detected_flaws": [
    {
      "flaw": "High elbow position",
      "severity": "high",
      "frames": [45, 46, 47],
      "correction": "Lower elbow to 90 degrees"
    }
  ],
  "drill_recommendations": [
    "Front-foot drive drills",
    "Shadow batting 10 min daily"
  ],
  "video_url": "gs://sports-ai-storage/batting_videos/...",
  "pdf_report_url": "gs://sports-ai-storage/reports/..."
}
```

### Subscription Management

**Check Current Subscription:**
```bash
curl -X GET http://localhost:8000/api/v1/subscriptions/user/{user_id} \
  -H "Authorization: Bearer {access_token}"

# Response:
{
  "plan_key": "silver",
  "display_name": "Silver",
  "started_at": "2026-06-01T00:00:00Z",
  "expires_at": "2026-07-01T00:00:00Z",
  "status": "active",
  "usage": {
    "biomechanics_analysis": { "used": 8, "limit": 15 },
    "player_submission": { "used": 2, "limit": 5 }
  }
}
```

**Create Subscription:**
```bash
curl -X POST http://localhost:8000/api/v1/subscriptions/subscribe \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_key": "gold"
  }'

# Response:
{
  "order_id": "razorpay_order_id",
  "amount_inr": 50000,
  "currency": "INR",
  "checkout_url": "https://checkout.razorpay.com/?key=...",
  "created_at": "2026-07-01T12:00:00Z"
}
```

### Player Submissions

**Upload Submission:**
```bash
curl -X POST http://localhost:8000/api/v1/submissions/upload \
  -H "Authorization: Bearer {player_token}" \
  -F "file=@my_batting.mp4" \
  -F "coach_id=coach-uuid" \
  -F "title=Coaching Request" \
  -F "description=Review my batting stance"

# Response:
{
  "submission_id": "submission-uuid",
  "status": "PENDING",
  "coach_id": "coach-uuid",
  "created_at": "2026-07-01T13:00:00Z"
}
```

**Coach Analyzes Submission:**
```bash
curl -X POST http://localhost:8000/api/v1/submissions/submission-uuid/analyze \
  -H "Authorization: Bearer {coach_token}"

# Response:
{
  "submission_id": "submission-uuid",
  "status": "PROCESSING",
  "analysis_started_at": "2026-07-01T13:05:00Z"
}
```

**Coach Publishes Feedback:**
```bash
curl -X PUT http://localhost:8000/api/v1/submissions/submission-uuid/publish \
  -H "Authorization: Bearer {coach_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "feedback_text": "Great footwork! Work on your backswing.",
    "is_public": false
  }'

# Response:
{
  "submission_id": "submission-uuid",
  "status": "PUBLISHED",
  "pdf_report_url": "gs://sports-ai-storage/reports/submission-uuid.pdf",
  "published_at": "2026-07-01T13:15:00Z"
}
```

---

## Environment Variables Reference

### Backend (`.env`)

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/sports_db` |
| `SECRET_KEY` | JWT signing key (32+ chars) | `your-secret-key-here` (use `secrets.token_urlsafe(32)`) |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT expiry time | `30` |

#### GCP Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_CLOUD_PROJECT` | GCP project ID | `sports-ai-489110` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON | `/path/to/service-account.json` |
| `GCS_BUCKET_NAME` | Cloud Storage bucket | `sports-ai-storage` |
| `CLOUD_RUN` | Set to `1` when deployed on Cloud Run | `0` (local), `1` (production) |

#### API Keys

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_GEMINI_API_KEY` | Google Gemini API key for AI feedback | `AIzaSy...` |
| `RAZORPAY_KEY_ID` | Razorpay public key | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay secret key | `[hidden]` |

#### Optional Features

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_COACH_SUBMISSIONS` | Enable player→coach submission flow | `true` |
| `ENABLE_AI_FEEDBACK` | Enable Gemini-powered feedback generation | `true` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | Frontend URL |

#### Generate a Secure SECRET_KEY

```python
import secrets
print(secrets.token_urlsafe(32))
# Output: Drmhze6EPcv0fN_81Bj-nA (or similar)
```

### Frontend (`.env.local`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000` |
| `VITE_BACKEND_PORT` | Backend port (for dev server) | `8000` |

### Cloud Run Deployment

See `backend/cloudbuild.yaml` for secrets injected at deploy time:
- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `GEMINI_API_KEY_1`, `_2`, `_3` (rotated keys)
- `YOUTUBE_COOKIES_B64` (for yt-dlp)
- `YOUTUBE_PO_TOKEN` (for yt-dlp)

---

## Troubleshooting

### Common Issues

#### Backend won't start: "ModuleNotFoundError: No module named 'mediapipe'"

**Cause:** MediaPipe dependencies missing (GUI libraries on headless systems)

**Solution:**
```bash
# Install required libraries (Linux/Debian)
apt-get install -y libglib2.0-0 libsm6 libxext6 libxrender1 libgl1

# Set environment variable
export MEDIAPIPE_DISABLE_GPU=1

# Restart backend
uvicorn main:app --reload
```

#### OCR detection returns no events

**Cause:** ROI (Region of Interest) doesn't match scoreboard location

**Solution:**
1. Run ROI calibrator script (if available):
   ```bash
   python scripts/roi_calibrator.py --video_path path/to/video.mp4
   ```
2. Use API to override ROI:
   ```bash
   POST /api/v1/jobs/trigger
   {
     "video_id": "xxx",
     "roi_override": {
       "x": 200,
       "y": 900,
       "width": 200,
       "height": 100
     }
   }
   ```

#### PDF generation fails: "ReportLab canvas error"

**Cause:** Missing Pillow or font libraries

**Solution:**
```bash
pip install --upgrade Pillow reportlab
# Ensure fonts available:
apt-get install fonts-liberation  # Linux
```

#### Cloud Run deployment fails: "Container failed to start"

**Cause:** Environment secrets missing or incorrect

**Solution:**
```bash
# Verify secrets exist in Secret Manager
gcloud secrets list

# Check logs
gcloud run logs read sports-backend --limit=50 --region=asia-south1

# Re-deploy with explicit secret injection
gcloud run deploy sports-backend \
  --image=asia-south1-docker.pkg.dev/sports-ai-489110/sports-backend/api:latest \
  --update-secrets=DATABASE_URL=DATABASE_URL:latest,JWT_SECRET_KEY=JWT_SECRET_KEY:latest
```

#### Frontend can't reach backend: "CORS error" or "Failed to fetch"

**Cause:** Frontend and backend URLs mismatch

**Solution:**
1. Check `VITE_API_URL` in `.env.local`:
   ```env
   VITE_API_URL=http://localhost:8000  # Local dev
   # OR
   VITE_API_URL=https://sports-backend-xxxxx.a.run.app  # Production
   ```

2. Verify backend CORS config (`backend/config/cors.json`):
   ```json
   [{"origin": ["https://sports-teal-two.vercel.app"], "method": ["GET", "POST", ...], ...}]
   ```

3. Test CORS headers:
   ```bash
   curl -i -X OPTIONS http://localhost:8000/api/v1/health \
     -H "Origin: http://localhost:5173"
   ```

#### Razorpay webhook fails: "Signature verification failed"

**Cause:** Webhook secret doesn't match Razorpay dashboard

**Solution:**
1. Retrieve secret from Razorpay dashboard → Settings → API Keys → Webhooks
2. Set in backend:
   ```env
   RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
   ```
3. Re-deploy backend

#### Database migration conflicts: "Alembic migration error"

**Cause:** Local schema diverged from migration history

**Solution:**
```bash
# Inspect current migration head
alembic current

# View migration history
alembic history --verbose

# If local DB is corrupted, reset (dev only!)
# DO NOT RUN ON PRODUCTION
alembic downgrade base
alembic upgrade head
```
---

**Last Updated:** July 6, 2026  
**Maintained By:** [Aaryan Sharma](https://github.com/Aaryan-Sharma-5/) 
**Documentation:** [/docs](./docs/) directory
 