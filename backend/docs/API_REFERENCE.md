# Backend API Quick Reference

## 📁 Project Structure

```
backend/
├── main.py                      # FastAPI entry point
├── requirements.txt             # Python dependencies
├── .env                         # Environment variables (create from .env.example)
│
├── api/
│   └── routes/
│       ├── auth.py              # Authentication (register, login, logout)
│       ├── videos.py            # Video upload, listing, events
│       ├── jobs.py              # OCR processing job management
│       └── requests.py          # Match request voting system
│
├── database/
│   ├── config.py                # SQLAlchemy config & session
│   ├── schema_v2.sql            # PostgreSQL schema
│   └── models/
│       ├── user.py              # User model
│       ├── session.py           # Session & ProcessingJob models
│       └── video.py             # Video, HighlightEvent, HighlightJob, MatchRequest
│
├── schemas/
│   ├── auth.py                  # Auth request/response schemas
│   └── video.py                 # Video/Job request/response schemas
│
├── services/
│   └── ocr_task.py              # Background OCR processing task
│
├── scripts/
│   └── ocr_engine.py            # Core OCR engine (cricket event detection)
│
├── utils/
│   ├── auth.py                  # JWT utilities, role dependencies
│   └── config.py                # Settings management
│
└── storage/
    ├── uploads/                 # User-uploaded videos
    ├── raw/                     # Downloaded videos
    ├── trimmed/                 # Individual clips
    └── highlight/               # Supercut highlight reels
```

## 🔑 API Endpoints

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/register` | Public | Register new user |
| POST | `/login` | Public | Login (returns JWT) |
| POST | `/logout` | Auth | Logout (invalidate session) |
| GET | `/me` | Auth | Get current user profile |

### Videos (`/api/v1/videos`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/upload` | ADMIN, COACH | Upload video file |
| GET | `/public` | Public | List public library |
| GET | `/private` | COACH | List user's private videos |
| GET | `/{id}` | Auth | Get video details |
| GET | `/{id}/events` | Auth | Get events (with filter) |
| POST | `/{id}/publish` | COACH | Publish private → public |
| DELETE | `/{id}` | Owner/ADMIN | Delete video |

### Jobs (`/api/v1/jobs`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/trigger` | ADMIN, COACH | Start OCR processing |
| GET | `/{video_id}/status` | Auth | Get job progress |
| GET | `/{video_id}/result` | Auth | Get completed results |
| POST | `/{video_id}/retry` | ADMIN, COACH | Retry failed job |
| GET | `/pending` | ADMIN | List all pending jobs |

### Match Requests (`/api/v1/requests`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | Auth | Create request or vote |
| GET | `/` | Public | List requests (by popularity) |
| POST | `/{id}/vote` | Auth | Vote for request |
| DELETE | `/{id}/vote` | Auth | Remove vote |
| GET | `/admin/dashboard` | ADMIN | Admin request dashboard |
| PATCH | `/{id}/status` | ADMIN | Update request status |

## 👥 User Roles & Permissions

| Capability | PLAYER (Free) | COACH (Premium) | ADMIN |
|------------|:-------------:|:---------------:|:-----:|
| Browse Public Library | ✅ | ✅ | ✅ |
| Filter Highlights | ✅ | ✅ | ✅ |
| Stream Videos | ✅ | ✅ | ✅ |
| Download Clips | ❌ | ✅ | ✅ |
| Request Match | ✅ | ✅ | ❌ |
| Upload Video | ❌ | ✅ (Private) | ✅ (Public) |
| Trigger OCR | ❌ | ✅ | ✅ |
| Private Dashboard | ❌ | ✅ | ❌ |
| Publish to Public | ❌ | ✅ | ❌ |
| Admin Dashboard | ❌ | ❌ | ✅ |

## 🚀 Quick Start

### 1. Set up environment
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
pip install -r requirements.txt
```

### 2. Configure database
```bash
# Create .env file
cp .env.example .env
# Edit .env with your PostgreSQL/Supabase URL
```

### 3. Run migrations
```bash
# Option A: SQLAlchemy auto-create (dev mode)
python -c "from database.config import engine, Base; from database.models import *; Base.metadata.create_all(bind=engine)"

# Option B: Run SQL schema
psql -U postgres -d your_db -f database/schema_v2.sql
```

### 4. Start server
```bash
python main.py
# or
uvicorn main:app --reload
```

### 5. Access API docs
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🔧 OCR Processing Flow

```
1. Upload Video (POST /videos/upload)
   ↓
2. Trigger OCR Job (POST /jobs/trigger)
   ↓
3. Background Task runs ocr_engine.py
   - Extract frames at 1fps
   - OCR scoreboard region
   - Detect score changes (4s, 6s, Wickets)
   - Extract clips with FFmpeg
   - Create supercut
   ↓
4. Check Status (GET /jobs/{video_id}/status)
   ↓
5. Get Results (GET /jobs/{video_id}/result)
   ↓
6. Browse Events (GET /videos/{video_id}/events?event_type=SIX)
```

## 📝 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT
SECRET_KEY=your-super-secret-key-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Storage (relative to backend/)
STORAGE_RAW_PATH=storage/raw
STORAGE_TRIMMED_PATH=storage/trimmed

# Optional: API Keys
CRICKETDATA_API_KEY=
PLAYCRICKET_API_KEY=
```

## 🧪 Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=. --cov-report=html
```

## 📊 Database Models

### User
- `id`, `email`, `password_hash`, `role` (PLAYER/COACH/ADMIN)
- Authentication fields (is_active, is_verified, etc.)

### Video
- `id`, `title`, `file_path`, `visibility` (public/private)
- `status` (pending/processing/completed/failed)
- Statistics: `total_fours`, `total_sixes`, `total_wickets`

### HighlightEvent
- `video_id`, `event_type` (FOUR/SIX/WICKET)
- `timestamp_seconds`, `score_before`, `score_after`
- `clip_path` (extracted clip location)

### HighlightJob
- `video_id`, `status`, `progress_percent`
- `events_detected` (JSON), `supercut_path`
- Error handling: `error_message`, `retry_count`

### MatchRequest
- `match_title`, `vote_count`, `status`
- `requested_by`, `fulfilled_video_id`
