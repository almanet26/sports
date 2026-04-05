# Cricket Analytics & Highlight Platform 

A full-stack cloud-native web application that analyzes cricket videos, detects highlight events (4s, 6s, wickets) using OCR, and provides advanced AI-driven player biomechanics analysis (batting and bowling).

**Status:** ✅ Production-Ready | GCP Cloud-Native | Full-Stack

--- 

## 🎯 Features
- 📹 **Upload & Analyze** - Upload cricket match videos or player clips.
- 🎯 **Event Detection** - Automatically detect 4s, 6s, and wickets using scoreboard OCR (`EasyOCR`).
- ✂️ **Supercut Generation** - Automatically create highlight reels from detected events via zero-copy `FFmpeg`.
- 🤖 **Player Biomechanics Analysis** - MediaPipe Pose Landmarker integration for batting stances and bowling action.
- 👨‍🏫 **Coach Portal** - Dedicated UI for coaches to review student submissions frame-by-frame.
 
---

## 📁 GitHub Repository Details (Structure)
This is a monorepo containing both the React frontend and the Python/FastAPI backend, designed for seamless containerized deployments.

```text
sports/
├── backend/                  # FastAPI Application & AI Engines
│   ├── api/routes/           # API endpoints (videos, users, requests, tasks)
│   ├── database/             # PostgreSQL schemas & SQLAlchemy connection setup
│   ├── scripts/              # Core AI/ML logic 
│   │   ├── ocr_engine.py     # OCR scoreboard detection
│   │   ├── batting_engine.py # MediaPipe batting stance logic
│   │   └── bowling_engine.py # MediaPipe bowling action logic
│   ├── Dockerfile            # GCP Cloud Run container definition
│   ├── cloudrun.yaml         # Cloud Run service configuration
│   └── requirements.txt      # Python dependencies
│
├── frontend/                 # Vite + React (TypeScript) Application
│   ├── src/                  
│   │   ├── components/       # Reusable UI components (TailwindCSS)
│   │   ├── pages/            # Page-level components (Free tier, Premium, Coach dashboard)
│   │   └── store/            # Zustand for global state management (Auth, Uploads)
│   └── package.json          # Node dependencies
│
├── docs/                     # Detailed Project Documentation
│   ├── ARCHITECTURE.md       # High-level system design & workflows
│   ├── DEPLOYMENT_CONFIG.md  # Step-by-step GCP deployment instructions
│   └── NEXT_PHASE.md         # Recommended features for future extensions
│
└── cloudbuild.yaml           # CI/CD pipeline definition for GCP Cloud Build
```

---

## 🚀 Quick Start (Local Development)

#### 1. Setup Environment
```bash
git clone https://github.com/almanet26/sports.git
cd sports
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

#### 2. Backend & DB
```bash
cd backend
python -m venv venv
venv\Scriptsctivate   # Windows
pip install -r requirements.txt
python migrate_db.py    # Make sure local Postgres is running
uvicorn main:app --reload
```

#### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
