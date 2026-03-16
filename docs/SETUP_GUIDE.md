# Complete Setup Guide for New Developers

Complete step-by-step guide to get the entire application running locally.

---

## ⏱️ Estimated Time: 30-45 minutes

---

## 1. System Prerequisites

### Windows
- **Git:** https://git-scm.com/download/win
- **Python 3.10+:** https://www.python.org/downloads/
- **Node.js 18+:** https://nodejs.org/
- **PostgreSQL 12+:** https://www.postgresql.org/download/windows/
- **FFmpeg:** https://ffmpeg.org/download.html (add to PATH)

```powershell
# Verify installations
git --version
python --version
node --version
psql --version
ffmpeg -version
```

### Mac
```bash
# Using Homebrew
brew install python@3.10 node postgresql ffmpeg git
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install python3.10 python3-pip nodejs postgresql postgresql-contrib ffmpeg git
```

---

## 2. Clone Repository

```bash
git clone https://github.com/almanet26/sports.git
cd sports
```

---

## 3. Backend Setup

### 3.1 Create Python Virtual Environment
```bash
cd backend
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\Activate.ps1
# Mac/Linux:
source venv/bin/activate
```

**Troubleshoot PowerShell on Windows:**
```powershell
# If error "cannot be loaded because running scripts is disabled"
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 3.2 Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

**If specific packages fail to install:**
```bash
# Install MediaPipe separately (large file)
pip install --no-cache-dir mediapipe

# Install yt-dlp
pip install yt-dlp

# Install EasyOCR
pip install easyocr
```

### 3.3 Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env
# Change DATABASE_URL to your local PostgreSQL
```

**Example .env:**
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/sports_dev
SECRET_KEY=dev-secret-key-change-in-production
CLOUD_RUN=false
GEMINI_API_KEY=your-key-if-available
```

### 3.4 Setup PostgreSQL Database

**Create Database:**
```bash
# Connect to PostgreSQL
psql -U postgres

# In psql shell:
CREATE DATABASE sports_dev;
\q
```

**Run Migrations:**
```bash
cd backend
python -c "from database.config import Base, engine; from database.models import *; Base.metadata.create_all(bind=engine)"
```

**Verify Tables Created:**
```bash
psql -U postgres -d sports_dev -c "\dt"
```

### 3.5 Start Backend Server
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

**Access API:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health: http://localhost:8000/health

---

## 4. Frontend Setup

### 4.1 Install Dependencies
```bash
cd frontend
npm install
```

**If node_modules issues:**
```bash
rm -r node_modules package-lock.json
npm install
```

### 4.2 Configure Environment
```bash
cp .env.example .env
# Or create .env with:
```

**Example .env:**
```env
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=Cricket Analytics
```

### 4.3 Start Development Server
```bash
cd frontend
npm run dev
```

**Expected Output:**
```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

**Access Application:**
- Web App: http://localhost:5173
- Auto-reloads on file changes

---

## 5. Testing Backend

### 5.1 Run Tests
```bash
cd backend
pytest --v
```

### 5.2 Run with Coverage
```bash
pytest --cov=. --cov-report=html
# Open htmlcov/index.html in browser
```

---

## 6. Verify Full Stack

### 6.1 Test API Connection
```bash
# Terminal 1: Backend running
cd backend && uvicorn main:app --reload

# Terminal 2: Test API
curl -X GET http://localhost:8000/health
# Expected: {"status":"ok"}
```

### 6.2 Test Frontend Connection
```bash
# Terminal 1: Backend running
cd backend && uvicorn main:app --reload

# Terminal 2: Frontend running
cd frontend && npm run dev

# Terminal 3: Test frontend API
curl -X GET http://localhost:5173/api/health
# Or just open http://localhost:5173 in browser
```

---

## 7. Development Tools Setup (Optional)

### 7.1 Code Formatting
```bash
cd backend
pip install black
black . --line-length=120
```

### 7.2 Linting
```bash
cd backend
pip install flake8
flake8 . --max-line-length=120 --exclude=venv

cd ../frontend
npm run lint
npm run lint:fix
```

### 7.3 Type Checking
```bash
cd backend
pip install mypy
mypy backend/
```

---

## 8. Common Issues & Fixes

### ❌ "ModuleNotFoundError: No module named 'mediapipe'"
**Solution:**
```bash
pip install --no-cache-dir mediapipe
# If still fails, use pre-built wheel:
pip install https://wheels.gstatic.com/... # from gstatic.com
```

### ❌ "Database connection refused"
**Solution:**
```bash
# Check PostgreSQL is running
# Windows: Services → PostgreSQL → OK
# Mac: brew services start postgresql
# Linux: sudo systemctl start postgresql

# Verify connection:
psql -U postgres -h localhost
```

### ❌ "Port 8000 already in use"
**Solution:**
```bash
# Find process using port 8000
lsof -i :8000  # Mac/Linux
netstat -ano | findstr :8000  # Windows

# Kill process or use different port:
uvicorn main:app --port 8001
```

### ❌ "CORS error when frontend calls backend"
**Solution:**
Ensure `VITE_API_URL` in `/frontend/.env` matches backend URL:
```env
VITE_API_URL=http://localhost:8000
```

### ❌ "npm: command not found"
**Solution:**
```bash
# Reinstall Node.js from https://nodejs.org/
# Or on Mac:
brew install node
```

---

## 9. IDE Setup (Recommended)

### VS Code Extensions
- Python (ms-python.python)
- Pylance (ms-python.vscode-pylance)
- FastAPI (fastapi-devtools)
- ES7+ React/Redux (dsznajder.es7-react-js-snippets)
- Prettier (esbenp.prettier-vscode)
- Thunder Client (rangav.vscode-thunder-client) - for API testing

### PyCharm
- Built-in Python/FastAPI support
- Integrated database viewer
- Great debugger

---

## 10. Database Management

### 10.1 View Database
```bash
# Connect to database
psql -U postgres -d sports_dev

# Common commands
\dt              # List tables
\d users         # Show table schema
SELECT * FROM users LIMIT 5;  # View data
```

### 10.2 Reset Database
```bash
# Drop all data
dropdb -U postgres sports_dev
createdb -U postgres sports_dev
python -c "from database.config import Base, engine; from database.models import *; Base.metadata.create_all(bind=engine)"
```

### 10.3 Seed Test Data
```bash
cd backend
python database/seed_users.py
```

---

## 11. Running All Services Together

**Terminal 1 - Backend:**
```bash
cd backend && uvicorn main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend && npm run dev
```

**Terminal 3 - PostgreSQL (if needed):**
```bash
# Mac:
brew services start postgresql

# Linux:
sudo systemctl start postgresql

# Windows: starts automatically
```

**Terminal 4 - Run Tests:**
```bash
cd backend && pytest --watch
```

---

## 12. Next Steps

1. **Read API Documentation:** `docs/API_REFERENCE.md`
2. **Understand Architecture:** `docs/ARCHITECTURE.md`
3. **Check Contributing Guide:** `docs/CONTRIBUTING.md`
4. **Explore Features:** `docs/FEATURES.md`
5. **Review Code:** Start with `/backend/main.py` and `/frontend/src/App.tsx`

---

## 13. Getting Help

- **Docs:** Check `/docs` folder
- **API Reference:** http://localhost:8000/docs
- **GitHub Issues:** Open an issue on GitHub
- **Slack/Discord:** Join team channel

---

**Last Updated:** March 16, 2026
