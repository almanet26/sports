# Troubleshooting Guide

Common issues and solutions for development, deployment, and production.

---

## 📋 Index

1. Backend Issues
2. Frontend Issues
3. Database Issues
4. GCP/Cloud Issues
5. Video Processing Issues
6. Authentication Issues

---

## 1. Backend Issues

### ❌ "ModuleNotFoundError: No module named 'mediapipe'"

**Symptoms:**
```
ModuleNotFoundError: No module named 'mediapipe'
```

**Cause:** MediaPipe not installed or virtual environment inactive.

**Solutions:**

```bash
# 1. Check virtual environment is active
which python  # Should show venv path

# 2. Reinstall MediaPipe
pip uninstall mediapipe
pip install --no-cache-dir mediapipe

# 3. If still fails, use pre-built wheel
pip install https://storage.googleapis.com/mediapipe-assets/python/mediapipe-0.10.5-cp310-cp310-win_amd64.whl

# 4. Verify installation
python -c "import mediapipe; print(mediapipe.__version__)"
```

---

### ❌ "RuntimeError: Failed to detect scoreboard"

**Symptoms:**
```
OCR processing fails with "Failed to detect scoreboard" error
Video clips not extracted
```

**Cause:** ROI (Region of Interest) doesn't match video format.

**Solutions:**

```bash
# 1. Check video resolution
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 video.mp4
# Output: 1920x1080 (then ROI x=240, y=940 should work)

# 2. Calibrate ROI for your video
cd backend/scripts
python roi_calibrator.py --video path/to/video.mp4

# 3. Check scoreboard visibility
ffmpeg -i video.mp4 -ss 00:05:00 -vframes 1 frame.jpg
# Manually verify scoreboard is in frame

# 4. Override ROI in API call
POST /api/v1/jobs/trigger
{
  "video_id": "video-uuid",
  "roi_override": {
    "x": 240,
    "y": 940,
    "width": 170,
    "height": 80
  }
}
```

---

### ❌ "Connection refused" connecting to database

**Symptoms:**
```
psycopg2.OperationalError: could not connect to server: Connection refused
```

**Cause:** PostgreSQL not running or connection string is wrong.

**Solutions:**

```bash
# 1. Check if PostgreSQL is running
# Windows:
Get-Service PostgreSQL*

# Mac:
brew services list | grep postgres

# Linux:
sudo systemctl status postgresql

# 2. Start PostgreSQL if stopped
# Windows: Services → PostgreSQL → Start
# Mac: brew services start postgresql
# Linux: sudo systemctl start postgresql

# 3. Test connection
psql -U postgres -h localhost

# 4. Check connection string in .env
# Should be: postgresql://user:password@localhost:5432/sports_dev

# 5. Verify database exists
psql -U postgres -l | grep sports_dev
```

---

### ❌ "Port 8000 already in use"

**Symptoms:**
```
ERROR: [Errno 48] Address already in use
```

**Solutions:**

```bash
# 1. Find process using port 8000
lsof -i :8000  # Mac/Linux
netstat -ano | findstr :8000  # Windows

# 2. Kill the process
kill -9 <PID>  # Mac/Linux
taskkill /PID <PID> /F  # Windows

# 3. Or use a different port
uvicorn main:app --port 8001

# 4. Check for stuck processes
ps aux | grep uvicorn
```

---

### ❌ "CORS error: Access-Control-Allow-Origin"

**Symptoms:**
```
Response has unsupported CORS header value
```

**Cause:** Frontend and backend CORS mismatch.

**Solutions:**

```python
# 1. Check main.py has CORS middleware
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Check frontend .env has correct backend URL
# frontend/.env
VITE_API_URL=http://localhost:8000

# 3. Clear browser cache
# DevTools → Network → Disable cache
# OR hard refresh: Ctrl+Shift+R / Cmd+Shift+R

# 4. Test CORS manually
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS http://localhost:8000/health
```

---

### ❌ "UnicodeDecodeError when processing video"

**Symptoms:**
```
UnicodeDecodeError: 'utf-8' codec can't decode byte 0xff
```

**Cause:** Binary data treated as text.

**Solutions:**

```python
# 1. Ensure file is opened in binary mode
# ❌ Wrong
with open('video.mp4') as f:
    data = f.read()

# ✅ Correct
with open('video.mp4', 'rb') as f:
    data = f.read()

# 2. Check video file is valid
ffprobe -v error video.mp4

# 3. Re-encode if corrupted
ffmpeg -i input_video.mp4 -c:v libx264 -crf 23 output_video.mp4
```

---

## 2. Frontend Issues

### ❌ "Module not found: @/components/VideoPlayer"

**Symptoms:**
```
Error: Cannot find module '@/components/VideoPlayer'
```

**Cause:** Path alias not configured or component doesn't exist.

**Solutions:**

```bash
# 1. Check tsconfig.json has path alias
# tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

# 2. Verify file exists
ls src/components/VideoPlayer.tsx

# 3. Check file export
# ✅ Correct
export const VideoPlayer = () => { ... }

# ❌ Wrong
const VideoPlayer = () => { ... }  // Missing export

# 4. Restart dev server
npm run dev
```

---

### ❌ "Blank screen, nothing renders"

**Symptoms:**
- White/blank page in browser
- No errors in console

**Cause:** React app failed to mount or infinite loop.

**Solutions:**

```bash
# 1. Check console for errors
# DevTools → Console tab

# 2. Check React DevTools extension
# Install: https://react-devtools.io

# 3. Check API connection
fetch('http://localhost:8000/health')
  .then(r => r.json())
  .then(console.log)

# 4. Check .env variables
cat frontend/.env

# 5. Clear cache and rebuild
rm -r node_modules
npm install
npm run dev
```

---

### ❌ "AXIOS error: 401 Unauthorized"

**Symptoms:**
```
Error: Request failed with status code 401
```

**Cause:** Missing or invalid authentication token.

**Solutions:**

```tsx
// 1. Check token is stored
console.log(localStorage.getItem('access_token'))

// 2. Check token in API client
// lib/api.ts
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 3. Check token is not expired
// Tokens expire in 15 min, check refresh token handling
const token_payload = JSON.parse(atob(token.split('.')[1]));
console.log(new Date(token_payload.exp * 1000));  // Expiry time

// 4. Login again to get fresh token
await login('user@example.com', 'password');
```

---

### ❌ "Video upload stalls at 0%"

**Symptoms:**
- Upload dialog shows "Uploading..." but never progresses
- Browser hangs

**Solutions:**

```tsx
// 1. Check backend is running
curl http://localhost:8000/health

// 2. Check file size (max 10GB)
ls -lh video.mp4  # Show size

// 3. Test with smaller file first
ffmpeg -i large_video.mp4 -t 10 test_video.mp4  # First 10 sec

// 4. Check network tab in DevTools
// DevTools → Network → Select upload request
// Check request size and timeouts

// 5. Increase timeout in API client
api.defaults.timeout = 600000;  // 10 minutes
```

---

## 3. Database Issues

### ❌ "Error: psql: command not found"

**Symptoms:**
```
zsh: command not found: psql
```

**Cause:** PostgreSQL not installed or not in PATH.

**Solutions:**

```bash
# Mac
brew install postgresql
brew services start postgresql
psql -U postgres

# Linux
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres psql

# Windows
# Download from https://www.postgresql.org/download/windows/
# Check "Add PostgreSQL to PATH" during install
psql -U postgres
```

---

### ❌ "Database 'sports_dev' does not exist"

**Symptoms:**
```
psql: error: FATAL: database "sports_dev" does not exist
```

**Cause:** Database wasn't created.

**Solutions:**

```bash
# 1. Create database
createdb -U postgres sports_dev

# 2. Or via psql
psql -U postgres -c "CREATE DATABASE sports_dev;"

# 3. Verify it exists
psql -U postgres -l | grep sports_dev

# 4. Run migrations
cd backend
python -c "from database.config import Base, engine; Base.metadata.create_all(bind=engine)"

# 5. Verify tables created
psql -U postgres -d sports_dev -c "\dt"
```

---

### ❌ "Error: Relation 'users' does not exist"

**Symptoms:**
```
ProgrammingError: (psycopg2.errors.UndefinedTable) relation "users" does not exist
```

**Cause:** Tables weren't created (migrations not run).

**Solutions:**

```bash
# 1. Run migrations
cd backend
python -c "from database.config import Base, engine; from database import models; Base.metadata.create_all(bind=engine)"

# 2. Verify tables exist
psql -U postgres -d sports_dev -c "\dt"
# Should show: users, video, highlight_event, etc.

# 3. If tables missing, check models are imported
# database/__init__.py should import all models
from database.models import *

# 4. Reset database if corrupted
dropdb -U postgres sports_dev
createdb -U postgres sports_dev
python -c "from database.config import Base, engine; from database import models; Base.metadata.create_all(bind=engine)"
```

---

## 4. GCP/Cloud Issues

### ❌ "Authentication failed to 'default' GCP credentials"

**Symptoms:**
```
google.auth.exceptions.DefaultCredentialsError: Could not automatically determine credentials
```

**Cause:** GCP credentials not configured.

**Solutions:**

```bash
# 1. Check if gcloud is installed
which gcloud

# 2. Authenticate with gcloud
gcloud auth application-default login
# Opens browser for login

# 3. Verify credentials
gcloud config list

# 4. Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"

# 5. Check credentials file exists
ls -la $GOOGLE_APPLICATION_CREDENTIALS
```

---

### ❌ "Permission denied: 'gs://bucket-name/file'"

**Symptoms:**
```
google.cloud.exceptions.Forbidden: 403 Forbidden
```

**Cause:** Credentials don't have permissions to bucket.

**Solutions:**

```bash
# 1. Check bucket permissions
gsutil iam ch user@example.com:objectViewer gs://bucket-name

# 2. List buckets to verify access
gsutil ls

# 3. Check IAM roles
gcloud projects get-iam-policy PROJECT_ID --flatten="bindings[].members" --format='table(bindings.role)'

# 4. Grant permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=user@example.com \
  --role=roles/storage.admin

# 5. Download credentials again
gcloud iam service-accounts keys create ~/key.json \
  --iam-account=service-account@project.iam.gserviceaccount.com
```

---

## 5. Video Processing Issues

### ❌ "FFmpeg not found" or "executable not found in $PATH"

**Symptoms:**
```
FileNotFoundError: [Errno 2] No such file or directory: 'ffmpeg'
```

**Cause:** FFmpeg not installed or not in PATH.

**Solutions:**

```bash
# Mac
brew install ffmpeg

# Linux
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
# Add to PATH or specify full path:
# C:\ffmpeg\bin\ffmpeg.exe

# Verify installation
ffmpeg -version
ffprobe -version

# Check PATH
echo $PATH  # Mac/Linux
echo %PATH%  # Windows
```

---

### ❌ "OCR returns empty/garbage results"

**Symptoms:**
```
Detected events: []
Or: Detected events: [1000, 2000, 9999]  # Unrealistic values
```

**Cause:** Poor video quality, wrong ROI, or corruption.

**Solutions:**

```bash
# 1. Check video quality & scoreboard visibility
ffmpeg -i video.mp4 -ss 00:05:00 -vframes 1 frame.jpg
# Inspect frame.jpg - is scoreboard visible?

# 2. Recalibrate ROI
cd backend/scripts
python roi_calibrator.py --video video.mp4

# 3. Check video fps & duration
ffprobe -v error -select_streams v:0 -show_entries stream=fps,duration -of csv=s=x:p=0 video.mp4

# 4. Test with different video if possible
# Sometimes specific codecs have issues

# 5. Check logs for errors
tail -f backend/logs/ocr_engine.log
```

---

## 6. Authentication Issues

### ❌ "Invalid JWT token" or "Token expired"

**Symptoms:**
```
Error: Invalid token
401 Unauthorized
```

**Cause:** Token expired or malformed.

**Solutions:**

```bash
# 1. Check token expiry
python -c "
import jwt
token = 'your_token_here'
payload = jwt.decode(token, options={'verify_signature': False})
import datetime
print(datetime.datetime.fromtimestamp(payload['exp']))
"

# 2. Refresh token
POST /api/v1/auth/refresh
# Requires valid refresh_token in localStorage

# 3. Re-login if refresh fails
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

# 4. Check SECRET_KEY matches
# backend/.env must have same SECRET_KEY as production
echo $SECRET_KEY
```

---

### ❌ "User not found" during login

**Symptoms:**
```
404 User not found
```

**Cause:** User doesn't exist in database.

**Solutions:**

```bash
# 1. Check user exists
psql -U postgres -d sports_dev -c "SELECT * FROM users WHERE email = 'user@example.com';"

# 2. Create test user
cd backend
python -c "
from database.models import User
from database.config import engine, SessionLocal
from sqlalchemy.orm import Session

session = SessionLocal()
user = User(
    email='test@example.com',
    password_hash='hashed_password',  # Use bcrypt in real code
    name='Test User'
)
session.add(user)
session.commit()
"

# 3. Or use API to register
POST /api/v1/auth/register
{
  "email": "newuser@example.com",
  "name": "New User",
  "password": "SecurePassword123!",
  "team": "India"
}
```

---

## 📞 Getting More Help

1. **Check logs:** `tail -f backend/logs/*.log`
2. **GitHub Issues:** Open issue with full error trace
3. **API Documentation:** http://localhost:8000/docs
4. **Database logs:** `sudo tail -f /var/log/postgresql/postgresql.log`

---

**Last Updated:** March 16, 2026
