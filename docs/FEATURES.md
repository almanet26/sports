# Feature Documentation

Comprehensive guide to all features in the Cricket Analytics Platform.

---

## 📑 Table of Contents
1. OCR Highlight Detection
2. Batting Biomechanics Analysis
3. Bowling Biomechanics Analysis
4. Player Submissions (Coach Review)
5. Subscription Management
6. Admin Features

---

## 1. OCR Highlight Detection

### Overview
Automatically detects cricket highlight events (4s, 6s, Wickets) from match videos using OCR on the scoreboard.

### How It Works

**Step 1: Video Upload**
```bash
POST /api/v1/videos/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=@match_video.mp4
title=India vs Pakistan T20
description=High-intensity match
match_date=2026-03-15
teams=India, Pakistan
venue=Mumbai
visibility=private
```

**Step 2: Trigger OCR Analysis**
```bash
POST /api/v1/jobs/trigger
Authorization: Bearer <token>
Content-Type: application/json

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

**Step 3: Monitor Progress**
```bash
GET /api/v1/jobs/{video_id}/status
# Returns: {"progress_percent": 45, "phase": "Extracting clips..."}
```

**Step 4: Get Results**
```bash
GET /api/v1/jobs/{video_id}/result
# Returns: {"events": [...], "supercut_path": "gs://..."}
```

### OCR Engine Logic (`scripts/ocr_engine.py`)

**State Machine:**
```
1. Frame Extraction (1 FPS)
   ↓
2. Scoreboard ROI Detection (Region of Interest)
   ↓
3. EasyOCR Text Recognition
   ↓
4. Score Delta Detection (Median Smoothing to prevent flicker)
   ↓
5. Event Classification (4, 6, Wicket)
   ↓
6. FFmpeg Clip Extraction (Zero-Copy cutting)
   ↓
7. Supercut Generation (Compile highlights)
```

**Median Smoothing Anti-Flicker:**
```python
# Maintains rolling history of last 5 frames
deque([98, 99, 100, 101, 102], maxlen=5)

# Uses MEDIAN (not mean) to ignore temporary flicker
median_score = 100  # Ignores temporary 101, 102 jumps
```

**ROI Calibration:**
- Default: `x=240, y=940, width=170, height=80` (1080p)
- Override: Provide custom ROI for different video resolutions
- Tool: Use `scripts/roi_calibrator.py` to find optimal ROI

### Supported Event Types

| Event | Detection | Score Change |
|-------|-----------|--------------|
| FOUR | 4 runs off bat | +4 |
| SIX | 6 runs off bat | +6 |
| WICKET | Batsman dismissed | +0 or +1 (bye/leg bye) |

### Filtering Results
```bash
GET /api/v1/videos/{video_id}/events?event_type=SIX
# Returns only SIX events

GET /api/v1/videos/{video_id}/events?event_type=WICKET
# Returns only WICKET events
```

---

## 2. Batting Biomechanics Analysis

### Overview
Analyzes batting videos using MediaPipe Pose to detect stance quality, technique flaws, and provide drill recommendations.

### How It Works

**Upload Video:**
```bash
POST /api/v1/batting/analyze
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=@batting_practice.mp4
```

**Response:**
```json
{
  "id": "analysis-uuid",
  "created_at": "2026-03-16T10:00:00Z",
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
      "correction": "Lower elbow to 90 degrees for better drive generation"
    },
    {
      "flaw": "Late bat swing",
      "severity": "medium",
      "frames": [20, 21],
      "correction": "Initiate bat movement earlier"
    }
  ],
  "drill_recommendations": [
    "Front-foot drive drills (medium pace)",
    "Shadow batting (10 min daily)",
    "Strength training: forearm curls"
  ],
  "video_url": "gs://sports-ai-storage/batting_videos/...",
  "pdf_report_url": "https://storage.googleapis.com/..."
}
```

### Metrics Tracked

| Metric | Range | Optimal |
|--------|-------|---------|
| Stance Angle | 0-180° | 45-60° |
| Bat Lift Height | 0-200cm | 100-150cm |
| Front Foot Movement | 0-1.0 | 0.8-1.0 |
| Back Knee Bend | 0-90° | 20-40° |
| Head Position | Fixed/Moving | Fixed ✅ |

### PDF Report
- Auto-generated with:
  - Key metrics
  - Flaws identified
  - Drill recommendations
  - Video frames showing issues
  - Comparison to baseline (if previous analysis exists)

### History Tracking
```bash
GET /api/v1/batting/list
# Returns all batting analyses for current user

GET /api/v1/batting/{id}
# Returns specific analysis
```

---

## 3. Bowling Biomechanics Analysis

### Overview
Analyzes bowling action using MediaPipe Pose to detect delivery flaws, release consistency, and biomechanical issues.

### How It Works

**Upload Video:**
```bash
POST /api/v1/bowling/analyze
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=@bowling_practice.mp4
```

**Response:**
```json
{
  "id": "analysis-uuid",
  "created_at": "2026-03-16T10:00:00Z",
  "biometrics": {
    "run_up_speed": 8.5,
    "release_height": 215,
    "ball_speed_estimate": 142,
    "release_point_stability": 0.92,
    "front_arm_alignment": 0.88,
    "back_arm_flexibility": 0.85,
    "stride_length": 85
  },
  "detected_flaws": [
    {
      "flaw": "Front arm drift during delivery",
      "severity": "medium",
      "frames": [20, 21, 22, 23],
      "correction": "Keep front arm stable and pointing at batsman"
    },
    {
      "flaw": "Inconsistent release point (3cm variance)",
      "severity": "high",
      "frames": [15, 25, 35],
      "correction": "Practice with line markings on crease"
    }
  ],
  "drill_recommendations": [
    "Crease movement practice (steps, line)",
    "One-step yorker drills",
    "Speed & accuracy drills"
  ],
  "video_url": "gs://sports-ai-storage/bowling_videos/...",
  "pdf_report_url": "https://storage.googleapis.com/..."
}
```

### Metrics Tracked

| Metric | Typical Range | Notes |
|--------|---------------|-------|
| Run-up Speed | 6-10 m/s | Consistency important |
| Release Height | 180-230 cm | Taller bowlers = higher |
| Ball Speed Estimate | 120-150 km/h | Estimated from arm velocity |
| Release Stability | 0.0-1.0 | >0.9 = very consistent |
| Front Arm Alignment | 0.0-1.0 | Should point at batter |
| Stride Length | 70-100 cm | Affects pace & accuracy |

### Advanced Analysis

**Release Point Tracking:**
- Frame-by-frame position of release
- Identifies consistency issues
- Detects if bowler moves runway

**Action Classification:**
```
Fast Bowling (>130 km/h)
  ├─ Seam Bowling
  ├─ Swing Bowling
  └─ Bounce Bowling

Medium Pace (100-130 km/h)
  └─ Accuracy focus

Spin Bowling (<100 km/h)
  ├─ Off-spin
  ├─ Leg-spin
  └─ Left-arm orthodox
```

---

## 4. Player Submissions (Coach Review)

### Overview
Enables players to upload videos for coach review. Coaches provide feedback, AI analysis, and generatePDF reports.

### Workflow Diagram
```
PLAYER uploads video
      ↓
COACH sees in inbox (GET /submissions/coach/me)
      ↓
COACH triggers AI analysis (POST /submissions/{id}/analyze)
      ↓
AI generates recommendations (MediaPipe + Gemini)
      ↓
COACH edits feedback text manually
      ↓
COACH publishes report (PUT /submissions/{id}/publish)
      ↓
PLAYER sees published report (GET /submissions/player/me)
      ↓
PLAYER downloads PDF
```

### API Endpoints

**Player Upload:**
```bash
POST /api/v1/submissions/upload
Authorization: Bearer <player_token>
Content-Type: multipart/form-data

file=@my_batting_video.mp4
coach_id=coach-uuid
title=Coaching Review Request
description=Please review my batting stance
```

**Coach Inbox:**
```bash
GET /api/v1/submissions/coach/me
Authorization: Bearer <coach_token>
# Returns submissions with status: PENDING, PROCESSING, DRAFT_REVIEW
```

**Coach Analyze:**
```bash
POST /api/v1/submissions/{id}/analyze
Authorization: Bearer <coach_token>
# Triggers background MediaPipe + Gemini analysis
```

**Coach Publish:**
```bash
PUT /api/v1/submissions/{id}/publish
Authorization: Bearer <coach_token>
Content-Type: application/json

{
  "feedback_text": "Great footwork! Work on your backswing.",
  "is_public": false
}
# Returns: PDF report URL
```

**Player View Results:**
```bash
GET /api/v1/submissions/player/me
Authorization: Bearer <player_token>
# Returns published submissions with PDF links
```

### Submission Statuses

| Status | Description | Who Can Action |
|--------|-------------|---|
| PENDING | Awaiting coach review | Coach |
| PROCESSING | AI analysis running | System |
| DRAFT_REVIEW | Coach editing feedback | Coach |
| PUBLISHED | Final report ready | Player (download) |
| REJECTED | Coach declined | - |

---

## 5. Subscription Management

### Overview
Manages user subscriptions, plans, and access control.

### Plans

| Plan | Cost | Features |
|------|------|----------|
| **PLAYER** | FREE | Browse public library, vote on requests |
| **COACH** | FREE | Private uploads, player submissions, AI analysis |
| **ADMIN** | N/A | Full access, manage system |

### Upgrade Flow
```bash
POST /api/v1/subscription/upgrade
Authorization: Bearer <token>
# Redirects to Stripe checkout
# On success: user role changed to COACH
```

### Check Status
```bash
GET /api/v1/subscription/me
# Returns current plan & expiry
```

### Downgrade
```bash
POST /api/v1/subscription/downgrade
# Changes role back to PLAYER, deletes private videos (optional)
```

### Cancel
```bash
POST /api/v1/subscription/{id}/cancel
# Immediate cancellation
```

---

## 6. Admin Features

### Overview
Admin-only endpoints for managing the platform.

### Coach Verification
```bash
# List pending coach approvals
GET /api/v1/admin_coaches/pending

# Approve coach
POST /api/v1/admin_coaches/{coach_id}/approve

# Reject coach
POST /api/v1/admin_coaches/{coach_id}/reject
```

### Request Dashboard
```bash
# View all match requests sorted by votes
GET /api/v1/requests/admin/dashboard
# Returns: [{title, votes, status, requested_by}, ...]

# Mark request as fulfilled
PATCH /api/v1/requests/{id}/status
{"status": "FULFILLED", "fulfilled_video_id": "video-uuid"}
```

### Job Monitoring
```bash
# View all pending OCR jobs
GET /api/v1/jobs/pending

# View system stats
GET /api/v1/jobs/stats
# Returns: {total_processed, avg_time, failures, success_rate}
```

---

## 7. Community Features

### Match Requests
Players can request cricketmatches to be analyzed.

**Create Request:**
```bash
POST /api/v1/requests/
Authorization: Bearer <token>
{
  "match_title": "IPL Final 2026",
  "match_date": "2026-03-20",
  "teams": "RCB vs MI"
}
```

**Vote on Request:**
```bash
POST /api/v1/requests/{id}/vote
# Increments vote count
```

**Popular Requests:**
```bash
GET /api/v1/requests/
# Sorted by vote_count DESC
```

---

## 📊 Feature Statistics

### Performance Metrics
- OCR Processing Time: ~2-5 min per hour of video
- Batting Analysis: ~1-2 min per bowling
- PDF Generation: ~30 seconds
- GCS Upload/Download: Network-speed dependent

### Limitations
- Max Video Size: 10GB
- Max Concurrent Jobs: 5 (Cloud Run concurrency)
- Video Length Limit: None (processes in chunks)

---

**Last Updated:** March 16, 2026
