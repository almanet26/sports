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
        'score': {'x': 140, 'y': 620, 'width': 100, 'height': 50},
        'overs': {'x': 140, 'y': 670, 'width': 60, 'height': 30},
        'batsman_name': {'x': 274, 'y': 620, 'width': 535, 'height': 40},  # Calibrated: HD overlay
        'bowler_name': {'x': 500, 'y': 670, 'width': 300, 'height': 30},  # Bowler name strip (below batsman row)
    }

    def __init__(self, config_file: Optional[str] = None):
        self._load_config(config_file)
        self.use_gpu = False
        # start_time can be set from config or CLI

    def _load_config(self, config_file: Optional[str]):
        """Load from file or use calibrated defaults."""
        self.suggested_start_time = None  # Default
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
            # Batsman name ROI
            self.batsman_roi_x = cfg.get('batsman_roi_x', self.DEFAULTS['batsman_name']['x'])
            self.batsman_roi_y = cfg.get('batsman_roi_y', self.DEFAULTS['batsman_name']['y'])
            self.batsman_roi_width = cfg.get('batsman_roi_width', self.DEFAULTS['batsman_name']['width'])
            self.batsman_roi_height = cfg.get('batsman_roi_height', self.DEFAULTS['batsman_name']['height'])
            # Bowler name ROI
            self.bowler_roi_x = cfg.get('bowler_roi_x', self.DEFAULTS['bowler_name']['x'])
            self.bowler_roi_y = cfg.get('bowler_roi_y', self.DEFAULTS['bowler_name']['y'])
            self.bowler_roi_width = cfg.get('bowler_roi_width', self.DEFAULTS['bowler_name']['width'])
            self.bowler_roi_height = cfg.get('bowler_roi_height', self.DEFAULTS['bowler_name']['height'])
            # Suggested start time from auto-calibration
            self.suggested_start_time = cfg.get('suggested_start_time', None)
            self.start_time = float(self.suggested_start_time) if self.suggested_start_time else 0.0
        else:
            self.roi_x = self.DEFAULTS['score']['x']
            self.roi_y = self.DEFAULTS['score']['y']
            self.roi_width = self.DEFAULTS['score']['width']
            self.roi_height = self.DEFAULTS['score']['height']
            self.overs_roi_x = self.DEFAULTS['overs']['x']
            self.overs_roi_y = self.DEFAULTS['overs']['y']
            self.overs_roi_width = self.DEFAULTS['overs']['width']
            self.overs_roi_height = self.DEFAULTS['overs']['height']
            # Batsman name ROI
            self.batsman_roi_x = self.DEFAULTS['batsman_name']['x']
            self.batsman_roi_y = self.DEFAULTS['batsman_name']['y']
            self.batsman_roi_width = self.DEFAULTS['batsman_name']['width']
            self.batsman_roi_height = self.DEFAULTS['batsman_name']['height']
            # Bowler name ROI
            self.bowler_roi_x = self.DEFAULTS['bowler_name']['x']
            self.bowler_roi_y = self.DEFAULTS['bowler_name']['y']
            self.bowler_roi_width = self.DEFAULTS['bowler_name']['width']
            self.bowler_roi_height = self.DEFAULTS['bowler_name']['height']
            self.start_time = 0.0

        logger.info(f"Score ROI: ({self.roi_x}, {self.roi_y}) {self.roi_width}x{self.roi_height}")
        logger.info(f"Overs ROI: ({self.overs_roi_x}, {self.overs_roi_y}) {self.overs_roi_width}x{self.overs_roi_height}")
        logger.info(f"Batsman ROI: ({self.batsman_roi_x}, {self.batsman_roi_y}) {self.batsman_roi_width}x{self.batsman_roi_height}")
        logger.info(f"Bowler ROI: ({self.bowler_roi_x}, {self.bowler_roi_y}) {self.bowler_roi_width}x{self.bowler_roi_height}")

    def save(self, config_file: str, suggested_start_time: int = None):
        """Persist configuration to JSON file."""
        config = {
            'roi_x': self.roi_x, 'roi_y': self.roi_y,
            'roi_width': self.roi_width, 'roi_height': self.roi_height,
            'overs_roi_x': self.overs_roi_x, 'overs_roi_y': self.overs_roi_y,
            'overs_roi_width': self.overs_roi_width, 'overs_roi_height': self.overs_roi_height,
            'batsman_roi_x': self.batsman_roi_x, 'batsman_roi_y': self.batsman_roi_y,
            'batsman_roi_width': self.batsman_roi_width, 'batsman_roi_height': self.batsman_roi_height,
            'bowler_roi_x': self.bowler_roi_x, 'bowler_roi_y': self.bowler_roi_y,
            'bowler_roi_width': self.bowler_roi_width, 'bowler_roi_height': self.bowler_roi_height,
        }
        if suggested_start_time is not None:
            config['suggested_start_time'] = suggested_start_time
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


class BatsmanState:
    """Tracks individual batsman state (name, runs, balls)."""
    
    def __init__(self, name: str, runs: int, balls: int):
        self.name = name
        self.runs = runs
        self.balls = balls
    
    def __repr__(self) -> str:
        return f"{self.name}: {self.runs}({self.balls})"
    
    def __eq__(self, other) -> bool:
        if other is None or not isinstance(other, BatsmanState):
            return False
        return self.name == other.name and self.runs == other.runs and self.balls == other.balls

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


def parse_batsmen_details(text: str) -> Tuple[Optional[BatsmanState], Optional[BatsmanState]]:
    """
    Parse the two-batsman strip from OCR text.
    
    Format: "TARLING 3 10 HAMD WAHEED 10 19"
    - TARLING: 3 runs, 10 balls
    - HAMD WAHEED: 10 runs, 19 balls
    
    Also handles variations with triangle markers or spacing issues.
    
    Args:
        text: Raw OCR text from batsman ROI
    
    Returns:
        Tuple of (Batsman1, Batsman2) or (None, None) if parsing fails
    """
    if not text:
        return None, None
    
    # Clean OCR errors
    text = clean_ocr_text(text.upper())
    
    # Remove leading triangle/digit markers (6, 9, ▶, etc.)
    text = re.sub(r'^[▶►▷▸>•·●649]\s+', '', text)
    
    # Pattern: [NAME] [RUNS] [BALLS] [NAME] [RUNS] [BALLS]
    # Allows multi-word names (e.g., "HAMD WAHEED")
    # Pattern matches: 2+ uppercase letters, followed by 1-3 digit numbers
    pattern = re.compile(
        r'([A-Z][A-Z\s]{2,?}?)\s+(\d{1,3})\s+(\d{1,3})\s+'  # Batsman 1
        r'([A-Z][A-Z\s]{2,?}?)\s+(\d{1,3})\s+(\d{1,3})'     # Batsman 2
    )
    
    match = pattern.search(text)
    if match:
        # Extract and clean names (remove extra whitespace)
        name1 = ' '.join(match.group(1).strip().split())
        runs1 = int(match.group(2))
        balls1 = int(match.group(3))
        
        name2 = ' '.join(match.group(4).strip().split())
        runs2 = int(match.group(5))
        balls2 = int(match.group(6))
        
        # Sanity check: runs and balls should be reasonable
        if runs1 <= 300 and balls1 <= 200 and runs2 <= 300 and balls2 <= 200:
            b1 = BatsmanState(name1, runs1, balls1)
            b2 = BatsmanState(name2, runs2, balls2)
            logger.debug(f"   📊 Parsed batsmen: {b1} | {b2}")
            return b1, b2
    
    logger.debug(f"   ⚠️  Could not parse batsmen from: '{text}'")
    return None, None



# Common player name OCR corrections
PLAYER_NAME_CORRECTIONS = {
    '0': 'O', 'o': 'O',  # Reverse of score corrections
    '1': 'I', 'l': 'I', '|': 'I',
    '5': 'S',
    '6': 'G',
    '8': 'B',
}

# Regex patterns for striker extraction
# Triangle markers: ▶, ►, ▷, >, or OCR misreads (6, 9, 4)
TRIANGLE_PATTERN = re.compile(
    r'(?:[▶►▷▸>]|^[649]\s)'  # Triangle or leading digit (OCR misread)
    r'\s*'                    # Optional whitespace
    r'([A-Z][A-Z]+)'          # Capture: Name (2+ uppercase letters)
    r'(?:\s+\d+)?'            # Optional: runs
    r'(?:\s*\(\d+\)|\s+\d+)?', # Optional: (balls) or balls
    re.IGNORECASE
)

# Alternative pattern: "NAME runs(balls)" or "NAME runs balls"
NAME_STATS_PATTERN = re.compile(
    r'\b([A-Z][A-Z]{2,})\s+'   # Name: 3+ letters
    r'\d+\s*'                  # Runs
    r'(?:\(\d+\)|\d+)',        # (balls) or balls
    re.IGNORECASE
)


def clean_player_name(text: str) -> str:
    """
    Extract striker name from OCR text using regex anchoring on triangle marker.
    
    Handles multiple formats:
    - "▶ KOHLI 12(8) | ROHIT 5(2)" → "KOHLI"
    - "6 THURSTANCE 11 13 IBRAHIM 14 22" → "THURSTANCE" 
    - "Total 45/2 | ▶ KOHLI 12(8) | ROHIT 5(2)" → "KOHLI"
    
    Strategy:
    1. Regex search for triangle marker (▶, >, or misread 6/9) + NAME
    2. Fallback: First NAME followed by numbers (runs/balls pattern)
    3. Last resort: First alphabetic word with 3+ characters
    
    Args:
        text: Raw OCR text from batsman name region
    
    Returns:
        Cleaned player name (e.g., 'KOHLI', 'THURSTANCE')
    """
    if not text:
        logger.debug(f"Raw Name OCR: '' -> Parsed: 'Unknown'")
        return 'Unknown'
    
    original_text = text
    text_upper = text.upper()
    
    # === Strategy 1: Triangle Anchor Pattern ===
    # Look for triangle (▶, >, ►) or OCR misread (6, 9, 4) followed by name
    triangle_match = TRIANGLE_PATTERN.search(text_upper)
    if triangle_match:
        name = triangle_match.group(1)
        # Apply letter corrections
        for old, new in PLAYER_NAME_CORRECTIONS.items():
            name = name.replace(old, new)
        if len(name) >= 3:
            logger.debug(f"Raw Name OCR: '{original_text}' -> Parsed: '{name}' (triangle anchor)")
            return name
    
    # === Strategy 2: Leading digit + First Name ===
    # Format: "6 THURSTANCE 11 13 IBRAHIM 14 22"
    tokens = text_upper.split()
    if len(tokens) >= 2:
        start_idx = 0
        # Skip leading single digit (triangle misread)
        if tokens[0].isdigit() and len(tokens[0]) == 1:
            start_idx = 1
        
        # First valid name token after potential triangle
        for token in tokens[start_idx:]:
            cleaned = re.sub(r'[^A-Z]', '', token)
            if len(cleaned) >= 3 and cleaned.isalpha():
                for old, new in PLAYER_NAME_CORRECTIONS.items():
                    cleaned = cleaned.replace(old, new)
                logger.debug(f"Raw Name OCR: '{original_text}' -> Parsed: '{cleaned}' (first-name)")
                return cleaned
    
    # === Strategy 3: Name + Stats Pattern ===
    # Look for "NAME runs(balls)" or "NAME runs balls"
    stats_match = NAME_STATS_PATTERN.search(text_upper)
    if stats_match:
        name = stats_match.group(1)
        for old, new in PLAYER_NAME_CORRECTIONS.items():
            name = name.replace(old, new)
        if len(name) >= 3:
            logger.debug(f"Raw Name OCR: '{original_text}' -> Parsed: '{name}' (stats pattern)")
            return name
    
    # === Strategy 4: Fallback - longest alphabetic word ===
    words = re.findall(r'[A-Z]{3,}', text_upper)
    if words:
        name = max(words, key=len)
        for old, new in PLAYER_NAME_CORRECTIONS.items():
            name = name.replace(old, new)
        logger.debug(f"Raw Name OCR: '{original_text}' -> Parsed: '{name}' (fallback)")
        return name
    
    logger.debug(f"Raw Name OCR: '{original_text}' -> Parsed: 'Unknown' (no match)")
    return 'Unknown'


# Regex patterns for stripping bowling figures from OCR text
# Matches: "2-14", "3-0-14-1", "2/45", "3.2", "0-14", "1/0", "(2-14)", etc.
BOWLING_FIGURES_PATTERN = re.compile(
    r'\s*'
    r'(?:'
    r'\(?\d{1,2}(?:\.\d)?[\-/]\d{1,2}(?:[\-/]\d{1,3}){0,2}\)?'  # 2-14, 3-0-14-1, 2/45, (2-14)
    r'|\d{1,2}\.\d'                                                # 3.2 (overs bowled)
    r')'
    r'\s*'
)


def clean_bowler_name(text: str) -> str:
    """
    Extract bowler name from OCR text, stripping bowling figures.
    
    Handles multiple broadcast formats:
    - "BOULT 2-14"          → "BOULT"
    - "BUMRAH 3.2-0-19-2"  → "BUMRAH"
    - "STARC 1/45"          → "STARC"
    - "CUMMINS (2-14)"      → "CUMMINS"
    - "DE VILLIERS 0-12"    → "DE VILLIERS"  (multi-word names)
    - "4 BOULT 2-14"        → "BOULT"  (leading misread digit)
    
    Strategy:
    1. Strip all bowling figure patterns (overs-maidens-runs-wickets)
    2. Strip leading misread digits (triangle/marker OCR errors)
    3. Apply PLAYER_NAME_CORRECTIONS for OCR digit→letter fixes
    4. Return longest valid alphabetic name token(s)
    
    Args:
        text: Raw OCR text from bowler name region
    
    Returns:
        Cleaned bowler name (e.g., 'BOULT', 'BUMRAH') or 'Unknown'
    """
    if not text:
        logger.debug(f"Raw Bowler OCR: '' -> Parsed: 'Unknown'")
        return 'Unknown'
    
    original_text = text
    text_upper = text.upper().strip()
    
    # Step 1: Strip bowling figures patterns
    cleaned = BOWLING_FIGURES_PATTERN.sub(' ', text_upper).strip()
    
    # Step 2: Remove leading single digit (triangle/marker misread)
    cleaned = re.sub(r'^[▶►▷▸>649]\s+', '', cleaned)
    
    # Step 3: Remove any remaining isolated numbers
    cleaned = re.sub(r'\b\d+\b', '', cleaned).strip()
    
    # Step 4: Collapse whitespace
    cleaned = ' '.join(cleaned.split())
    
    # Step 5: Apply letter corrections and extract valid name tokens
    if cleaned:
        # Apply corrections
        for old, new in PLAYER_NAME_CORRECTIONS.items():
            cleaned = cleaned.replace(old, new)
        
        # Extract alphabetic words (3+ chars)
        name_tokens = re.findall(r'[A-Z]{2,}', cleaned)
        if name_tokens:
            # Reconstruct name (handles multi-word names like "DE VILLIERS")
            name = ' '.join(name_tokens)
            if len(name) >= 2:
                logger.debug(f"Raw Bowler OCR: '{original_text}' -> Parsed: '{name}'")
                return name
    
    # Fallback: try finding any 3+ letter alphabetic words in original text
    words = re.findall(r'[A-Z]{3,}', text_upper)
    if words:
        name = max(words, key=len)
        for old, new in PLAYER_NAME_CORRECTIONS.items():
            name = name.replace(old, new)
        logger.debug(f"Raw Bowler OCR: '{original_text}' -> Parsed: '{name}' (fallback)")
        return name
    
    logger.debug(f"Raw Bowler OCR: '{original_text}' -> Parsed: 'Unknown'")
    return 'Unknown'


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
        return self._extract_region(
            frame, 
            self.config.roi_x, self.config.roi_y, 
            self.config.roi_width, self.config.roi_height, 
            path
        )

    def extract_overs_roi(self, frame, debug_path: Optional[str] = None) -> Optional[any]:
        """Extract overs region."""
        path = f"{debug_path}_overs" if debug_path else None
        return self._extract_region(
            frame,
            self.config.overs_roi_x, self.config.overs_roi_y,
            self.config.overs_roi_width, self.config.overs_roi_height,
            path
        )

    def extract_batsman_name_roi(self, frame, debug_path: Optional[str] = None) -> Optional[any]:
        """
        Extract batsman name region WITHOUT heavy preprocessing.
        
        Unlike score ROI, we don't apply binary thresholding because
        player names need to preserve letter shapes (especially for
        distinguishing O from 0, I from 1, etc.)
        """
        # Skip if ROI not configured (x=0, y=0 means unconfigured)
        if self.config.batsman_roi_x == 0 and self.config.batsman_roi_y == 0:
            return None
        
        try:
            height, width = frame.shape[:2]
            
            x = self.config.batsman_roi_x
            y = self.config.batsman_roi_y
            w = self.config.batsman_roi_width
            h = self.config.batsman_roi_height
            
            # Clamp to frame bounds
            x = max(0, min(x, width - w))
            y = max(0, min(y, height - h))
            
            # Extract raw ROI - keep original colors for best OCR on broadcast text
            roi = frame[y:y+h, x:x+w].copy()
            
            # Upscale for better OCR accuracy
            roi = cv2.resize(roi, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
            
            if debug_path:
                cv2.imwrite(f"{debug_path}_batsman.jpg", roi)
            
            return roi
            
        except Exception as e:
            logger.debug(f"Batsman ROI extraction error: {e}")
            return None

    def read_batsman_name(self, frame, timestamp: float = 0.0, debug_dir: str = None) -> str:
        """
        Read batsman name from frame using the configured ROI.
        
        Args:
            frame: Video frame (BGR numpy array)
            timestamp: Frame timestamp for debug logging
            debug_dir: Optional directory to save failed ROI images for inspection
        
        Returns:
            Cleaned player name or 'Unknown' if extraction fails
        """
        roi = self.extract_batsman_name_roi(frame)
        if roi is None:
            return 'Unknown'
        
        try:
            # Try multiple OCR strategies for better accuracy
            
            # Strategy 1: Paragraph mode (default, best for multi-word names)
            results = self.reader.readtext(roi, detail=1, paragraph=True)
            if results and len(results) > 0:
                raw_text = ' '.join([r[1] for r in results if len(r) > 1])
                if raw_text.strip():
                    confidence = max([r[2] for r in results if len(r) > 2], default=0.0)
                    cleaned_name = clean_player_name(raw_text)
                    
                    # Always log name OCR attempts (INFO level for visibility)
                    logger.info(f"   📝 Name OCR: '{raw_text}' (conf={confidence:.2f}) → '{cleaned_name}'")
                    
                    # If we got a valid name, return it
                    if cleaned_name != 'Unknown':
                        return cleaned_name
            
            # Strategy 2: Word-by-word mode (fallback for low confidence)
            results = self.reader.readtext(roi, detail=1, paragraph=False)
            if results and len(results) > 0:
                raw_text = ' '.join([r[1] for r in results if len(r) > 1])
                if raw_text.strip():
                    cleaned_name = clean_player_name(raw_text)
                    
                    logger.info(f"   📝 Name OCR (fallback): '{raw_text}' → '{cleaned_name}'")
                    
                    if cleaned_name != 'Unknown':
                        return cleaned_name
            
            # OCR failed - save debug image if requested, but use DEBUG level to avoid spam
            # (Scoreboard State Manager in IntegratedDetector handles warning-level logging)
            if debug_dir:
                from pathlib import Path
                debug_path = Path(debug_dir) / f"ocr_failed_{timestamp:.1f}s.jpg"
                Path(debug_dir).mkdir(parents=True, exist_ok=True)
                cv2.imwrite(str(debug_path), roi)
                logger.debug(f"⚠️  Could not extract player name at {timestamp:.1f}s (no text detected)")
                logger.debug(f"   💾 Saved ROI for inspection: {debug_path}")
            else:
                logger.debug(f"⚠️  Could not extract player name at {timestamp:.1f}s (no text detected)")
            
            return 'Unknown'
            
        except Exception as e:
            logger.warning(f"⚠️  Batsman name OCR error at {timestamp:.1f}s: {e}")
            return 'Unknown'

    def extract_bowler_name_roi(self, frame, debug_path: Optional[str] = None) -> Optional[any]:
        """
        Extract bowler name region WITHOUT heavy preprocessing.
        
        Light preprocessing only (upscale + keep original colors) to preserve
        letter shapes for name OCR. Same approach as batsman name ROI.
        """
        # Skip if ROI not configured (x=0, y=0 means unconfigured)
        if self.config.bowler_roi_x == 0 and self.config.bowler_roi_y == 0:
            return None
        
        try:
            height, width = frame.shape[:2]
            
            x = self.config.bowler_roi_x
            y = self.config.bowler_roi_y
            w = self.config.bowler_roi_width
            h = self.config.bowler_roi_height
            
            # Clamp to frame bounds
            x = max(0, min(x, width - w))
            y = max(0, min(y, height - h))
            
            # Extract raw ROI - keep original colors for best OCR on broadcast text
            roi = frame[y:y+h, x:x+w].copy()
            
            # Upscale for better OCR accuracy
            roi = cv2.resize(roi, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
            
            if debug_path:
                cv2.imwrite(f"{debug_path}_bowler.jpg", roi)
            
            return roi
            
        except Exception as e:
            logger.debug(f"Bowler ROI extraction error: {e}")
            return None

    def read_bowler_name(self, frame, timestamp: float = 0.0, debug_dir: str = None) -> str:
        """
        Read bowler name from frame using the configured bowler ROI.
        
        Applies `clean_bowler_name()` to strip bowling figures (e.g., "BOULT 2-14" → "BOULT").
        
        Args:
            frame: Video frame (BGR numpy array)
            timestamp: Frame timestamp for debug logging
            debug_dir: Optional directory to save failed ROI images for inspection
        
        Returns:
            Cleaned bowler name or 'Unknown' if extraction fails
        """
        roi = self.extract_bowler_name_roi(frame)
        if roi is None:
            return 'Unknown'
        
        try:
            # Strategy 1: Paragraph mode (best for "BOULT 2-0-14-1" style text)
            results = self.reader.readtext(roi, detail=1, paragraph=True)
            if results and len(results) > 0:
                raw_text = ' '.join([r[1] for r in results if len(r) > 1])
                if raw_text.strip():
                    confidence = max([r[2] for r in results if len(r) > 2], default=0.0)
                    cleaned_name = clean_bowler_name(raw_text)
                    
                    logger.info(f"   🎳 Bowler OCR: '{raw_text}' (conf={confidence:.2f}) → '{cleaned_name}'")
                    
                    if cleaned_name != 'Unknown':
                        return cleaned_name
            
            # Strategy 2: Word-by-word mode (fallback)
            results = self.reader.readtext(roi, detail=1, paragraph=False)
            if results and len(results) > 0:
                raw_text = ' '.join([r[1] for r in results if len(r) > 1])
                if raw_text.strip():
                    cleaned_name = clean_bowler_name(raw_text)
                    
                    logger.info(f"   🎳 Bowler OCR (fallback): '{raw_text}' → '{cleaned_name}'")
                    
                    if cleaned_name != 'Unknown':
                        return cleaned_name
            
            # OCR failed
            if debug_dir:
                from pathlib import Path
                debug_path = Path(debug_dir) / f"bowler_ocr_failed_{timestamp:.1f}s.jpg"
                Path(debug_dir).mkdir(parents=True, exist_ok=True)
                cv2.imwrite(str(debug_path), roi)
                logger.debug(f"⚠️  Could not extract bowler name at {timestamp:.1f}s")
            else:
                logger.debug(f"⚠️  Could not extract bowler name at {timestamp:.1f}s")
            
            return 'Unknown'
            
        except Exception as e:
            logger.warning(f"⚠️  Bowler name OCR error at {timestamp:.1f}s: {e}")
            return 'Unknown'

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
            'description': f'Score: {old} → {new}',
            'runs_scored': new.runs - old.runs,
            'wickets_lost': new.wickets - old.wickets if old.wickets >= 0 and new.wickets >= 0 else 0,
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
def auto_calibrate_roi(video_path: str, sample_timestamps: List[float] = None, use_gpu: bool = False) -> Optional[Dict]:
    """
    Automatically detect scoreboard ROI by scanning frames for score patterns.
    
    Scans multiple frames looking for text patterns like "123/4" (runs/wickets)
    and returns the bounding box of the detected score region.
    
    Args:
        video_path: Path to video file
        sample_timestamps: List of timestamps to sample (default: multiple points)
        use_gpu: Enable GPU for OCR
    
    Returns:
        Dict with detected ROI coordinates or None if detection failed
        {
            'score': {'x': int, 'y': int, 'width': int, 'height': int},
            'overs': {'x': int, 'y': int, 'width': int, 'height': int},
            'batsman_name': {'x': int, 'y': int, 'width': int, 'height': int},
            'confidence': float
        }
    """
    logger.info("=" * 60)
    logger.info("🔍 AUTO-CALIBRATION MODE")
    logger.info("=" * 60)
    logger.info("Scanning video for scoreboard location...")
    
    video = cv2.VideoCapture(video_path)
    if not video.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")
    
    fps = video.get(cv2.CAP_PROP_FPS)
    total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps
    
    # Default sample points: 10%, 20%, 30%, 40%, 50% of video
    if sample_timestamps is None:
        sample_timestamps = [duration * p for p in [0.1, 0.2, 0.3, 0.4, 0.5]]
    
    logger.info(f"Video: {Path(video_path).name} ({duration/3600:.1f}h)")
    logger.info(f"Sampling {len(sample_timestamps)} frames...")
    
    # Initialize OCR reader
    reader = easyocr.Reader(['en'], gpu=use_gpu)
    
    # Score pattern: digits followed by / followed by 1-2 digits (e.g., "145/3", "23/0")
    score_pattern = re.compile(r'^\d{1,3}[/\\|]\d{1,2}$')
    # Overs pattern: digit.digit (e.g., "14.2", "8.5")
    overs_pattern = re.compile(r'^\d{1,2}\.\d$')
    
    score_detections = []
    overs_detections = []
    name_detections = []
    
    for ts in sample_timestamps:
        frame_idx = min(int(ts * fps), total_frames - 1)
        video.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = video.read()
        
        if not ret:
            continue
        
        logger.info(f"   Scanning frame at {ts:.0f}s...")
        
        # Run OCR on entire frame (or bottom half where scoreboards usually are)
        height, width = frame.shape[:2]
        # Focus on bottom 40% of frame (scoreboards are usually there)
        search_region = frame[int(height * 0.5):, :]
        y_offset = int(height * 0.5)
        
        try:
            results = reader.readtext(search_region, detail=1)
        except Exception as e:
            logger.warning(f"   OCR error: {e}")
            continue
        
        for detection in results:
            bbox, text, confidence = detection
            if confidence < 0.5:
                continue
            
            # Clean text for pattern matching
            clean_text = text.strip().replace(' ', '')
            
            # Calculate bounding box (adjust for y_offset)
            x_coords = [p[0] for p in bbox]
            y_coords = [p[1] for p in bbox]
            x1, x2 = int(min(x_coords)), int(max(x_coords))
            y1, y2 = int(min(y_coords)) + y_offset, int(max(y_coords)) + y_offset
            
            # Check for score pattern
            if score_pattern.match(clean_text):
                logger.info(f"   ✅ Found score: '{text}' at ({x1}, {y1}) conf={confidence:.2f}")
                score_detections.append({
                    'x': x1, 'y': y1, 'width': x2 - x1, 'height': y2 - y1,
                    'confidence': confidence, 'text': text, 'timestamp': ts
                })
            
            # Check for overs pattern
            elif overs_pattern.match(clean_text):
                logger.info(f"   ✅ Found overs: '{text}' at ({x1}, {y1}) conf={confidence:.2f}")
                overs_detections.append({
                    'x': x1, 'y': y1, 'width': x2 - x1, 'height': y2 - y1,
                    'confidence': confidence, 'text': text
                })
            
            # Check for player names (mostly letters, 3+ chars)
            # More lenient: allow some OCR errors (digits that look like letters)
            text_upper = clean_text.upper()
            # Count letters vs total length
            letter_count = sum(1 for c in text_upper if c.isalpha())
            if (len(text_upper) >= 3 and 
                letter_count >= len(text_upper) * 0.7 and  # At least 70% letters
                not score_pattern.match(clean_text) and  # Not a score
                not overs_pattern.match(clean_text)):  # Not overs
                logger.info(f"   🏏 Found potential name: '{text}' at ({x1}, {y1})")
                name_detections.append({
                    'x': x1, 'y': y1, 'width': x2 - x1, 'height': y2 - y1,
                    'confidence': confidence, 'text': text
                })
    
    video.release()
    
    if not score_detections:
        logger.warning("❌ Could not detect score region automatically")
        logger.warning("   Try running with --visualize to manually check frame layout")
        return None
    
    # Find the most common/reliable score location (cluster detections)
    # Use the detection with highest confidence as primary
    best_score = max(score_detections, key=lambda d: d['confidence'])
    
    # Find earliest timestamp where score was detected (for suggested start time)
    earliest_score_ts = min(d.get('timestamp', 0) for d in score_detections if d.get('timestamp'))
    
    # Add minimal padding around detected region
    padding = 8
    score_roi = {
        'x': max(0, best_score['x'] - padding),
        'y': max(0, best_score['y'] - padding),
        'width': best_score['width'] + padding * 2,
        'height': best_score['height'] + padding * 2
    }
    
    # Find overs near the score (usually below or beside)
    overs_roi = None
    if overs_detections:
        # Find overs closest to score
        score_center_y = best_score['y'] + best_score['height'] // 2
        closest_overs = min(overs_detections, 
                          key=lambda d: abs(d['y'] - score_center_y))
        overs_roi = {
            'x': max(0, closest_overs['x'] - padding),
            'y': max(0, closest_overs['y'] - padding),
            'width': closest_overs['width'] + padding * 2,
            'height': closest_overs['height'] + padding * 2
        }
    else:
        # Estimate overs position (usually below score)
        overs_roi = {
            'x': score_roi['x'],
            'y': score_roi['y'] + score_roi['height'] + 5,
            'width': score_roi['width'],
            'height': 35
        }
    
    # Find batsman name region (on same row as score)
    batsman_roi = None
    if name_detections:
        # Find names very close to score's Y level (within 20 pixels)
        score_y = best_score['y']
        score_x = best_score['x']
        
        # Filter for names on same row as score (strict Y tolerance)
        same_row_names = [d for d in name_detections 
                         if abs(d['y'] - score_y) < 20]  # Tight tolerance
        
        # If no names on same row, try wider search
        if not same_row_names:
            same_row_names = [d for d in name_detections 
                             if abs(d['y'] - score_y) < 50]
        
        if same_row_names:
            # Prefer names to the right of score
            right_names = [d for d in same_row_names if d['x'] > score_x]
            
            if right_names:
                # Take first name to the right (closest)
                closest_name = min(right_names, key=lambda d: d['x'])
            else:
                # If nothing on right, take any nearby name
                closest_name = same_row_names[0]
            
            logger.info(f"   📍 Found batsman name area: '{closest_name['text']}' at ({closest_name['x']}, {closest_name['y']})")
            batsman_roi = {
                'x': closest_name['x'] - padding,
                'y': closest_name['y'] - padding,
                'width': 300,  # Generous width for full name
                'height': closest_name['height'] + padding * 2
            }
    
    # If no name found, estimate position (right of score, same Y)
    if batsman_roi is None:
        logger.info("   ⚠️  No batsman names detected - using estimated position")
        batsman_roi = {
            'x': score_roi['x'] + score_roi['width'] + 20,
            'y': score_roi['y'],  # Same Y as score
            'width': 400,
            'height': score_roi['height']
        }
    
    # Calculate suggested start time from earliest score detection
    suggested_start = None
    timestamps_with_scores = [d.get('timestamp', 0) for d in score_detections if d.get('timestamp')]
    if timestamps_with_scores:
        earliest_ts = min(timestamps_with_scores)
        # Start 60 seconds before the earliest detection to be safe
        suggested_start = max(0, int(earliest_ts) - 60)
    
    result = {
        'score': score_roi,
        'overs': overs_roi,
        'batsman_name': batsman_roi,
        'confidence': best_score['confidence'],
        'suggested_start_time': suggested_start
    }
    
    logger.info("-" * 60)
    logger.info("✅ AUTO-CALIBRATION COMPLETE")
    logger.info(f"   Score ROI: ({score_roi['x']}, {score_roi['y']}) {score_roi['width']}x{score_roi['height']}")
    logger.info(f"   Overs ROI: ({overs_roi['x']}, {overs_roi['y']}) {overs_roi['width']}x{overs_roi['height']}")
    logger.info(f"   Batsman ROI: ({batsman_roi['x']}, {batsman_roi['y']}) {batsman_roi['width']}x{batsman_roi['height']}")
    logger.info(f"   Detection confidence: {best_score['confidence']:.2f}")
    if suggested_start is not None:
        logger.info(f"   ⏱️  Suggested --start-time: {suggested_start}s (match content detected at {earliest_ts:.0f}s)")
    
    return result


def visualize_roi(video_path: str, config: ScoreboardConfig, timestamp: float = 0.0) -> str:
    """Draw ROI boxes on a single frame for calibration verification."""
    logger.info("=" * 60)
    logger.info("🔍 ROI VISUALIZATION MODE")
    logger.info("=" * 60)

    video = cv2.VideoCapture(video_path)
    if not video.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    fps = video.get(cv2.CAP_PROP_FPS)
    total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_idx = min(int(timestamp * fps), total_frames - 1)
    
    logger.info(f"Video: {Path(video_path).name} | FPS: {fps:.0f} | Total frames: {total_frames}")
    logger.info(f"Reading frame at timestamp {timestamp}s (frame {frame_idx}/{total_frames})")
    
    video.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = video.read()
    video.release()

    if not ret:
        raise ValueError(f"Cannot read frame at {timestamp}s")

    height, width = frame.shape[:2]
    logger.info(f"Frame dimensions: {width}x{height}")
    
    # Use ROI coordinates directly (no scaling)
    score_x = config.roi_x
    score_y = config.roi_y
    score_w = config.roi_width
    score_h = config.roi_height
    
    overs_x = config.overs_roi_x
    overs_y = config.overs_roi_y
    overs_w = config.overs_roi_width
    overs_h = config.overs_roi_height
    
    batsman_x = config.batsman_roi_x
    batsman_y = config.batsman_roi_y
    batsman_w = config.batsman_roi_width
    batsman_h = config.batsman_roi_height
    
    logger.info(f"Score ROI: ({score_x}, {score_y}) to ({score_x + score_w}, {score_y + score_h})")
    logger.info(f"Overs ROI: ({overs_x}, {overs_y}) to ({overs_x + overs_w}, {overs_y + overs_h})")

    # Validate ROI bounds
    if score_y + score_h > height or score_x + score_w > width:
        logger.warning(f"⚠️  Score ROI partially outside frame bounds! Frame: {width}x{height}")
    if overs_y + overs_h > height or overs_x + overs_w > width:
        logger.warning(f"⚠️  Overs ROI partially outside frame bounds! Frame: {width}x{height}")

    # Draw Score ROI (green)
    pt1_score = (score_x, score_y)
    pt2_score = (score_x + score_w, score_y + score_h)
    cv2.rectangle(frame, pt1_score, pt2_score, (0, 255, 0), 3)
    cv2.putText(frame, "SCORE", (score_x, max(10, score_y - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

    # Draw Overs ROI (blue)
    pt1_overs = (overs_x, overs_y)
    pt2_overs = (overs_x + overs_w, overs_y + overs_h)
    cv2.rectangle(frame, pt1_overs, pt2_overs, (255, 0, 0), 3)
    cv2.putText(frame, "OVERS", (overs_x, max(10, overs_y - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)

    # Draw Batsman Name ROI (yellow) - only if configured (non-zero coordinates)
    if config.batsman_roi_x > 0 or config.batsman_roi_y > 0:
        pt1_batsman = (batsman_x, batsman_y)
        pt2_batsman = (batsman_x + batsman_w, batsman_y + batsman_h)
        cv2.rectangle(frame, pt1_batsman, pt2_batsman, (0, 255, 255), 3)
        cv2.putText(frame, "BATSMAN", (batsman_x, max(10, batsman_y - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        logger.info(f"Batsman ROI: ({batsman_x}, {batsman_y}) to ({batsman_x + batsman_w}, {batsman_y + batsman_h})")
    else:
        logger.warning("⚠️  Batsman Name ROI not configured (x=0, y=0). Set --batsman-roi-x/y to enable player attribution.")

    # Draw Bowler Name ROI (magenta/pink) - only if configured
    if config.bowler_roi_x > 0 or config.bowler_roi_y > 0:
        bowler_x = config.bowler_roi_x
        bowler_y = config.bowler_roi_y
        bowler_w = config.bowler_roi_width
        bowler_h = config.bowler_roi_height
        pt1_bowler = (bowler_x, bowler_y)
        pt2_bowler = (bowler_x + bowler_w, bowler_y + bowler_h)
        cv2.rectangle(frame, pt1_bowler, pt2_bowler, (255, 0, 255), 3)
        cv2.putText(frame, "BOWLER", (bowler_x, max(10, bowler_y - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 255), 2)
        logger.info(f"Bowler ROI: ({bowler_x}, {bowler_y}) to ({bowler_x + bowler_w}, {bowler_y + bowler_h})")

    # Draw frame dimensions text at bottom
    cv2.putText(frame, f"Frame: {width}x{height}", (10, height - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    output_path = "roi_check.jpg"
    cv2.imwrite(output_path, frame)
    logger.info(f"✅ Saved: {output_path}")
    logger.info(f"   Green box (SCORE): ({score_x}, {score_y}) {score_w}x{score_h}")
    logger.info(f"   Blue box (OVERS):  ({overs_x}, {overs_y}) {overs_w}x{overs_h}")
    if config.batsman_roi_x > 0 or config.batsman_roi_y > 0:
        logger.info(f"   Yellow box (BATSMAN): ({batsman_x}, {batsman_y}) {batsman_w}x{batsman_h}")
    if config.bowler_roi_x > 0 or config.bowler_roi_y > 0:
        logger.info(f"   Magenta box (BOWLER): ({config.bowler_roi_x}, {config.bowler_roi_y}) {config.bowler_roi_width}x{config.bowler_roi_height}")
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
    
    # === DELTA-BASED PLAYER TRACKING ===
    # Track previous batsmen state to detect whose score increased
    prev_batsmen: Optional[Tuple[BatsmanState, BatsmanState]] = (None, None)
    current_batsmen: Optional[Tuple[BatsmanState, BatsmanState]] = (None, None)
    batsman_read_counter = 0
    batsman_read_interval = 2  # Read batsmen details every 2 successful score reads

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
                    
                    # === READ BATSMEN DETAILS (Delta-based tracking) ===
                    # Read batsmen details periodically when scoreboard is visible
                    batsman_read_counter += 1
                    if batsman_read_counter >= batsman_read_interval:
                        batsman_read_counter = 0
                        
                        # Read batsmen ROI
                        batsman_roi = reader.extract_batsman_name_roi(frame)
                        if batsman_roi is not None:
                            try:
                                # Get full text from ROI (paragraph mode for complete string)
                                results = reader.reader.readtext(batsman_roi, detail=0, paragraph=True)
                                if results:
                                    raw_text = ' '.join(results)
                                    # Parse both batsmen with scores
                                    prev_batsmen = current_batsmen  # Save previous state
                                    current_batsmen = parse_batsmen_details(raw_text)
                                    
                                    if current_batsmen[0]:
                                        logger.debug(f"   📊 Batsmen: {current_batsmen[0]} | {current_batsmen[1]}")
                            except Exception as e:
                                logger.debug(f"   ⚠️  Error reading batsmen details: {e}")
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
                                # === DELTA-BASED PLAYER ATTRIBUTION ===
                                detected_player = 'Unknown'
                                
                                # Check if we have both current and previous batsmen states
                                if (current_batsmen[0] is not None and 
                                    prev_batsmen[0] is not None and 
                                    current_batsmen[0] != prev_batsmen[0]):
                                    
                                    b1_new, b2_new = current_batsmen
                                    b1_old, b2_old = prev_batsmen
                                    
                                    # Calculate score differences
                                    diff1 = b1_new.runs - b1_old.runs
                                    diff2 = b2_new.runs - b2_old.runs
                                    
                                    runs_scored = event.get('runs_scored', 0)
                                    
                                    # Attribute to the batsman whose score increased
                                    # Allow small OCR tolerance (±1)
                                    if diff1 >= runs_scored - 1 and diff1 > 0:
                                        detected_player = b1_new.name
                                        logger.info(f"   🕵️  Delta Logic: {b1_new.name} scored +{diff1} runs ({b1_old.runs} → {b1_new.runs})")
                                    elif diff2 >= runs_scored - 1 and diff2 > 0:
                                        detected_player = b2_new.name
                                        logger.info(f"   🕵️  Delta Logic: {b2_new.name} scored +{diff2} runs ({b2_old.runs} → {b2_new.runs})")
                                    else:
                                        logger.warning(f"   ⚠️  No clear scorer: {b1_old.name} +{diff1}, {b2_old.name} +{diff2}")
                                
                                # Fallback: if delta logic failed, try current batsman name
                                if detected_player == 'Unknown' and current_batsmen[0]:
                                    # Use first batsman as fallback (usually the striker)
                                    detected_player = current_batsmen[0].name
                                    logger.info(f"   ℹ️  Fallback: Using {detected_player} (striker position)")
                                
                                event['batsman'] = detected_player
                                if detected_player != 'Unknown':
                                    logger.info(f"   🏏 {event['type']} by {detected_player}")
                                else:
                                    logger.warning(f"   ⚠️  Could not identify batsman for {event['type']}")
                                
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
# Clip extraction padding (seconds) - captures bowler run-up and crowd reaction
PADDING_BEFORE: float = 12.0
PADDING_AFTER: float = 10.0

# Smart merge threshold: if gap between clips is <= this, merge into one continuous clip
MERGE_GAP_THRESHOLD: float = 7.0


def get_video_duration(video_path: str) -> float:
    """Get video duration in seconds using FFprobe."""
    cmd = [
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', video_path
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            return float(result.stdout.strip())
    except (ValueError, subprocess.SubprocessError) as e:
        logger.warning(f"Could not determine video duration: {e}")
    return float('inf')  # Fallback: no upper bound


def calculate_clip_ranges(
    events: List[Dict],
    video_duration: float,
    padding_before: float = PADDING_BEFORE,
    padding_after: float = PADDING_AFTER,
    merge_gap: float = MERGE_GAP_THRESHOLD
) -> List[Dict]:
    """
    Calculate merged clip ranges from event timestamps.
    
    Applies padding to each event and merges overlapping/nearby clips to create
    smooth, continuous highlight segments instead of choppy individual cuts.
    
    Args:
        events: List of detected events with 'timestamp' key
        video_duration: Total video duration in seconds (for bounds checking)
        padding_before: Seconds to include before event (bowler run-up)
        padding_after: Seconds to include after event (crowd reaction)
        merge_gap: If gap between clips is <= this, merge into one clip
    
    Returns:
        List of merged clip ranges: [{'start': float, 'end': float, 'events': List[Dict]}]
    """
    if not events:
        return []
    
    # Step 1: Create raw time ranges with padding (bounds-checked)
    raw_ranges = []
    for event in events:
        ts = event['timestamp']
        start = max(0.0, ts - padding_before)
        end = min(video_duration, ts + padding_after)
        raw_ranges.append({
            'start': start,
            'end': end,
            'events': [event]
        })
    
    # Step 2: Sort by start time
    raw_ranges.sort(key=lambda r: r['start'])
    
    # Step 3: Smart merge - coalesce overlapping/nearby clips
    merged = [raw_ranges[0]]
    
    for current in raw_ranges[1:]:
        last = merged[-1]
        
        # Merge condition: current starts within (last.end + merge_gap)
        # This handles both overlapping clips and clips that are close together
        if current['start'] <= last['end'] + merge_gap:
            # Extend the last range to include current
            last['end'] = max(last['end'], current['end'])
            last['events'].extend(current['events'])
            logger.debug(f"Merged clips: {last['start']:.1f}s - {last['end']:.1f}s "
                        f"({len(last['events'])} events)")
        else:
            # Gap too large - start a new clip
            merged.append(current)
    
    logger.info(f"📊 Clip coalescing: {len(events)} events → {len(merged)} clips")
    for i, clip in enumerate(merged, 1):
        duration = clip['end'] - clip['start']
        event_types = [e['type'] for e in clip['events']]
        logger.info(f"   Clip {i}: {clip['start']:.1f}s - {clip['end']:.1f}s "
                   f"({duration:.1f}s, events: {event_types})")
    
    return merged


def extract_clips(
    video_path: str,
    events: List[Dict],
    output_dir: str,
    before: float = PADDING_BEFORE,
    after: float = PADDING_AFTER,
    merge_gap: float = MERGE_GAP_THRESHOLD
) -> List[str]:
    """
    Extract video clips around detected events using FFmpeg with smart merging.
    
    Applies configurable padding to capture bowler run-up and crowd reaction,
    then merges nearby clips to prevent choppy playback when events occur
    back-to-back (e.g., consecutive boundaries).
    
    Args:
        video_path: Path to source video
        events: List of detected events with 'timestamp' key
        output_dir: Directory for output clips
        before: Seconds of padding before each event
        after: Seconds of padding after each event
        merge_gap: Merge clips if gap between them is <= this value
    
    Returns:
        List of paths to extracted clip files
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    video_id = Path(video_path).stem
    clips = []
    
    if not events:
        logger.warning("No events to extract clips from")
        return clips
    
    # Get video duration for bounds checking
    video_duration = get_video_duration(video_path)
    logger.info(f"Video duration: {video_duration:.1f}s")
    
    # Calculate merged clip ranges
    clip_ranges = calculate_clip_ranges(
        events, video_duration, before, after, merge_gap
    )
    
    logger.info(f"\n✂️ Extracting {len(clip_ranges)} clips "
               f"(padding: {before}s before, {after}s after, merge gap: {merge_gap}s)")
    
    for i, clip_range in enumerate(clip_ranges, 1):
        start = clip_range['start']
        end = clip_range['end']
        duration = end - start
        event_count = len(clip_range['events'])
        
        # Generate descriptive filename with player name attribution
        event_types = '_'.join(sorted(set(e['type'] for e in clip_range['events'])))
        
        # Extract player names from events (prioritize known names over 'Unknown')
        player_names = [e.get('batsman', 'Unknown') for e in clip_range['events']]
        known_names = [n for n in player_names if n != 'Unknown']
        primary_player = known_names[0] if known_names else 'Unknown'
        
        # Format: PlayerName_EventType_Timestamp.mp4
        # Sanitize player name for filesystem (remove any remaining special chars)
        safe_player = re.sub(r'[^A-Za-z0-9]', '', primary_player)
        clip_name = f"{safe_player}_{event_types}_{int(start)}s.mp4"
        clip_path = Path(output_dir) / clip_name
        
        cmd = [
            'ffmpeg',
            '-ss', str(start),
            '-i', video_path,
            '-t', str(duration),
            '-c', 'copy',
            '-avoid_negative_ts', '1',
            '-y',
            str(clip_path)
        ]
        
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode == 0:
            clips.append(str(clip_path))
            size = clip_path.stat().st_size / (1024 * 1024)
            logger.info(f"  [{i}/{len(clip_ranges)}] {clip_name} "
                       f"({duration:.1f}s, {event_count} events, {size:.1f} MB)")
        else:
            logger.error(f"  [{i}/{len(clip_ranges)}] Failed: {clip_name}")
            logger.debug(f"FFmpeg stderr: {result.stderr.decode()}")
    
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


def extract_player_innings_highlights(
    video_path: str,
    events: List[Dict],
    output_dir: str,
    before: float = PADDING_BEFORE,
    after: float = PADDING_AFTER,
    merge_gap: float = MERGE_GAP_THRESHOLD
) -> Dict[str, str]:
    """
    Generate individual highlight reels for each player (Player_Innings.mp4).
    
    Groups events by batsman and creates a separate supercut for each player,
    enabling player-specific highlight reels like "KOHLI_Innings.mp4".
    
    Args:
        video_path: Path to source video
        events: List of detected events with 'batsman' and 'timestamp' keys
        output_dir: Directory for output reels
        before: Seconds of padding before each event
        after: Seconds of padding after each event
        merge_gap: Merge clips if gap between them is <= this value
    
    Returns:
        Dict mapping player name to reel path (e.g., {'KOHLI': 'path/KOHLI_Innings.mp4'})
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    video_id = Path(video_path).stem
    
    # Group events by player
    player_events: Dict[str, List[Dict]] = {}
    for event in events:
        player = event.get('batsman', 'Unknown')
        if player == 'Unknown':
            continue
        if player not in player_events:
            player_events[player] = []
        player_events[player].append(event)
    
    if not player_events:
        logger.warning("No player-attributed events to create innings highlights")
        return {}
    
    logger.info(f"\n🏏 Generating innings highlights for {len(player_events)} players:")
    for player, evts in player_events.items():
        fours = len([e for e in evts if e['type'] == 'FOUR'])
        sixes = len([e for e in evts if e['type'] == 'SIX'])
        logger.info(f"   {player}: {len(evts)} events ({fours} fours, {sixes} sixes)")
    
    video_duration = get_video_duration(video_path)
    player_reels: Dict[str, str] = {}
    
    for player, evts in player_events.items():
        # Calculate clip ranges for this player's events
        clip_ranges = calculate_clip_ranges(evts, video_duration, before, after, merge_gap)
        
        if not clip_ranges:
            continue
        
        # Temporary clips directory for this player
        temp_dir = Path(output_dir) / f".temp_{player}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        clips = []
        for i, clip_range in enumerate(clip_ranges, 1):
            start = clip_range['start']
            duration = clip_range['end'] - start
            
            clip_path = temp_dir / f"clip_{i:03d}.mp4"
            cmd = [
                'ffmpeg', '-ss', str(start), '-i', video_path,
                '-t', str(duration), '-c', 'copy',
                '-avoid_negative_ts', '1', '-y', str(clip_path)
            ]
            
            result = subprocess.run(cmd, capture_output=True)
            if result.returncode == 0:
                clips.append(str(clip_path))
        
        if not clips:
            continue
        
        # Create player innings supercut
        safe_name = re.sub(r'[^A-Za-z0-9]', '', player)
        reel_path = str(Path(output_dir) / f"{video_id}_{safe_name}_Innings.mp4")
        
        # Concatenate clips
        concat_file = temp_dir / "concat.txt"
        with open(concat_file, 'w') as f:
            for clip in clips:
                f.write(f"file '{Path(clip).absolute()}'\n")
        
        cmd = ['ffmpeg', '-f', 'concat', '-safe', '0', '-i', str(concat_file),
               '-c', 'copy', '-y', reel_path]
        result = subprocess.run(cmd, capture_output=True)
        
        # Cleanup temp files
        for clip in clips:
            Path(clip).unlink(missing_ok=True)
        concat_file.unlink(missing_ok=True)
        temp_dir.rmdir()
        
        if result.returncode == 0:
            size = Path(reel_path).stat().st_size / (1024 * 1024)
            duration = sum(r['end'] - r['start'] for r in clip_ranges)
            logger.info(f"   ✅ {safe_name}_Innings.mp4 ({duration:.1f}s, {size:.1f} MB)")
            player_reels[player] = reel_path
        else:
            logger.error(f"   ❌ Failed to create {player} innings highlight")
    
    return player_reels


def save_events_csv(events: List[Dict], output_path: str):
    """Save events to CSV file with player attribution."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['timestamp', 'type', 'batsman', 'description'])
        for event in events:
            writer.writerow([
                event['timestamp'],
                event['type'],
                event.get('batsman', 'Unknown'),
                event['description']
            ])
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
    parser.add_argument('--start-time', type=float, default=0.0, help='Start time (seconds, default: 0)')
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
    # Batsman name ROI (for player attribution)
    parser.add_argument('--batsman-roi-x', type=int, help='X coordinate of batsman name region')
    parser.add_argument('--batsman-roi-y', type=int, help='Y coordinate of batsman name region')
    parser.add_argument('--batsman-roi-width', type=int, help='Width of batsman name region')
    parser.add_argument('--batsman-roi-height', type=int, help='Height of batsman name region')
    # Bowler name ROI (for bowler spell tracking)
    parser.add_argument('--bowler-roi-x', type=int, help='X coordinate of bowler name region')
    parser.add_argument('--bowler-roi-y', type=int, help='Y coordinate of bowler name region')
    parser.add_argument('--bowler-roi-width', type=int, help='Width of bowler name region')
    parser.add_argument('--bowler-roi-height', type=int, help='Height of bowler name region')

    parser.add_argument('--before', type=float, default=PADDING_BEFORE, help=f'Seconds before event (default: {PADDING_BEFORE})')
    parser.add_argument('--after', type=float, default=PADDING_AFTER, help=f'Seconds after event (default: {PADDING_AFTER})')
    parser.add_argument('--merge-gap', type=float, default=MERGE_GAP_THRESHOLD, help=f'Merge clips if gap <= this (default: {MERGE_GAP_THRESHOLD}s)')
    parser.add_argument('--no-clips', action='store_true', help='Skip clip extraction')
    parser.add_argument('--no-supercut', action='store_true', help='Skip supercut')
    parser.add_argument('--player-innings', action='store_true', 
                        help='Generate individual innings highlights for each player (e.g., KOHLI_Innings.mp4)')
    parser.add_argument('--player-reels-dir', default='storage/player_reels',
                        help='Output directory for player innings reels')

    parser.add_argument('--visualize', action='store_true', help='Visualize ROI and exit')
    parser.add_argument('--timestamp', type=float, default=0.0, help='Timestamp for visualization')
    parser.add_argument('--debug-mode', action='store_true', help='Save debug frames')
    parser.add_argument('--verbose', action='store_true', help='Verbose logging')
    parser.add_argument('--gpu', action='store_true', help='Enable GPU acceleration')
    
    # Auto-calibration
    parser.add_argument('--auto-calibrate', action='store_true', 
                        help='Automatically detect scoreboard ROI (recommended for new videos)')
    parser.add_argument('--save-config', type=str, 
                        help='Save auto-calibrated config to JSON file')

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
    # Batsman name ROI
    if args.batsman_roi_x is not None:
        config.batsman_roi_x = args.batsman_roi_x
    if args.batsman_roi_y is not None:
        config.batsman_roi_y = args.batsman_roi_y
    if args.batsman_roi_width is not None:
        config.batsman_roi_width = args.batsman_roi_width
    if args.batsman_roi_height is not None:
        config.batsman_roi_height = args.batsman_roi_height
    # Bowler name ROI
    if hasattr(args, 'bowler_roi_x') and args.bowler_roi_x is not None:
        config.bowler_roi_x = args.bowler_roi_x
    if hasattr(args, 'bowler_roi_y') and args.bowler_roi_y is not None:
        config.bowler_roi_y = args.bowler_roi_y
    if hasattr(args, 'bowler_roi_width') and args.bowler_roi_width is not None:
        config.bowler_roi_width = args.bowler_roi_width
    if hasattr(args, 'bowler_roi_height') and args.bowler_roi_height is not None:
        config.bowler_roi_height = args.bowler_roi_height


def main():
    args = parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)
        logging.getLogger().setLevel(logging.DEBUG)

    logger.info(f"GPU: {'ENABLED' if args.gpu else 'DISABLED'}")

    config = ScoreboardConfig(args.config)
    config.use_gpu = args.gpu
    config.start_time = args.start_time
    
    # Auto-calibration mode
    if args.auto_calibrate:
        calibration = auto_calibrate_roi(args.video_path, use_gpu=args.gpu)
        
        if calibration:
            # Apply calibrated ROI to config
            config.roi_x = calibration['score']['x']
            config.roi_y = calibration['score']['y']
            config.roi_width = calibration['score']['width']
            config.roi_height = calibration['score']['height']
            
            config.overs_roi_x = calibration['overs']['x']
            config.overs_roi_y = calibration['overs']['y']
            config.overs_roi_width = calibration['overs']['width']
            config.overs_roi_height = calibration['overs']['height']
            
            config.batsman_roi_x = calibration['batsman_name']['x']
            config.batsman_roi_y = calibration['batsman_name']['y']
            config.batsman_roi_width = calibration['batsman_name']['width']
            config.batsman_roi_height = calibration['batsman_name']['height']
            
            # Apply suggested start time if detected
            suggested_start = calibration.get('suggested_start_time')
            if suggested_start is not None and args.start_time == 0:
                config.start_time = suggested_start
                logger.info(f"📍 Auto-applying start time: {suggested_start}s")
            
            # Save config if requested
            if args.save_config:
                config.save(args.save_config, suggested_start_time=suggested_start)
                logger.info(f"📁 Config saved to: {args.save_config}")
            
            # Show visualization at suggested start time (not 60s)
            viz_timestamp = args.timestamp if args.timestamp else (suggested_start if suggested_start else 60.0)
            logger.info("\n🔍 Generating ROI visualization...")
            visualize_roi(args.video_path, config, viz_timestamp)
            logger.info("   Check 'roi_check.jpg' to verify detection accuracy")
        else:
            logger.error("Auto-calibration failed. Please use manual ROI settings.")
            return
    
    # Apply manual CLI overrides (these take precedence over auto-calibration)
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
        clips = extract_clips(
            args.video_path, events, args.output_dir,
            before=args.before, after=args.after, merge_gap=args.merge_gap
        )

    if not args.no_supercut and clips:
        supercut_path = Path(args.supercut_dir) / f"{video_id}_highlights.mp4"
        supercut_path.parent.mkdir(parents=True, exist_ok=True)
        create_supercut(clips, str(supercut_path))

    # Generate player-specific innings highlights
    if args.player_innings:
        player_reels = extract_player_innings_highlights(
            args.video_path, events, args.player_reels_dir,
            before=args.before, after=args.after, merge_gap=args.merge_gap
        )
        if player_reels:
            logger.info(f"\n🏆 Generated {len(player_reels)} player innings reels:")
            for player, path in player_reels.items():
                logger.info(f"   {player}: {path}")

    logger.info("\n✅ COMPLETE")


if __name__ == '__main__':
    main()
