# 🏏 Cricket Highlight Generator (Offline OCR)

**100% Offline Computer Vision pipeline** that detects FOURs, SIXs, and WICKETs from cricket match videos using OCR on the scoreboard overlay — **No External APIs Used for now**.

---

## 🎯 Features

- ✅ **Offline OCR Detection:** Uses EasyOCR to read scoreboard text from video frames
- ✅ **Event Detection:** Automatically identifies FOURs (4 runs), SIXs (6 runs), and WICKETs
- ✅ **Fuzzy Parsing:** Robust 4-strategy score parsing (slash/space/heuristic/runs-only fallback)
- ✅ **Wicket-Prioritized Logic:** Wickets detected first, then boundaries (prevents false positives)
- ✅ **Zero-Copy Video Editing:** Uses FFmpeg for fast, lossless highlight extraction
- ✅ **GPU Acceleration:** Optional CUDA support for faster OCR processing
- ✅ **YouTube Integration:** Download matches directly with `yt-dlp`

## 🚀 Quick Start

### Basic Usage
```bash
python main.py --video-path "backend/storage/raw/match.mp4" --gpu
```

### Full Command Reference
```bash
python main.py \
    --video-path "path/to/match.mp4" \
    --output-dir "backend/storage/trimmed" \
    --gpu \
    --debug
```

**Arguments:**
- `--video-path`: Path to cricket match video (MP4/MKV/AVI)
- `--output-dir`: Directory for trimmed highlights (default: `backend/storage/trimmed`)
- `--gpu`: Enable GPU acceleration for OCR (requires CUDA)
- `--debug`: Save debug frames showing ROI detection

---

## 🔧 Configuration

### Scoreboard ROI (Region of Interest)
The OCR engine reads from a specific region of the video where the scoreboard appears.

**Default ROI (1080p broadcasts):**
```python
ROI_X = 240
ROI_Y = 940
ROI_W = 170
ROI_H = 80
```

**Calibrate for Your Video:**
```bash
python backend/scripts/find_scoreboard_roi.py --video-path "path/to/match.mp4"
```
This opens an interactive window where you can draw a rectangle over the scoreboard area. Press `r` to reset, `SPACE` to confirm.

---

## 📊 Performance

- **Accuracy:** ~92.6% for FOURs, ~85% for SIXs, ~78% for WICKETs (7.6-hour match)
- **Processing Speed:** ~1 frame/second (CPU), ~5 frames/second (GPU)
- **False Positives:** Reduced via median smoothing (history window of 5 frames)

---

## 🔐 Test Accounts & Credentials

Subscriptions run on the **dynamic entitlement engine** (5 plans:
`bronze`/`silver`/`gold` for players, `coach_basic`/`coach_platinum` for
coaches). Plans/features/entitlements are auto-seeded on app startup, so you can
usually just register through the UI — every new account starts on the free plan
for its account type (`bronze` for players, `coach_basic` for coaches).

### Quick login accounts — `database/seed_users.py`

Basic role accounts (no preset subscription; resolve to the free plan).

| Email | Role | Password |
|-------|------|----------|
| `admin@test.com` | ADMIN | `1234567890` |
| `coach@test.com` | COACH | `1234567890` |
| `player@test.com` | PLAYER | `1234567890` |

```bash
cd backend
python database/seed_users.py
```

> ADMIN accounts bypass every feature/quota gate and can open the Plan
> Management panel (Admin → Plans) to create/edit plans, features and quotas.

### One-account-per-tier (with active subscriptions) — `scripts/seed_roles.py`

Use these to exercise each plan's gates and quotas. Each is created with an
active subscription on its tier; the script prints fresh JWTs to the terminal.

| Email | Role | Plan |
|-------|------|------|
| `bronze.test@sports.com` | PLAYER | bronze (free) |
| `silver.test@sports.com` | PLAYER | silver (₹200/mo) |
| `gold.test@sports.com` | PLAYER | gold (₹500/mo) |
| `coach_basic.test@sports.com` | COACH | coach_basic (free) |
| `coach_platinum.test@sports.com` | COACH | coach_platinum (₹1200/yr) |

**Password:** `Test@12345` (all five accounts)

```bash
cd backend
python scripts/seed_roles.py
```

`seed_roles.py` requires the plan catalog to exist. It is auto-seeded when the
API starts; to seed it manually (e.g. before running the script standalone):

```bash
cd backend
python scripts/seed_entitlements.py   # upserts the 5 plans + feature catalog
python scripts/seed_roles.py
```

> The app also self-heals schema drift on startup (adds `subscriptions.plan_id`,
> rebuilds a legacy `plans` table, seeds the catalog). For a clean production
> migration instead, run `alembic upgrade a1d2e3f4c5b6`.

---

## 🐛 Troubleshooting

### Issue: "FFmpeg not found"
**Solution:** Install FFmpeg and add to PATH.

### Issue: "No events detected"
1. Verify ROI coordinates using `find_scoreboard_roi.py`
2. Check if scoreboard text is clearly visible (no overlays/ads blocking it)
3. Enable `--debug` mode to inspect extracted frames

## Made for Cricket Fans, by Cricket Fans! 🏏❤️