# cricketVision

A full-stack web application that analyzes cricket videos, detects highlight events (4s, 6s, wickets) using OCR, and generates supercut reels.

**Status:** ✅ Production-Ready | Cloud-Native | Full-Stack

---

## 🎯 Features

- 📹 **Upload & Analyze** - Upload cricket match videos for automated analysis
- 🎯 **Event Detection** - Automatically detect 4s, 6s, and wickets using scoreboard OCR
- ✂️ **Supercut Generation** - Automatically create highlight reels from detected events
- 🗳️ **Community Voting** - Upvote/downvote match requests
- 👤 **User Authentication** - Secure login system with JWT
- 📊 **Admin Dashboard** - Manage videos, requests, and analytics
- ☁️ **Cloud-Ready** - Deploy to Render (backend) & Vercel (frontend)

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **PostgreSQL 12+** (or Supabase)
- **FFmpeg** (for video processing)

### Local Development (5 minutes)

#### 1. Clone & Setup Environment
```bash
git clone https://github.com/yeshsap/sports.git
cd sports

# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your database URL

# Frontend environment
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your API URL
```

#### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python migrate_db.py

# Start server (default: http://localhost:8000)
uvicorn main:app --reload
```

#### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start dev server (default: http://localhost:5173)
npm run dev
```

**Access the app at:** http://localhost:5173

---

## 📁 Project Structure

```
sports/
├── backend/                          # FastAPI backend (cricketVision)
│   ├── main.py                       # Application entry point
│   ├── requirements.txt              # Python dependencies
│   ├── .env.example                  # Environment template
│   ├── database/
│   │   ├── config.py                 # SQLAlchemy configuration
│   │   └── models/                   # Database models
│   ├── api/
│   │   └── routes/                   # API endpoints
│   ├── scripts/
│   │   ├── ocr_engine.py             # OCR event detection
│   │   └── cleanup_videos.py         # Utility scripts
│   ├── schemas/                      # Pydantic models
│   ├── utils/                        # Helper functions
│   └── storage/                      # Video storage (local)
│
├── frontend/                         # React + Vite (cricketVision)
│   ├── src/
│   │   ├── main.tsx                  # React entry point
│   │   ├── App.tsx                   # Main component
│   │   ├── pages/                    # Page components
│   │   ├── components/               # Reusable components
│   │   ├── lib/                      # API client & utilities
│   │   ├── store/                    # Zustand state management
│   │   └── types/                    # TypeScript definitions
│   ├── vite.config.ts                # Vite configuration
│   ├── package.json                  # Node dependencies
│   ├── .env.example                  # Environment template
│   └── vercel.json                   # Vercel deployment config
│
├── docs/                             # Documentation
├── Procfile                          # Render deployment
├── README.md                         # This file
└── .gitignore
```

---

## 🌍 Deployment

### Backend Deployment (Render)

1. **Create Render Account** - https://render.com
2. **Create New Web Service**
   - Connect your GitHub repository
   - Root directory: `backend`
   - Build command: `pip install -r requirements.txt`
   - Start command: Uses `Procfile` automatically

3. **Set Environment Variables**
   ```
   DATABASE_URL=postgresql://user:password@host/db
   ALLOWED_ORIGINS=https://your-app.vercel.app
   SECRET_KEY=your-secure-key
   ```

4. **Deploy** - Push to GitHub, Render auto-deploys

### Frontend Deployment (Vercel)

1. **Create Vercel Account** - https://vercel.com
2. **Import Project**
   - Select `frontend` folder
   - Framework: Vite
   - Build: `npm run build`

3. **Set Environment Variables**
   ```
   VITE_API_URL=https://your-backend.onrender.com
   ```

4. **Deploy** - Auto-deployed on push

### Database (Supabase)

1. **Create Project** - https://supabase.com
2. **Get Connection String** - Settings > Database > Connection string
3. **Add to Backend .env**
   ```
   DATABASE_URL=postgresql://postgres:password@db.projectid.supabase.co:5432/postgres
   ```

---

## 📚 API Documentation

### Core Endpoints

**Videos**
- `GET /api/v1/videos` - List all videos
- `GET /api/v1/videos/{video_id}` - Get video details
- `GET /api/v1/videos/{video_id}/stream` - Stream video file
- `GET /api/v1/videos/{video_id}/supercut` - Download highlight reel
- `GET /api/v1/videos/{video_id}/events` - Get detected events

**Match Requests**
- `GET /api/v1/requests` - List match requests
- `POST /api/v1/requests` - Create new request
- `POST /api/v1/requests/{request_id}/vote` - Vote on request

**Health**
- `GET /api/health` - Health check
- `GET /api/metrics` - Server metrics

**Full API docs:** http://localhost:8000/docs (Swagger UI)

---

## 🔧 Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost/sports

# CORS
ALLOWED_ORIGINS=http://localhost:5173,https://your-app.vercel.app

# JWT Auth
SECRET_KEY=your-super-secret-key-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application
ENVIRONMENT=development
DEBUG=false
```

### Frontend (.env)
```env
# API Configuration
VITE_API_URL=http://localhost:8000
```

See `.env.example` files for all available options.

---

## 🛠️ Development Commands

### Backend
```bash
cd backend

# Start server with auto-reload
uvicorn main:app --reload

# Run tests
pytest

# Database migrations
python migrate_db.py

# Check database
python check_db.py
```

### Frontend
```bash
cd frontend

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint & format
npm run lint
```

---

## 🔐 Authentication

- **JWT Tokens** - Secure token-based authentication
- **Password Hashing** - bcrypt for password security
- **Refresh Tokens** - Keep users logged in securely
- **Public Videos** - Stream videos without authentication

---

## 📊 Database Schema

**Videos**
- Video metadata, upload date, status, creator

**HighlightJobs**
- Processing status, OCR results, timestamps

**HighlightEvents**
- Detected events (4s, 6s, wickets), timestamps, confidence

**MatchRequests**
- User-requested matches, upvotes, downvotes

**UserVotes**
- User voting history, vote type

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full schema.

---

## 🧠 OCR Engine

The OCR engine detects cricket events by:

1. **Video Ingestion** - Download videos with yt-dlp
2. **Frame Extraction** - Process frames with OpenCV
3. **Scoreboard Detection** - Identify scoreboard region
4. **Text Recognition** - Extract text with EasyOCR
5. **Event Detection** - Detect state changes (4s, 6s, wickets)
6. **Clip Generation** - Extract highlight moments with FFmpeg
7. **Supercut Assembly** - Stitch clips into final reel

**Accuracy:** Median smoothing & anti-flicker logic for robustness

---

## 📝 Git Workflow

This project uses a feature-based commit history:

```bash
# View commit timeline
git log --oneline

# View with dates
git log --format='%h %ai %s'
```

See [RETROACTIVE_COMMITS.md](RETROACTIVE_COMMITS.md) for development timeline documentation.

---

## 🐛 Troubleshooting

### Backend Issues

**Port already in use:**
```bash
# Use different port
uvicorn main:app --reload --port 8001
```

**Database connection error:**
```bash
# Verify DATABASE_URL in .env
# Check PostgreSQL is running
# Test connection: psql <DATABASE_URL>
```

**OCR engine issues:**
- Ensure OpenCV and EasyOCR are installed
- Check video file format (MP4 preferred)
- Verify FFmpeg is in system PATH

### Frontend Issues

**API connection errors:**
- Verify backend is running
- Check VITE_API_URL in .env
- Ensure CORS is configured

**Build errors:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 📞 Support & Contributing

- **Issues** - Report bugs on GitHub Issues
- **Documentation** - See `docs/` folder
- **API Reference** - Run backend and visit `/docs`

---

## 📄 License

This project is licensed under the MIT License.

---

## 🚀 Next Steps

1. ✅ Clone the repository
2. ✅ Set up backend (see Quick Start)
3. ✅ Set up frontend (see Quick Start)
4. ✅ Upload a cricket video
5. ✅ Watch events get detected automatically
6. ✅ Download your highlight reel!

**Happy analyzing! 🏏** 
