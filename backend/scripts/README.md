# OCR Engine Scripts

Production-ready scripts for cricket highlight generation using offline OCR.

---

## 📂 Files

### `ocr_engine.py` (563 lines) - **MAIN ENGINE**
Core OCR-based highlight detection system.

**Features:**
- Fuzzy score parsing (4-strategy fallback)
- Wicket-prioritized event detection
- Median smoothing (anti-flicker)
- Zero-copy FFmpeg video cutting
- GPU acceleration support

**Usage:**
```bash
# Basic usage
python ocr_engine.py --video-path "storage/raw/match.mp4" --gpu

# With debug output
python ocr_engine.py --video-path "storage/raw/match.mp4" --debug

# Custom output directory
python ocr_engine.py --video-path "storage/raw/match.mp4" --output-dir "output/clips"
```

**CLI Arguments:**
- `--video-path`: Path to cricket match video (required)
- `--output-dir`: Output directory for trimmed clips (default: `storage/trimmed`)
- `--gpu`: Enable GPU acceleration for OCR
- `--debug`: Save debug frames showing ROI detection

---

### `find_scoreboard_roi.py` - **ROI CALIBRATION TOOL**
Interactive tool to calibrate scoreboard Region of Interest.

**Features:**
- Visual rectangle selection on video frames
- Real-time coordinate display
- Export ROI configuration to JSON

**Usage:**
```bash
python find_scoreboard_roi.py --video-path "storage/raw/match.mp4"
```

**Interactive Controls:**
- **Click & Drag:** Draw rectangle over scoreboard area
- **`r` key:** Reset selection
- **`SPACE` key:** Confirm and save ROI coordinates
- **`q` key:** Quit without saving

**Output:**
```json
{
  "roi_x": 240,
  "roi_y": 940,
  "roi_width": 170,
  "roi_height": 80
}
```

---

## 📊 Performance

**Accuracy (7.6-hour test match):**
- FOURs: ~92.6%
- SIXs: ~85% (fuzzy parsing)
- WICKETs: ~78% (separator-agnostic)

**Processing Speed:**
- CPU: ~1 frame/second
- GPU: ~5 frames/second

---

## 🛠️ Configuration

### Default ROI (1080p broadcasts)
```python
ROI_X = 240
ROI_Y = 940
ROI_W = 170
ROI_H = 80
```

### OCR Settings
```python
MIN_CONFIDENCE = 0.4
ALLOWLIST = '0123456789/.'
HISTORY_SIZE = 5  # Median smoothing window
```

### Event Detection
```python
COOLDOWN_SECONDS = 10.0  # Time between events
MAX_RUNS_PER_BALL = 8    # Sanity check
```