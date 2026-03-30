# OCR Engine Test Suite

Comprehensive unit tests for the cricket highlight generator's OCR engine.

## Running Tests

### Run All Tests
```bash
# From project root
pytest backend/tests/

# From backend directory
cd backend
pytest tests/

# Verbose output
pytest tests/ -v

# With coverage report
pytest tests/ --cov=scripts --cov-report=html
```

### Run Specific Test Files
```bash
pytest backend/tests/test_event_detection.py
pytest backend/tests/test_ocr_logic.py
```

### Run Specific Test Cases
```bash
pytest backend/tests/test_event_detection.py::TestEventDetector::test_wicket_priority
pytest backend/tests/test_ocr_logic.py::TestEventDetector::test_jump_persistence_recovery
```

---

## Test Coverage

### `test_event_detection.py`
Tests the **wicket-prioritized event detection system**:
- ✅ FOUR detection (exact 4 runs)
- ✅ SIX detection with fuzzy matching (5, 6, 7 runs)
- ✅ WICKET detection (priority over boundaries)
- ✅ Wicket without runs (run outs)
- ✅ Huge score jump handling (no false events)
- ✅ Median smoothing (anti-flicker)
- ✅ Cooldown period (prevents duplicates)
- ✅ ScoreState dataclass functionality

### `test_ocr_logic.py`
Tests the **legacy event detection logic** (unittest-based):
- ✅ Jump persistence and recovery
- ✅ Normal event sequences
- ✅ Cooldown and debouncing
- ✅ Outlier rejection
- ✅ Edge cases (negative scores, wicket overflow)

---

## Test Data

Located in `backend/tests/data/`:
- `test_events_*.json` - Ground truth event timestamps
- `auto_detected_*.json` - OCR-detected events for validation
- `api_test_collection.json` - API endpoint test payloads
- `test_video_requests.json` - Sample video processing requests

---

## Expected Behavior

### Event Detection Priority
1. **WICKET** (Priority 1) - `wickets_diff == 1`
2. **SIX** (Priority 2) - `runs_diff in [5, 6, 7]` (fuzzy)
3. **FOUR** (Priority 3) - `runs_diff == 4` (exact)

### Fuzzy Parsing
- `'b' → '6'` (OCR misread)
- `'G' → '6'` (OCR misread)
- `'g' → '6'` (OCR misread)
- `'S' → '5'` (OCR misread)
- `'B' → '8'` (OCR misread)

### Median Smoothing
- History window: 5 frames
- Requires 3+ consecutive frames for stability
- Prevents flickering false positives

### Cooldown
- Default: 10 seconds between events
- Prevents duplicate detections
- Configurable per EventDetector instance

---

**Status:** ✅ All tests passing (wicket-prioritized detection system validated)
