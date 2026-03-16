# Backend API Reference (Updated)

A comprehensive guide to all API endpoints in the Cricket Analytics Platform.

---

## 📁 Project Structure

```
backend/
├── main.py                      # FastAPI entry point with lifespan handlers
├── requirements.txt             # Python dependencies
├── .env                         # Environment variables (create from .env.example)
│
├── api/
│   └── routes/
│       ├── auth.py              # Authentication (register, login, refresh)
│       ├── videos.py            # Video upload, library, events, streaming
│       ├── jobs.py              # OCR processing & job management
│       ├── requests.py          # Match request voting system
│       ├── batting.py           # Batting biomechanics analysis (MediaPipe)
│       ├── bowling.py           # Bowling biomechanics analysis (MediaPipe)
│       ├── submissions.py       # Player→Coach video submissions workflow
│       ├── admin_coaches.py     # Coach verification & management
│       ├── players.py           # Player profile & statistics
│       ├── player_stats.py      # Aggregated player performance stats
│       ├── plan.py              # Subscription plan management
│       ├── subscription.py      # User subscription lifecycle
│       ├── storage.py           # GCP Cloud Storage signed URLs
│       ├── worker.py            # Background task webhooks (Cloud Tasks)
│       ├── notification.py      # Push notifications & alerts
│       ├── match.py             # Match metadata & management
│       └── __init__.py          # Route registration
│
├── database/
│   ├── config.py                # SQLAlchemy & session management
│   ├── models/
│   │   ├── user.py              # User (with subscription, coach fields)
│   │   ├── session.py           # UserSession, ProcessingJob
│   │   ├── video.py             # Video, HighlightEvent, HighlightJob
│   │   ├── submission.py        # VideoSubmission, SubmissionFeedback
│   │   ├── batting.py           # BattingAnalysis tracking
│   │   ├── bowling.py           # BowlingAnalysis tracking
│   │   ├── match.py             # Match metadata
│   │   ├── plan.py              # SubscriptionPlan
│   │   └── __init__.py
│   └── crud/
│       ├── user.py
│       ├── batting.py
│       ├── bowling.py
│       ├── submission.py
│       └── ...
│
├── schemas/
│   ├── auth.py                  # Auth request/response models
│   ├── video.py                 # Video upload/library schemas
│   ├── batting.py               # Batting analysis schemas
│   ├── bowling.py               # Bowling analysis schemas
│   ├── submission.py            # Submission workflow schemas
│   ├── plan_schema.py           # Subscription schemas
│   └── ...
│
├── services/
│   └── ocr_task.py              # Background OCR task executor
│
├── scripts/
│   ├── ocr_engine.py            # Core OCR event detection (4s, 6s, Wickets)
│   ├── batting_engine.py        # MediaPipe batting pose tracking
│   ├── bowling_engine.py        # MediaPipe bowling pose tracking
│   ├── roi_calibrator.py        # Scoreboard ROI calibration
│   └── ...
│
└── utils/
    ├── auth.py                  # JWT utilities, role-based dependencies
    ├── config.py                # Settings & environment management
    ├── youtube.py               # YouTube URL validation & yt-dlp integration
    └── ...
```

---

## 🔑 API Endpoints

### 1. Authentication (`/api/v1/auth`)

| Method | Endpoint | Access | Authentication | Description |
|--------|----------|--------|---|---|
| POST | `/register` | Public | None | Register new user (PLAYER, COACH) with optional coach document upload |
| POST | `/login` | Public | None | Login with email/password (returns access + refresh tokens) |
| POST | `/refresh` | Auth | Refresh Token | Refresh access token without re-login |
| GET | `/me` | Auth | Bearer Token | Get current user profile + subscription status |
| POST | `/logout` | Auth | Bearer Token | Invalidate current session |

---

### 2. Videos (`/api/v1/videos`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/upload` | ADMIN, COACH | Upload cricket match video with metadata |
| GET | `/public` | Public | Browse public highlight library (paginated) |
| GET | `/private` | AUTH | List user's private uploaded videos |
| GET | `/{id}` | Auth | Get detailed video info + event summary |
| GET | `/{id}/events` | Auth | List events with optional filtering (4s, 6s, Wickets) |
| GET | `/{id}/stream` | Auth | Stream video file (supports range requests) |
| GET | `/{id}/supercut` | Auth | Download generated highlight reel (supercut) |
| POST | `/{id}/publish` | ADMIN | Move private → public library |
| DELETE | `/{id}` | ADMIN | Delete video & associated events |

---

### 3. Jobs (OCR Processing) (`/api/v1/jobs`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/trigger` | ADMIN, COACH | Start OCR analysis on uploaded video |
| GET | `/{video_id}/status` | Auth | Get job progress (% complete, current phase) |
| GET | `/{video_id}/result` | Auth | Get final analysis (events, timestamps, supercut path) |
| POST | `/{video_id}/retry` | ADMIN, COACH | Restart failed OCR analysis |
| GET | `/pending` | ADMIN | List all videos awaiting processing |
| GET | `/stats` | ADMIN | System-wide OCR statistics |

---

### 4. Batting Biomechanics (`/api/v1/batting`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/analyze` | PLAYER | Upload batting video for MediaPipe pose analysis |
| GET | `/list` | PLAYER | List user's batting analysis history |
| GET | `/{id}` | PLAYER | Get detailed batting analysis report |
| GET | `/{id}/pdf` | PLAYER | Download PDF report with recommendations |

---

### 5. Bowling Biomechanics (`/api/v1/bowling`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/analyze` | PLAYER | Upload bowling video for MediaPipe pose analysis |
| GET | `/list` | PLAYER | List user's bowling analysis history |
| GET | `/{id}` | PLAYER | Get detailed bowling analysis report |
| GET | `/{id}/pdf` | PLAYER | Download PDF report with recommendations |

---

### 6. Submissions (Player→Coach) (`/api/v1/submissions`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/upload` | PLAYER | Upload video + select coach (→ PENDING) |
| GET | `/player/me` | PLAYER | My published reports (PLAYER view) |
| GET | `/coach/me` | COACH | Inbox (PENDING + DRAFT_REVIEW submissions) |
| POST | `/{id}/analyze` | COACH | Trigger analysis → PROCESSING → DRAFT_REVIEW |
| PUT | `/{id}/publish` | COACH | Approve feedback + generate PDF → PUBLISHED |
| GET | `/{id}` | Auth | Get submission detail |
| GET | `/coaches` | PLAYER | List available coaches for dropdown |

---

### 7. Match Requests (Community Voting) (`/api/v1/requests`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | PLAYER | Create new request OR vote on existing |
| GET | `/` | Public | List requests sorted by vote count |
| POST | `/{id}/vote` | PLAYER | Vote for a request (increment count) |
| DELETE | `/{id}/vote` | PLAYER | Remove vote |
| GET | `/admin/dashboard` | ADMIN | Admin request dashboard (sorted, filterable) |
| PATCH | `/{id}/status` | ADMIN | Update request status (PENDING → FULFILLED) |

---

### 8. Admin Coach Management (`/api/v1/admin_coaches`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/pending` | ADMIN | List pending coach verification requests |
| POST | `/{coach_id}/approve` | ADMIN | Approve coach (update coach_status → APPROVED) |
| POST | `/{coach_id}/reject` | ADMIN | Reject coach (coach_status → REJECTED) |
| GET | `/` | ADMIN | List all coaches with status |

---

### 9. Player Profiles & Stats (`/api/v1/players`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/{player_id}` | Public | Get player public profile |
| GET | `/{player_id}/stats` | Public | Aggregated player statistics |
| GET | `/me` | PLAYER | Get own profile |
| PUT | `/me` | PLAYER | Update own profile (name, phone, team) |

---

### 10. Subscription Plans (`/api/v1/plan`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Public | List available subscription plans |
| GET | `/{plan_id}` | Public | Get plan details |

---

### 11. User Subscription (`/api/v1/subscription`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/upgrade` | PLAYER | Upgrade to COACH plan (premium) |
| POST | `/downgrade` | COACH | Downgrade to PLAYER (free) |
| GET | `/me` | Auth | Get current user's subscription status |
| POST | `/{subscription_id}/cancel` | Auth | Cancel subscription |

---

### 12. Cloud Storage Signed URLs (`/api/v1/storage`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/signed-url` | COACH | Generate signed URL for direct GCS upload (batsman/bowler videos) |
| GET | `/gcs-status` | Admin | Check GCS connectivity & bucket status |

---

### 13. Background Task Webhooks (`/api/v1/worker`)

- **Endpoint:** `POST /worker/ocr-complete`
- **Called By:** Google Cloud Tasks (after OCR finishes)
- **Purpose:** Update video status + notify user once processing completes

---

### 14. Notifications (`/api/v1/notification`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Auth | List user's notifications |
| POST | `/{id}/read` | Auth | Mark notification as read |
| DELETE | `/{id}` | Auth | Delete notification |

---

## 👥 User Roles & Permissions Matrix (Updated)

| Capability | PLAYER (Free) | COACH (Premium) | ADMIN |
|------------|:-------------:|:---------------:|:-----:|
| Browse public library | ✅ | ✅ | ✅ |
| Filter highlights | ✅ | ✅ | ✅ |
| Stream videos | ✅ | ✅ | ✅ |
| Download clips | ❌ | ✅ | ✅ |
| Request match | ✅ | ✅ | ❌ |
| Vote on requests | ✅ | ✅ | ❌ |
| Upload video (private) | ❌ | ✅ | ✅ (public) |
| Trigger OCR | ❌ | ✅ | ✅ |
| Private dashboard | ❌ | ✅ | ❌ |
| Publish to public | ❌ | ✅ | ❌ |
| Batting analysis | ✅ | ✅ | ✅ |
| Bowling analysis | ✅ | ✅ | ✅ |
| Upload to coach | ✅ | ✅ | ❌ |
| Coach dashboard | ❌ | ✅ | ❌ |
| Admin dashboard | ❌ | ❌ | ✅ |
| Verify coaches | ❌ | ❌ | ✅ |

---

## 🔐 Authentication

All protected endpoints require a **Bearer Token** in the Authorization header:

```bash
Authorization: Bearer <access_token>
```

**Token Lifecycle:**
- **Access Token:** 30 minutes (JWT, short-lived)
- **Refresh Token:** 7 days (stored in DB, can be revoked)

## 🚀 Quick Start

### 1. Local Development

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
pip install -r requirements.txt
cp .env.example .env
```

### 2. Database

```bash
# SQLAlchemy auto-create (dev mode)
python -c "from database.config import Base, engine; from database.models import *; Base.metadata.create_all(bind=engine)"
```

### 3. Start Server

```bash
python main.py
# API docs: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
```

---

## 📝 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/sports

# JWT
SECRET_KEY=your-super-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Storage
STORAGE_RAW_PATH=storage/raw
STORAGE_TRIMMED_PATH=storage/trimmed

# GCP (if using Cloud Storage)
GCP_PROJECT_ID=sports-ai-489110
GCS_BUCKET_NAME=sports-ai-storage

# Gemini AI (for reports)
GEMINI_API_KEY=your-key

# Stripe (future)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 📊 Database Models

### User
```python
id: UUID
email: str (unique)
password_hash: str
name: str
role: str  # PLAYER, COACH, ADMIN
phone: str (optional)
team: str (optional)
subscription_plan: str  # BASIC, PREMIUM, COACH
coach_status: str  # pending, approved, rejected
coach_document_url: str (optional)
stripe_customer_id: str (optional)
is_active: bool
created_at: datetime
updated_at: datetime
```

### Video
```python
id: UUID
title: str
description: str (optional)
file_path: str  # Local path or GCS URI
status: str  # processing, failed, completed
visibility: str  # public, private
total_fours: int
total_sixes: int
total_wickets: int
uploaded_by: UUID (FK → User)
match_date: datetime (optional)
created_at: datetime
updated_at: datetime
```

### HighlightEvent
```python
id: UUID
video_id: UUID (FK → Video)
event_type: str  # FOUR, SIX, WICKET
timestamp_seconds: float
score_before: int
score_after: int
clip_path: str  # Path to extracted clip
created_at: datetime
```

### BattingAnalysis
```python
id: UUID
user_id: UUID (FK → User)
video_path: str
biometrics: JSON
detected_flaws: JSON
drill_recommendations: list
pdf_report_url: str (optional)
created_at: datetime
```

### BowlingAnalysis
```python
id: UUID
user_id: UUID (FK → User)
video_path: str
biometrics: JSON
detected_flaws: JSON
drill_recommendations: list
pdf_report_url: str (optional)
created_at: datetime
```

### VideoSubmission
```python
id: UUID
player_id: UUID (FK → User)
coach_id: UUID (FK → User)
video_path: str
status: str  # PENDING, PROCESSING, DRAFT_REVIEW, PUBLISHED
feedback_text: str (optional)
ai_analysis: JSON (optional)
pdf_report_url: str (optional)
created_at: datetime
updated_at: datetime
```

---

## 🔄 Processing Flow Reference

### OCR Highlight Generation
```
POST /videos/upload (COACH uploads cricket match)
  ↓
POST /jobs/trigger (Start OCR analysis)
  ↓
[Background] OCR engine extracts frames → Detect 4s, 6s, Wickets
  ↓
[Background] FFmpeg cuts clips + generates supercut
  ↓
POST /worker/ocr-complete (Cloud Tasks webhook updates DB)
  ↓
GET /jobs/{video_id}/result (Client fetches supercut)
```

### Batting/Bowling Analysis
```
POST /batting/analyze (Upload video)
  ↓
[Background] MediaPipe pose extraction
  ↓
[Background] Gemini AI generates recommendations
  ↓
Response includes: biometrics, detected_flaws, drill_recommendations
```

### Submission Workflow
```
POST /submissions/upload (PLAYER selects coach, uploads video)
  ↓
COACH sees submission in GET /submissions/coach/me
  ↓
POST /submissions/{id}/analyze (COACH reviews via AI)
  ↓
PUT /submissions/{id}/publish (COACH approves, generates PDF)
  ↓
PLAYER sees published report in GET /submissions/player/me
```

---

## 🧪 Testing

```bash
pytest
pytest --cov=. --cov-report=html
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad request (validation failed) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found (resource missing) |
| 409 | Conflict (duplicate email, etc.) |
| 503 | Service unavailable (MediaPipe not installed, etc.) |

---

Last Updated: **March 16, 2026**
