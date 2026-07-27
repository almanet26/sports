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
7. Admin & Entitlements Issues

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

### ❌ Custom trim/timeline (`start_time`/`end_time`) ignored during OCR processing

**Symptoms:**
```
Job takes as long as the full video even though a trimmed window was requested
Clips appear from outside the requested start/end range
```

**Cause:** `start_time`/`end_time`/`padding_before`/`padding_after` are passed as a free-form `config` dict (`JobTriggerRequest.config` in `backend/schemas/video.py`) — a missing key, wrong type (string vs number), or a value from a stale frontend build silently falls back to scanning/trimming the whole video.

**Solutions:**

```bash
# 1. Confirm the trigger payload actually contains numeric trim fields
POST /api/v1/jobs/trigger
{
  "video_id": "video-uuid",
  "config": { "start_time": 120, "end_time": 900, "padding_before": 12, "padding_after": 10 }
}

# 2. Check the resolved trim values in ocr_engine.py logs
# preprocess_video() logs elapsed re-encode time — a near-full-length
# re-encode means trim_start/trim_end weren't applied (ocr_engine.py ~line 106-143)

# 3. Verify JobConfig actually parsed the values
# ocr_engine.py ~line 1949-1966: trim_start/trim_end are read from
# config.start_time / config.end_time — confirm these aren't None

# 4. For the YouTube upload UI specifically, confirm UploadPage.tsx is
# sending paddingBeforeSeconds/paddingAfterSeconds (only sent if defined —
# an undefined value is silently omitted from the request body)
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

### ❌ Resumable upload stuck / never reaches 100% (local dev)

**Symptoms:**
```
UpChunk keeps retrying the same chunk
Upload never finalizes; no error surfaces in the UI
```

**Cause:** In local dev (no GCS bucket configured, `GCS_AVAILABLE=false`), `/resumable-session` returns a **local** resumable URL that mimics GCS's chunked-PUT protocol (`backend/api/routes/storage.py`, `local_resumable_upload`). This local stand-in expects chunks to arrive **sequentially** with a `Content-Range: bytes start-end/total` header and returns `308` until all bytes are received — if a chunk is retried out of order, or `storage/uploads/` isn't writable, the byte count never reaches `total`.

**Solutions:**

```bash
# 1. Check backend logs for the running byte count
# "Local resumable upload complete: <path> (<bytes> bytes)" only logs once fully received

# 2. Verify storage/uploads/ exists and is writable
ls -la backend/storage/uploads

# 3. Confirm the request is actually hitting the local fallback and not
# silently trying to reach a real GCS session URI
# (GCS_AVAILABLE=false should log "Local resumable session created (GCS unavailable)")

# 4. If testing the real GCS signed-URL flow instead, set GCS_BUCKET_NAME
# and GOOGLE_APPLICATION_CREDENTIALS so /resumable-session returns a real
# GCS session_uri instead of the local fallback
```

---

### ❌ YouTube timeline/padding options don't change the generated clips

**Symptoms:**
```
Clips are the same length regardless of the padding sliders in UploadPage
OCR scans the entire video instead of the selected timeline segment
```

**Cause:** Padding/timeline fields are optional and only included in the request when explicitly set (`frontend/src/pages/UploadPage.tsx`); if the value is `undefined` (e.g. slider never touched, or reset by a re-render), it's silently dropped from the payload and the backend falls back to defaults (`padding_before=12, padding_after=10` in `backend/api/routes/storage.py`, `_process_submission_ocr_fallback`).

**Solutions:**

```bash
# 1. Inspect the actual request body in DevTools → Network for the
# /jobs/trigger or upload-confirm call — confirm padding_before/
# padding_after/start_time/end_time are present, not omitted

# 2. Re-select the timeline range in the UI before submitting; a stale
# state from a previous upload attempt may not carry over

# 3. Check backend/services/ocr_task.py received the same values it was sent
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

## 7. Admin & Entitlements Issues

### ❌ Admin dashboard shows stale/hardcoded plan data

**Symptoms:**
```
A plan created/edited in the admin panel doesn't appear (or shows old values)
New plan keys are missing from AdminUsersPage filters
```

**Cause:** The admin dashboard fetches plans dynamically from the entitlement engine (`backend/api/routes/admin_plans.py`, mounted under `/admin`) rather than a hardcoded plan list — a stale value usually means the frontend cached an old response, the entitlement cache TTL hasn't expired yet, or the plan wasn't actually committed on the backend.

**Solutions:**

```bash
# 1. Hard refresh the admin dashboard (cached fetch, not a hardcoded value)
# DevTools → Network → Disable cache, or Ctrl+Shift+R

# 2. Confirm the plan exists via the API directly
curl -H "Authorization: Bearer <admin_token>" http://localhost:8000/api/v1/admin/plans

# 3. Check the plan/entitlement rows were actually committed
psql -U postgres -d sports_dev -c "SELECT id, key, name FROM plans;"
psql -U postgres -d sports_dev -c "SELECT * FROM plan_entitlements;"

# 4. Every admin mutation should invalidate the entitlement cache
# (services/entitlement_service.py) — if a change still doesn't show up
# after a hard refresh, check that invalidation actually fired in the logs
```

---

### ❌ New user filters on AdminUsersPage return nothing

**Symptoms:**
```
Filtering by plan/role in the admin Users page returns an empty list
even though matching users exist
```

**Cause:** The `?plan=` filter on `GET /admin/users` (`backend/api/routes/admin.py`, `list_users`) matches against each user's **active subscription's** `plan_key` (`subscriptions.plan_key`), not a static field on the user row — a user with no active subscription, or one whose plan key doesn't exactly match (e.g. an old tier name like `pro` instead of `coach_platinum`), will never match.

**Solutions:**

```bash
# 1. Confirm the plan key used in the filter matches an existing plan's key
curl -H "Authorization: Bearer <admin_token>" http://localhost:8000/api/v1/admin/plans

# 2. Check the user's actual active subscription in the DB
psql -U postgres -d sports_dev -c "SELECT plan_key, status FROM subscriptions WHERE user_id = '<user_id>' ORDER BY created_at DESC LIMIT 1;"

# 3. Re-run the filter with the exact plan key, not a display label —
# users with no active subscription won't match any `plan` filter
```

---

## 📞 Getting More Help

1. **Check logs:** `tail -f backend/logs/*.log`
2. **GitHub Issues:** Open issue with full error trace
3. **API Documentation:** http://localhost:8000/docs
4. **Database logs:** `sudo tail -f /var/log/postgresql/postgresql.log`

---

**Last Updated:** July 27, 2026
