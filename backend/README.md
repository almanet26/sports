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

## 🐛 Troubleshooting

### Issue: "FFmpeg not found"
**Solution:** Install FFmpeg and add to PATH.

### Issue: "No events detected"
1. Verify ROI coordinates using `find_scoreboard_roi.py`
2. Check if scoreboard text is clearly visible (no overlays/ads blocking it)
3. Enable `--debug` mode to inspect extracted frames
