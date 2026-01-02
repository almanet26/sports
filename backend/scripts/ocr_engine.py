"""
Cricket Highlight Generator - OCR-Based Event Detection

Detects Fours, Sixes, and Wickets by reading on-screen scoreboard using EasyOCR.
Outputs individual clips and a supercut highlight reel via FFmpeg.

Usage:
    python ocr_engine.py --video-path "match.mp4" --gpu
    python ocr_engine.py --video-path "match.mp4" --visualize --timestamp 5900
"""

import cv2
import re
import csv
import json
import logging
import argparse
import subprocess
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from collections import deque

try:
    import easyocr
except ImportError:
    raise ImportError("EasyOCR required. Install with: pip install easyocr")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# CONFIGURATION
class ScoreboardConfig:
    """ROI configuration for scoreboard regions (calibrated for 1080p broadcasts)."""

    DEFAULTS = {
        'score': {'x': 216, 'y': 940, 'width': 170, 'height': 70},
        'overs': {'x': 216, 'y': 1010, 'width': 100, 'height': 40},
    }

    def __init__(self, config_file: Optional[str] = None):
        self._load_config(config_file)
        self.use_gpu = False
        self.start_time = 0.0

    def _load_config(self, config_file: Optional[str]):
        """Load from file or use calibrated defaults."""
        if config_file and Path(config_file).exists():
            with open(config_file, 'r') as f:
                cfg = json.load(f)
            self.roi_x = cfg.get('roi_x', self.DEFAULTS['score']['x'])
            self.roi_y = cfg.get('roi_y', self.DEFAULTS['score']['y'])
            self.roi_width = cfg.get('roi_width', self.DEFAULTS['score']['width'])
            self.roi_height = cfg.get('roi_height', self.DEFAULTS['score']['height'])
            self.overs_roi_x = cfg.get('overs_roi_x', self.DEFAULTS['overs']['x'])
            self.overs_roi_y = cfg.get('overs_roi_y', self.DEFAULTS['overs']['y'])
            self.overs_roi_width = cfg.get('overs_roi_width', self.DEFAULTS['overs']['width'])
            self.overs_roi_height = cfg.get('overs_roi_height', self.DEFAULTS['overs']['height'])
        else:
            self.roi_x = self.DEFAULTS['score']['x']
            self.roi_y = self.DEFAULTS['score']['y']
            self.roi_width = self.DEFAULTS['score']['width']
            self.roi_height = self.DEFAULTS['score']['height']
            self.overs_roi_x = self.DEFAULTS['overs']['x']
            self.overs_roi_y = self.DEFAULTS['overs']['y']
            self.overs_roi_width = self.DEFAULTS['overs']['width']
            self.overs_roi_height = self.DEFAULTS['overs']['height']

        logger.info(f"Score ROI: ({self.roi_x}, {self.roi_y}) {self.roi_width}x{self.roi_height}")
        logger.info(f"Overs ROI: ({self.overs_roi_x}, {self.overs_roi_y}) {self.overs_roi_width}x{self.overs_roi_height}")

    def save(self, config_file: str):
        """Persist configuration to JSON file."""
        config = {
            'roi_x': self.roi_x, 'roi_y': self.roi_y,
            'roi_width': self.roi_width, 'roi_height': self.roi_height,
            'overs_roi_x': self.overs_roi_x, 'overs_roi_y': self.overs_roi_y,
            'overs_roi_width': self.overs_roi_width, 'overs_roi_height': self.overs_roi_height,
        }
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        logger.info(f"Config saved to {config_file}")


# DATA MODELS
class ScoreState:
    """Immutable cricket score representation."""

    def __init__(self, runs: int = 0, wickets: int = 0):
        self.runs = runs
        self.wickets = wickets  # -1 = runs-only mode

    def __repr__(self) -> str:
        return f"{self.runs}/{self.wickets}" if self.wickets >= 0 else str(self.runs)

    def __eq__(self, other) -> bool:
        if other is None:
            return False
        return self.runs == other.runs and self.wickets == other.wickets

    def __hash__(self) -> int:
        return hash((self.runs, self.wickets))


# TEXT PARSING (Separator-Agnostic, Wicket-Prioritized)
# OCR corrections: common misreadings 
OCR_CORRECTIONS = {
    'O': '0', 'o': '0',
    'S': '5', 's': '5',
    'I': '1', 'l': '1', '|': '1',
    'B': '8',
    'b': '6',  
    'G': '6', 'g': '6',  
}


def clean_ocr_text(text: str) -> str:
    """Fix common OCR misreadings typos."""
    for old, new in OCR_CORRECTIONS.items():
        text = text.replace(old, new)
    return text


def parse_overs(text: str) -> Optional[Tuple[int, int]]:
    """Parse overs string '14.2' -> (14, 2)."""
    cleaned = re.sub(r'[^0-9.]', '', clean_ocr_text(text))
    match = re.search(r'(\d{1,2})\.(\d)', cleaned)
    if match:
        overs, balls = int(match.group(1)), int(match.group(2))
        if overs <= 50 and balls <= 5:
            return (overs, balls)
    return None


def parse_score(text: str, prev_wickets: Optional[int] = None) -> Optional[ScoreState]:
    """
    Parse score text with FUZZY, separator-agnostic logic.
    
    Strategy (in order of priority):
    1. Strict slash format: "145/3"
    2. Space-separated: "145 3" or "145  3"
    3. Last-digit heuristic: "1453" -> 145/3 (if prev_wickets context available)
    4. Runs-only fallback: "145"
    
    Args:
        text: Raw OCR text
        prev_wickets: Previous wicket count for last-digit heuristic (0-10)
    """
    if not text or not text.strip():
        return None

    text = clean_ocr_text(text)
    original = text
    
    # Normalize common separator substitutes to slash
    text = re.sub(r'[f|\\]', '/', text)
    
    # === STRATEGY 1: Strict slash format "145/3" ===
    cleaned = re.sub(r'[^0-9/]', '', text).strip()
    match = re.match(r'^(\d{1,3})/(\d{1,2})$', cleaned)
    if match:
        runs, wickets = int(match.group(1)), int(match.group(2))
        if runs <= 999 and 0 <= wickets <= 10:
            return ScoreState(runs, wickets)
    
    # === STRATEGY 2: Space-separated "145 3" ===
    space_match = re.match(r'^(\d{1,3})\s+(\d{1,2})$', original.strip())
    if space_match:
        runs, wickets = int(space_match.group(1)), int(space_match.group(2))
        if runs <= 999 and 0 <= wickets <= 10:
            logger.debug(f"Parsed space-separated: '{original}' -> {runs}/{wickets}")
            return ScoreState(runs, wickets)
    
    # === STRATEGY 3: Last-digit heuristic for concatenated strings ===
    # If OCR reads "1352" and prev_wickets was 1, assume last digit is wickets
    digits_only = re.sub(r'[^0-9]', '', text)
    if len(digits_only) >= 2 and prev_wickets is not None:
        last_digit = int(digits_only[-1])
        # Wicket must be plausible: same or +1 from previous
        if 0 <= last_digit <= 10 and last_digit in (prev_wickets, prev_wickets + 1):
            runs_str = digits_only[:-1]
            if runs_str and len(runs_str) <= 3:
                runs = int(runs_str)
                if runs <= 999:
                    logger.debug(f"Parsed last-digit heuristic: '{original}' -> {runs}/{last_digit}")
                    return ScoreState(runs, last_digit)
    
    # === STRATEGY 4: Runs-only fallback ===
    if re.match(r'^\d{1,3}$', digits_only) and len(digits_only) <= 3:
        runs = int(digits_only)
        if runs <= 999:
            return ScoreState(runs, -1)  # -1 = runs-only mode

    return None


# OCR ENGINE
class OCRScoreReader:
    """Reads cricket scores from video frames using EasyOCR."""

    UPSCALE = 3
    OCR_ALLOWLIST = '0123456789/.' 
    def __init__(self, config: ScoreboardConfig, use_gpu: bool = False):
        self.config = config
        self.reader = easyocr.Reader(['en'], gpu=use_gpu)
        logger.info(f"EasyOCR initialized (GPU: {use_gpu})")

    def _preprocess(self, roi) -> any:
        """Preprocessing pipeline: grayscale -> upscale -> blur -> CLAHE -> OTSU -> invert -> morph."""
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, None, fx=self.UPSCALE, fy=self.UPSCALE, interpolation=cv2.INTER_CUBIC)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        binary = cv2.bitwise_not(binary)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        return cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    def _extract_region(self, frame, x: int, y: int, w: int, h: int, debug_path: Optional[str] = None) -> Optional[any]:
        """Extract and preprocess a region from frame."""
        try:
            height, width = frame.shape[:2]
            x, y = min(x, width - w), min(y, height - h)
            roi = frame[y:y+h, x:x+w]

            if debug_path:
                cv2.imwrite(f"{debug_path}_raw.jpg", roi)

            processed = self._preprocess(roi)

            if debug_path:
                cv2.imwrite(f"{debug_path}_processed.jpg", processed)

            return processed
        except Exception as e:
            logger.debug(f"ROI extraction error: {e}")
            return None

    def extract_score_roi(self, frame, debug_path: Optional[str] = None) -> Optional[any]:
        """Extract score region."""
        path = f"{debug_path}_score" if debug_path else None
        return self._extract_region(frame, self.config.roi_x, self.config.roi_y, self.config.roi_width, self.config.roi_height, path)

    def extract_overs_roi(self, frame, debug_path: Optional[str] = None) -> Optional[any]:
        """Extract overs region."""
        path = f"{debug_path}_overs" if debug_path else None
        return self._extract_region(frame, self.config.overs_roi_x, self.config.overs_roi_y, self.config.overs_roi_width, self.config.overs_roi_height, path)

    def read_score(self, roi_image, min_confidence: float = 0.4, prev_wickets: Optional[int] = None) -> Tuple[Optional[ScoreState], float, str]:
        """
        Read score from preprocessed ROI with confidence filtering.
        
        Args:
            roi_image: Preprocessed ROI image
            min_confidence: Minimum confidence threshold
            prev_wickets: Previous wicket count for last-digit heuristic
        """
        try:
            results = self.reader.readtext(roi_image, detail=1, allowlist=self.OCR_ALLOWLIST, paragraph=False)
            if not results:
                return None, 0.0, "<empty>"

            texts = [r[1] for r in results]
            confidences = [r[2] for r in results]
            raw_text = ' '.join(texts)
            avg_conf = sum(confidences) / len(confidences)

            if avg_conf < min_confidence:
                logger.debug(f"Low confidence ({avg_conf:.2f}): '{raw_text}'")
                return None, avg_conf, raw_text

            return parse_score(raw_text, prev_wickets), avg_conf, raw_text
        except Exception as e:
            logger.debug(f"OCR error: {e}")
            return None, 0.0, "<error>"

    def read_overs(self, roi_image) -> Optional[Tuple[int, int]]:
        """Read overs from preprocessed ROI."""
        try:
            results = self.reader.readtext(roi_image, detail=0, allowlist=self.OCR_ALLOWLIST, paragraph=False)
            text = ' '.join(results) if results else ""
            return parse_overs(text) if text.strip() else None
        except Exception as e:
            logger.debug(f"Overs OCR error: {e}")
            return None


# EVENT DETECTION
class EventDetector:
    """
    Detects cricket events (FOUR, SIX) from score changes.
    Uses median smoothing, new-ball logic, and sanity bounds.
    """

    MAX_RUNS_PER_BALL = 8
    RESET_PERSISTENCE_SECONDS = 60.0

    def __init__(self, cooldown_seconds: float = 10.0, history_size: int = 5):
        self.cooldown = cooldown_seconds
        self.history_size = history_size
        self.reset()

    def reset(self):
        """Reset all state."""
        self.last_event_time = -999.0
        self.last_stable_score: Optional[ScoreState] = None
        self.last_over: Optional[Tuple[int, int]] = None
        self.runs_history: deque = deque(maxlen=self.history_size)
        self.wickets_history: deque = deque(maxlen=self.history_size)
        self.reset_candidate: Optional[ScoreState] = None
        self.reset_candidate_time = 0.0

    def _get_median_score(self) -> Optional[ScoreState]:
        """Calculate median score from history buffer."""
        if len(self.runs_history) < self.history_size:
            return None
        median_runs = sorted(self.runs_history)[self.history_size // 2]
        valid_wickets = [w for w in self.wickets_history if w >= 0]
        median_wickets = sorted(valid_wickets)[len(valid_wickets) // 2] if valid_wickets else 0
        return ScoreState(median_runs, median_wickets)

    def _is_plausible(self, score: ScoreState) -> bool:
        """Basic sanity check for cricket score."""
        if score.runs < 0 or score.runs > 400:
            return False
        if score.wickets >= 0 and score.wickets > 10:
            return False
        return True

    def _create_event(self, event_type: str, old: ScoreState, new: ScoreState, timestamp: float) -> Dict:
        """Create event dictionary."""
        return {
            'type': event_type,
            'timestamp': timestamp,
            'score_before': str(old),
            'score_after': str(new),
            'description': f'Score: {old} → {new}'
        }

    def _detect_wicket(self, old: ScoreState, new: ScoreState, timestamp: float) -> Optional[Dict]:
        """
        Detect WICKET event (PRIORITY 1).
        
        Wicket detection is prioritized over runs because:
        - Wickets only increment by 1
        - Runs are often misread during wicket celebration animations
        - Wicket count is more reliable (single digit 0-10)
        """
        if old.wickets < 0 or new.wickets < 0:
            return None  # Can't detect wickets in runs-only mode
        
        wickets_diff = new.wickets - old.wickets
        
        # Wicket: exactly +1 wicket (regardless of runs)
        if wickets_diff == 1:
            return self._create_event('WICKET', old, new, timestamp)
        
        return None

    def _detect_boundary(self, old: ScoreState, new: ScoreState, timestamp: float) -> Optional[Dict]:
        """
        Detect FOUR or SIX from score delta (PRIORITY 2).
        
        Uses exact matching for FOUR (4) and fuzzy matching for SIX (5, 6, or 7)
        since OCR commonly misreads '6' as '5' or '8'.
        """
        runs_diff = new.runs - old.runs
        
        # FOUR
        if runs_diff == 4:
            return self._create_event('FOUR', old, new, timestamp)
        
        # SIX
        if runs_diff in (5, 6, 7):
            return self._create_event('SIX', old, new, timestamp)
        
        return None

    def get_last_wickets(self) -> Optional[int]:
        """Get last known wicket count for parse_score heuristic."""
        if self.last_stable_score and self.last_stable_score.wickets >= 0:
            return self.last_stable_score.wickets
        # Check history for valid wicket
        valid = [w for w in self.wickets_history if w >= 0]
        return valid[-1] if valid else None

    def detect(self, score: ScoreState, timestamp: float, overs: Optional[Tuple[int, int]] = None) -> Optional[Dict]:
        """
        Process score reading and detect events.
        
        Event Priority:
        1. WICKET (wickets +1) - trumps all, runs often wrong during celebration
        2. SIX (runs +5/+6/+7) - fuzzy due to OCR '6' errors
        3. FOUR (runs +4) - exact match
        """
        if not score or not self._is_plausible(score):
            return None

        # New ball logic: skip if same ball
        if overs and self.last_over:
            progressed = (overs[0] > self.last_over[0] or (overs[0] == self.last_over[0] and overs[1] > self.last_over[1]))
            if not progressed:
                self.runs_history.append(score.runs)
                self.wickets_history.append(score.wickets)
                return None

        if overs:
            self.last_over = overs

        # Cooldown
        if timestamp - self.last_event_time < self.cooldown:
            self.runs_history.append(score.runs)
            self.wickets_history.append(score.wickets)
            return None

        self.runs_history.append(score.runs)
        self.wickets_history.append(score.wickets)
        stable = self._get_median_score()

        if not stable:
            return None

        # First stable score
        if self.last_stable_score is None:
            logger.info(f"📍 Initial score: {stable}")
            self.last_stable_score = stable
            return None

        if stable == self.last_stable_score:
            return None

        runs_diff = stable.runs - self.last_stable_score.runs
        wickets_diff = stable.wickets - self.last_stable_score.wickets if stable.wickets >= 0 else 0

        # Handle score decrease (potential innings reset)
        if runs_diff < 0:
            if self.reset_candidate == stable:
                if timestamp - self.reset_candidate_time > self.RESET_PERSISTENCE_SECONDS:
                    logger.info(f"🔄 Score reset: {self.last_stable_score} → {stable}")
                    self.last_stable_score = stable
                    self.reset_candidate = None
            else:
                self.reset_candidate = stable
                self.reset_candidate_time = timestamp
            return None

        self.reset_candidate = None

        # Reject implausible jumps (but allow wicket events through)
        if runs_diff > self.MAX_RUNS_PER_BALL and wickets_diff != 1:
            self.last_stable_score = stable
            return None

        # === EVENT DETECTION WITH PRIORITY ===
        event = None
        
        # PRIORITY 1: Wicket detection (trumps runs)
        event = self._detect_wicket(self.last_stable_score, stable, timestamp)
        
        # PRIORITY 2: Boundary detection (only if no wicket)
        if not event:
            event = self._detect_boundary(self.last_stable_score, stable, timestamp)

        if event:
            emoji = {'WICKET': '🏏', 'FOUR': '🎯', 'SIX': '🚀'}.get(event['type'], '⚡')
            over_str = f" (Over: {overs[0]}.{overs[1]})" if overs else ""
            logger.info(f"[{self._format_time(timestamp)}] {emoji} {event['type']}: "
                       f"{self.last_stable_score} → {stable}{over_str}")
            self.last_event_time = timestamp

        self.last_stable_score = stable
        return event

    @staticmethod
    def _format_time(seconds: float) -> str:
        """Format seconds as HH:MM:SS."""
        h, m, s = int(seconds // 3600), int((seconds % 3600) // 60), int(seconds % 60)
        return f"{h:02d}:{m:02d}:{s:02d}"


# VIDEO PROCESSING
def visualize_roi(video_path: str, config: ScoreboardConfig, timestamp: float = 5900.0) -> str:
    """Draw ROI boxes on a single frame for calibration verification."""
    logger.info("=" * 60)
    logger.info("🔍 ROI VISUALIZATION MODE")
    logger.info("=" * 60)

    video = cv2.VideoCapture(video_path)
    if not video.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    fps = video.get(cv2.CAP_PROP_FPS)
    video.set(cv2.CAP_PROP_POS_FRAMES, int(timestamp * fps))
    ret, frame = video.read()
    video.release()

    if not ret:
        raise ValueError(f"Cannot read frame at {timestamp}s")

    # Draw Score ROI (green)
    cv2.rectangle(frame, (config.roi_x, config.roi_y), (config.roi_x + config.roi_width, config.roi_y + config.roi_height), (0, 255, 0), 3)
    cv2.putText(frame, "SCORE", (config.roi_x, config.roi_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    # Draw Overs ROI (blue)
    cv2.rectangle(frame, (config.overs_roi_x, config.overs_roi_y), (config.overs_roi_x + config.overs_roi_width, config.overs_roi_y + config.overs_roi_height), (255, 0, 0), 3)
    cv2.putText(frame, "OVERS", (config.overs_roi_x, config.overs_roi_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)

    output_path = "roi_check.jpg"
    cv2.imwrite(output_path, frame)
    logger.info(f"✅ Saved: {output_path}")
    logger.info(f"   Score ROI (GREEN): ({config.roi_x}, {config.roi_y}) {config.roi_width}x{config.roi_height}")
    logger.info(f"   Overs ROI (BLUE):  ({config.overs_roi_x}, {config.overs_roi_y}) {config.overs_roi_width}x{config.overs_roi_height}")
    return output_path


def process_video(video_path: str, config: ScoreboardConfig, sample_interval: float = 1.0, max_frames: Optional[int] = None, debug_mode: bool = False, min_confidence: float = 0.4) -> List[Dict]:
    """Process video to detect cricket events."""
    logger.info("=" * 60)
    logger.info("🏏 CRICKET HIGHLIGHT DETECTION")
    logger.info("=" * 60)

    reader = OCRScoreReader(config, use_gpu=config.use_gpu)
    detector = EventDetector()
    events = []

    debug_dir = Path("debug_frames") if debug_mode else None
    if debug_dir:
        debug_dir.mkdir(exist_ok=True)
        logger.info(f"Debug output: {debug_dir}/")

    video = cv2.VideoCapture(video_path)
    if not video.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    fps = video.get(cv2.CAP_PROP_FPS)
    total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_skip = max(1, int(fps * sample_interval))
    frames_to_process = min(total_frames // frame_skip, max_frames or float('inf'))

    logger.info(f"Video: {Path(video_path).name} ({total_frames/fps/3600:.1f}h, {fps:.0f}fps)")
    logger.info(f"Sampling: every {sample_interval}s (~{int(frames_to_process)} frames)")
    logger.info(f"Confidence threshold: {min_confidence}")

    # Seek to start time
    start_time = config.start_time
    if start_time > 0:
        video.set(cv2.CAP_PROP_POS_FRAMES, int(start_time * fps))
        logger.info(f"Starting from {start_time}s ({start_time/3600:.2f}h)")

    frame_count = int(start_time * fps) if start_time > 0 else 0
    processed = 0
    stats = {'success': 0, 'fail': 0, 'low_conf': 0}
    last_valid_score = None
    candidate_score, candidate_count = None, 0

    try:
        while True:
            ret, frame = video.read()
            if not ret:
                break

            if frame_count % frame_skip == 0:
                timestamp = frame_count / fps
                processed += 1

                debug_path = str(debug_dir / f"frame_{processed:05d}") if debug_mode and processed % 10 == 0 else None

                # Get previous wickets for parse_score heuristic
                prev_wickets = detector.get_last_wickets()

                # Read score with wicket context for fuzzy parsing
                roi = reader.extract_score_roi(frame, debug_path)
                score, conf, text = (None, 0.0, "<no ROI>") if roi is None else reader.read_score(
                    roi, min_confidence, prev_wickets
                )

                if score is None and 0 < conf < min_confidence:
                    stats['low_conf'] += 1

                # Read overs
                overs_roi = reader.extract_overs_roi(frame, debug_path)
                overs = reader.read_overs(overs_roi) if overs_roi is not None else None

                # Value persistence
                if score:
                    stats['success'] += 1
                    last_valid_score = score
                else:
                    stats['fail'] += 1
                    score = last_valid_score

                logger.debug(f"Frame {processed}: '{text}' conf={conf:.2f} → {score}")

                # 2-frame confirmation
                if score:
                    if candidate_score == score:
                        candidate_count += 1
                        if candidate_count >= 2:
                            event = detector.detect(score, timestamp, overs)
                            if event:
                                events.append(event)
                    else:
                        candidate_score, candidate_count = score, 1

                # Progress
                if processed % 100 == 0:
                    rate = stats['success'] / processed * 100
                    logger.info(f"Progress: {processed}/{int(frames_to_process)} | OCR: {rate:.0f}% | Events: {len(events)}")

                if max_frames and processed >= max_frames:
                    break

            frame_count += 1

    except KeyboardInterrupt:
        logger.info("Interrupted")
    finally:
        video.release()

    # Summary
    total = max(processed, 1)
    logger.info("-" * 60)
    logger.info(f"✅ Analysis complete: {processed} frames")
    logger.info(f"   OCR Success: {stats['success']} ({stats['success']/total*100:.1f}%)")
    logger.info(f"   OCR Failures: {stats['fail']} ({stats['fail']/total*100:.1f}%)")
    logger.info(f"   Low Confidence: {stats['low_conf']} ({stats['low_conf']/total*100:.1f}%)")
    logger.info(f"   Events detected: {len(events)}")

    if stats['fail'] > processed * 0.5:
        logger.warning("⚠️ High OCR failure rate. Run with --visualize to check ROI.")

    return events


# OUTPUT GENERATION
def extract_clips(video_path: str, events: List[Dict], output_dir: str, before: int = 12, after: int = 5) -> List[str]:
    """Extract video clips around detected events using FFmpeg."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    video_id = Path(video_path).stem
    clips = []

    logger.info(f"\n✂️ Extracting {len(events)} clips ({before}s before, {after}s after)")

    for i, event in enumerate(events, 1):
        ts = event['timestamp']
        start = max(0, ts - before)
        clip_name = f"{video_id}_clip_{i:03d}_{event['type']}_{int(ts)}.mp4"
        clip_path = Path(output_dir) / clip_name

        cmd = ['ffmpeg', '-ss', str(start), '-i', video_path, '-t', str(before + after), '-c', 'copy', '-avoid_negative_ts', '1', '-y', str(clip_path)]

        result = subprocess.run(cmd, capture_output=True)
        if result.returncode == 0:
            clips.append(str(clip_path))
            size = clip_path.stat().st_size / (1024 * 1024)
            logger.info(f"  [{i}/{len(events)}] {clip_name} ({size:.1f} MB)")
        else:
            logger.error(f"  [{i}/{len(events)}] Failed: {clip_name}")

    return clips


def create_supercut(clips: List[str], output_path: str) -> Optional[str]:
    """Concatenate clips into highlight reel."""
    if not clips:
        return None

    concat_file = Path(output_path).with_suffix('.txt')
    with open(concat_file, 'w') as f:
        for clip in clips:
            f.write(f"file '{Path(clip).absolute()}'\n")

    cmd = ['ffmpeg', '-f', 'concat', '-safe', '0', '-i', str(concat_file),
           '-c', 'copy', '-y', str(output_path)]
    result = subprocess.run(cmd, capture_output=True)
    concat_file.unlink()

    if result.returncode == 0:
        size = Path(output_path).stat().st_size / (1024 * 1024)
        logger.info(f"🎬 Supercut created: {output_path} ({size:.1f} MB)")
        return output_path

    logger.error("Failed to create supercut")
    return None


def save_events_csv(events: List[Dict], output_path: str):
    """Save events to CSV file."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['timestamp', 'type', 'description'])
        for event in events:
            writer.writerow([event['timestamp'], event['type'], event['description']])
    logger.info(f"📄 Events saved: {output_path}")


# CLI

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Cricket Highlight Generator - OCR-based')

    parser.add_argument('--video-path', required=True, help='Path to video file')
    parser.add_argument('--config', help='Path to config JSON file')
    parser.add_argument('--output-dir', default='storage/trimmed', help='Clips output directory')
    parser.add_argument('--supercut-dir', default='storage/highlight', help='Supercut output directory')
    parser.add_argument('--csv-output', help='Save events to CSV')

    parser.add_argument('--interval', type=float, default=1.0, help='Sample interval (seconds)')
    parser.add_argument('--max-frames', type=int, help='Max frames to process')
    parser.add_argument('--start-time', type=float, default=5900.0, help='Start time (seconds)')
    parser.add_argument('--min-confidence', type=float, default=0.4, help='OCR confidence threshold')

    # ROI overrides
    parser.add_argument('--roi-x', type=int)
    parser.add_argument('--roi-y', type=int)
    parser.add_argument('--roi-width', type=int)
    parser.add_argument('--roi-height', type=int)
    parser.add_argument('--overs-roi-x', type=int)
    parser.add_argument('--overs-roi-y', type=int)
    parser.add_argument('--overs-roi-width', type=int)
    parser.add_argument('--overs-roi-height', type=int)

    parser.add_argument('--before', type=int, default=12, help='Seconds before event')
    parser.add_argument('--after', type=int, default=5, help='Seconds after event')
    parser.add_argument('--no-clips', action='store_true', help='Skip clip extraction')
    parser.add_argument('--no-supercut', action='store_true', help='Skip supercut')

    parser.add_argument('--visualize', action='store_true', help='Visualize ROI and exit')
    parser.add_argument('--timestamp', type=float, default=0.0, help='Timestamp for visualization')
    parser.add_argument('--debug-mode', action='store_true', help='Save debug frames')
    parser.add_argument('--verbose', action='store_true', help='Verbose logging')
    parser.add_argument('--gpu', action='store_true', help='Enable GPU acceleration')

    return parser.parse_args()


def apply_roi_overrides(config: ScoreboardConfig, args):
    """Apply CLI ROI overrides to config."""
    if args.roi_x is not None:
        config.roi_x = args.roi_x
    if args.roi_y is not None:
        config.roi_y = args.roi_y
    if args.roi_width is not None:
        config.roi_width = args.roi_width
    if args.roi_height is not None:
        config.roi_height = args.roi_height
    if args.overs_roi_x is not None:
        config.overs_roi_x = args.overs_roi_x
    if args.overs_roi_y is not None:
        config.overs_roi_y = args.overs_roi_y
    if args.overs_roi_width is not None:
        config.overs_roi_width = args.overs_roi_width
    if args.overs_roi_height is not None:
        config.overs_roi_height = args.overs_roi_height


def main():
    args = parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)
        logging.getLogger().setLevel(logging.DEBUG)

    logger.info(f"GPU: {'ENABLED' if args.gpu else 'DISABLED'}")

    config = ScoreboardConfig(args.config)
    config.use_gpu = args.gpu
    config.start_time = args.start_time
    apply_roi_overrides(config, args)

    if args.visualize:
        visualize_roi(args.video_path, config, args.timestamp)
        return

    events = process_video(
        args.video_path, config,
        sample_interval=args.interval,
        max_frames=args.max_frames,
        debug_mode=args.debug_mode,
        min_confidence=args.min_confidence
    )

    # Summary
    counts = {}
    for e in events:
        counts[e['type']] = counts.get(e['type'], 0) + 1

    logger.info("\n📊 EVENT SUMMARY")
    for t, c in sorted(counts.items()):
        logger.info(f"   {t}: {c}")

    if args.csv_output:
        save_events_csv(events, args.csv_output)

    if not events:
        logger.warning("No events detected")
        return

    video_id = Path(args.video_path).stem

    clips = []
    if not args.no_clips:
        clips = extract_clips(args.video_path, events, args.output_dir, args.before, args.after)

    if not args.no_supercut and clips:
        supercut_path = Path(args.supercut_dir) / f"{video_id}_highlights.mp4"
        supercut_path.parent.mkdir(parents=True, exist_ok=True)
        create_supercut(clips, str(supercut_path))

    logger.info("\n✅ COMPLETE")


if __name__ == '__main__':
    main()
