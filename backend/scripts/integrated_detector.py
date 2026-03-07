"""
Integrated Detector - Full Innings Segmentation with Continuous Striker Tracking
"""
import cv2
import numpy as np
import logging
import argparse
import re
import subprocess
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict

# Import existing OCR engine components
try:
    from ocr_engine import (
        ScoreboardConfig,
        OCRScoreReader,
        EventDetector,
        extract_clips,
        create_supercut,
        auto_calibrate_roi,
        visualize_roi,
    )
except ImportError as e:
    raise ImportError(f"ocr_engine.py required. Error: {e}")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- ROBUST PARSING LOGIC ---
@dataclass
class BatsmanState:
    name: str
    runs: int
    balls: int


def normalize_player_name(name: str) -> str:
    """Strip spaces, asterisks, special chars, and uppercase for comparison.
    
    Examples:
        'MAHESH RAM*' -> 'MAHESHRAM'
        'H.Waheed'   -> 'HWAHEED'
        ' Tar Ling ' -> 'TARLING'
    """
    if not name:
        return ''
    return re.sub(r'[^A-Z0-9]', '', name.upper())


def _levenshtein(a: str, b: str) -> int:
    """Standard DP Levenshtein distance — O(m*n), no off-by-one bugs."""
    m, n = len(a), len(b)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, n + 1):
            temp = dp[j]
            dp[j] = prev if a[i-1] == b[j-1] else 1 + min(prev, dp[j], dp[j-1])
            prev = temp
    return dp[n]


def fuzzy_match_player(ocr_name: str, target: str) -> bool:
    """Fuzzy player name matching: exact → substring → Levenshtein.

    Strategies (in order):
        1. Exact normalized match:    'MAHESH RAM*' == 'MAHESHRAM'
        2. Substring containment:     'MAHESHRAM' in 'MAHESHRAMSINGH'
        3. Levenshtein with length-scaled tolerance:
              names < 6 chars  → max 1 edit  (COX vs MEHTA = 4 edits → reject)
              names >= 6 chars → max 2 edits  (FLITWICK vs FLITWIC = 1 edit → accept)
    """
    norm_ocr = normalize_player_name(ocr_name)
    norm_target = normalize_player_name(target)

    if not norm_ocr or not norm_target:
        return False

    # Strategy 1: Exact normalized match
    if norm_ocr == norm_target:
        return True

    # Strategy 2: Substring containment (either direction)
    if norm_target in norm_ocr or norm_ocr in norm_target:
        return True

    # Strategy 3: Levenshtein with strict length-scaled tolerance
    len_diff = abs(len(norm_ocr) - len(norm_target))
    min_len = min(len(norm_ocr), len(norm_target))
    # Allow max 1 edit for very short names (<5 chars), 2 edits for longer names
    max_edits = 1 if min_len < 5 else 2
    if len_diff <= max_edits:
        dist = _levenshtein(norm_ocr, norm_target)
        if dist <= max_edits:
            return True

    return False


def parse_batsmen_details_robust(text: str) -> Tuple[Optional[BatsmanState], Optional[BatsmanState]]:
    """
    Robustly parses: "TARLING 3 10 HAMD WAHEED 10 19"
    """
    if not text:
        return None, None
    
    # 1. Basic Cleanup
    text = text.upper().replace('|', ' ').replace('/', ' ')
    # Remove leading junk (triangles, single digits like '6 TARLING')
    text = re.sub(r'^[▶►>649]\s*', '', text)
    
    # 2. Regex: Non-greedy Name, Digits, Digits, Non-greedy Name, Digits, Digits
    # Matches: "NAME (runs) (balls) NAME (runs) (balls)"
    # [A-Z\s]{3,} matches names with spaces like "HAMD WAHEED"
    pattern = re.compile(
        r'([A-Z\s]{3,}?)\s+(\d{1,3})\s+(\d{1,3})\s+'  # Batsman 1
        r'([A-Z\s]{3,}?)\s+(\d{1,3})\s+(\d{1,3})'     # Batsman 2
    )
    
    match = pattern.search(text)
    if match:
        try:
            name1 = match.group(1).strip()
            runs1 = int(match.group(2))
            balls1 = int(match.group(3))
            
            name2 = match.group(4).strip()
            runs2 = int(match.group(5))
            balls2 = int(match.group(6))
            
            return BatsmanState(name1, runs1, balls1), BatsmanState(name2, runs2, balls2)
        except ValueError:
            pass
            
    return None, None


# --- CONTINUOUS STRIKER TRACKING ---
@dataclass
class StrikerSegment:
    """Represents a continuous time segment where a player was on strike."""
    player: str
    start_time: float
    end_time: float
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time


class StrikerSessionManager:
    """
    Manages continuous striker tracking using Run-Length Encoding (RLE).
    
    Samples batsman name every interval and builds a timeline of (timestamp, striker_name).
    Merges consecutive readings into segments, with gap-filling for OCR glitches.
    """
    
    def __init__(self, gap_threshold: float = 5.0, min_segment_duration: float = 3.0):
        """
        Args:
            gap_threshold: Maximum gap (seconds) to merge across (handles replays/camera pans)
            min_segment_duration: Minimum segment duration to keep (filters noise)
        """
        self.gap_threshold = gap_threshold
        self.min_segment_duration = min_segment_duration
        
        # Raw timeline: [(timestamp, striker_name), ...]
        self.timeline: List[Tuple[float, str]] = []
        
        # Processed segments: {player_name: [StrikerSegment, ...]}
        self._segments_cache: Optional[Dict[str, List[StrikerSegment]]] = None
    
    def add_reading(self, timestamp: float, striker_name: str) -> None:
        """
        Add a timestamped striker reading to the timeline.
        Invalidates segment cache when new data is added.
        """
        self.timeline.append((timestamp, striker_name))
        self._segments_cache = None  # Invalidate cache
    
    def get_timeline(self) -> List[Tuple[float, str]]:
        """Return the raw timeline."""
        return self.timeline.copy()
    
    def _run_length_encode(self) -> List[Tuple[str, float, float]]:
        """
        Convert raw timeline to RLE format.
        Returns: [(player, start_time, end_time), ...]
        """
        if not self.timeline:
            return []
        
        # Sort by timestamp
        sorted_timeline = sorted(self.timeline, key=lambda x: x[0])
        
        rle_segments = []
        current_player = sorted_timeline[0][1]
        segment_start = sorted_timeline[0][0]
        last_time = segment_start
        
        for timestamp, player in sorted_timeline[1:]:
            if player != current_player:
                # End current segment
                rle_segments.append((current_player, segment_start, last_time))
                # Start new segment
                current_player = player
                segment_start = timestamp
            last_time = timestamp
        
        # Close final segment
        rle_segments.append((current_player, segment_start, last_time))
        
        return rle_segments
    
    def _fill_gaps(self, rle_segments: List[Tuple[str, float, float]]) -> List[Tuple[str, float, float]]:
        """
        Fill short gaps of 'Unknown' between same-player segments.
        Example: [(A, 0, 10), (Unknown, 10, 12), (A, 12, 50)] -> [(A, 0, 50)]
        """
        if len(rle_segments) < 3:
            return rle_segments
        
        filled = []
        i = 0
        
        while i < len(rle_segments):
            current = rle_segments[i]
            
            # Look ahead for gap-filling opportunity
            if i + 2 < len(rle_segments):
                gap = rle_segments[i + 1]
                next_seg = rle_segments[i + 2]
                
                # Check if: Current and Next are same player, Gap is Unknown/short
                gap_duration = gap[2] - gap[1]
                
                if (current[0] == next_seg[0] and 
                    current[0] != 'Unknown' and
                    (gap[0] == 'Unknown' or gap_duration <= self.gap_threshold)):
                    
                    # Merge: current + gap + next into one segment
                    merged = (current[0], current[1], next_seg[2])
                    filled.append(merged)
                    i += 3  # Skip gap and next
                    continue
            
            filled.append(current)
            i += 1
        
        return filled
    
    def _merge_adjacent(self, segments: List[Tuple[str, float, float]]) -> List[Tuple[str, float, float]]:
        """
        Merge adjacent segments of the same player.
        Also fills gaps below threshold between same-player segments.
        """
        if not segments:
            return []
        
        merged = []
        current = list(segments[0])  # [player, start, end]
        
        for player, start, end in segments[1:]:
            gap = start - current[2]
            
            # If same player and gap is small enough, extend current segment
            if player == current[0] and gap <= self.gap_threshold:
                current[2] = end
            else:
                # Different player or gap too large - save current, start new
                merged.append(tuple(current))
                current = [player, start, end]
        
        merged.append(tuple(current))
        return merged
    
    def get_segments(self, refresh: bool = False) -> Dict[str, List[StrikerSegment]]:
        """
        Process timeline and return segments grouped by player.
        
        Args:
            refresh: Force recomputation even if cached
            
        Returns:
            Dict mapping player names to list of StrikerSegment objects
        """
        if self._segments_cache is not None and not refresh:
            return self._segments_cache
        
        # Step 1: Run-Length Encode
        rle = self._run_length_encode()
        logger.debug(f"RLE produced {len(rle)} raw segments")
        
        # Step 2: Fill gaps (Unknown between same player)
        filled = self._fill_gaps(rle)
        logger.debug(f"Gap-filling reduced to {len(filled)} segments")
        
        # Step 3: Merge adjacent same-player segments
        merged = self._merge_adjacent(filled)
        logger.debug(f"Merging produced {len(merged)} final segments")
        
        # Step 4: Filter by minimum duration and group by player
        segments_by_player: Dict[str, List[StrikerSegment]] = defaultdict(list)
        
        for player, start, end in merged:
            duration = end - start
            
            # Skip Unknown players
            if player == 'Unknown':
                continue
            
            # Skip segments shorter than minimum
            if duration < self.min_segment_duration:
                logger.debug(f"Skipping short segment: {player} ({duration:.1f}s < {self.min_segment_duration}s)")
                continue
            
            segments_by_player[player].append(StrikerSegment(player, start, end))
        
        self._segments_cache = dict(segments_by_player)
        return self._segments_cache
    
    def get_total_time_on_strike(self, player: str) -> float:
        """Get total time a player spent on strike."""
        segments = self.get_segments()
        if player not in segments:
            return 0.0
        return sum(seg.duration for seg in segments[player])
    
    def get_summary(self) -> Dict[str, Dict]:
        """Get summary statistics for all players."""
        segments = self.get_segments()
        summary = {}
        
        for player, segs in segments.items():
            total_time = sum(seg.duration for seg in segs)
            summary[player] = {
                'segment_count': len(segs),
                'total_time_on_strike': total_time,
                'segments': [(seg.start_time, seg.end_time) for seg in segs]
            }
        
        return summary
    
    def __repr__(self) -> str:
        return f"StrikerSessionManager(readings={len(self.timeline)}, gap_threshold={self.gap_threshold}s)"


# --- CLIP PADDING CONFIGURATION ---
@dataclass
class ClipPadding:
    """Configurable padding for different event types."""
    # Boundary events (FOUR, SIX) - longer pre-roll for buildup
    boundary_pre: float = 12.0
    boundary_post: float = 10.0
    
    # Delivery events (dot balls, singles) - tighter cuts
    delivery_pre: float = 10.0
    delivery_post: float = 5.0
    
    # Wicket events - longer post-roll for celebration
    wicket_pre: float = 10.0
    wicket_post: float = 15.0
    
    # Bowler delivery events - captures run-up and delivery completion
    bowler_delivery_pre: float = 12.0
    bowler_delivery_post: float = 5.0
    
    def get_padding(self, event_type: str) -> Tuple[float, float]:
        """Return (pre_padding, post_padding) for given event type."""
        event_type = event_type.upper()
        if event_type in ('FOUR', 'SIX'):
            return (self.boundary_pre, self.boundary_post)
        elif event_type == 'WICKET':
            return (self.wicket_pre, self.wicket_post)
        elif event_type == 'BOWLER_DELIVERY':
            return (self.bowler_delivery_pre, self.bowler_delivery_post)
        else:  # DELIVERY, PLAYED_SHOT, etc.
            return (self.delivery_pre, self.delivery_post)


@dataclass
class IntegratedConfig:
    scoreboard_config: ScoreboardConfig = None
    # multimodal_config removed
    mode: str = "full"
    output_dir: str = "storage/trimmed"
    supercut_dir: str = "storage/highlight"
    player_reels_dir: str = "storage/player_reels"
    innings_dir: str = "storage/innings"  # Full innings videos
    debug_ocr_dir: str = None  # Optional: save failed OCR ROI images for inspection
    sample_interval: float = 1.0
    striker_gap_threshold: float = 5.0  # Gap-filling threshold for striker tracking
    min_segment_duration: float = 3.0  # Minimum segment duration to keep
    use_gpu: bool = False
    
    # Ball-by-ball tracking
    track_deliveries: bool = False  # Enable ball-by-ball event tracking
    clip_padding: ClipPadding = None  # Padding configuration for clips
    
    def __post_init__(self):
        if self.scoreboard_config is None:
            self.scoreboard_config = ScoreboardConfig()
        # multimodal_config removed
        if self.clip_padding is None:
            self.clip_padding = ClipPadding()
        if self.debug_ocr_dir:
            Path(self.debug_ocr_dir).mkdir(parents=True, exist_ok=True)
            logger.info(f"💾 OCR debug mode enabled: {self.debug_ocr_dir}")


class IntegratedDetector:
    def __init__(self, config: IntegratedConfig):
        self.config = config
        self.mode = config.mode
        self.ocr_reader = OCRScoreReader(config.scoreboard_config, config.use_gpu)
        self.event_detector = EventDetector()
        
        # STATE TRACKING
        self.prev_batsmen: Tuple[Optional[BatsmanState], Optional[BatsmanState]] = (None, None)
        self.current_striker: str = "Unknown"  # <-- MEMORY FIX
        
        # BALL-BY-BALL TRACKING: Track last known balls for each batsman
        self.last_balls: Dict[str, int] = {}  # {player_name: balls_faced}
        self._last_runs: Dict[str, int] = {}  # {player_name: runs_scored}
        self.delivery_events: List[Dict] = []  # All delivery events (including dot balls)
        self.ocr_error_count: int = 0  # Track OCR corruption instances
        
        # LAST KNOWN VALUE (LKV) CACHE for transient OCR failures
        self._lkv_batsmen: Tuple[Optional[BatsmanState], Optional[BatsmanState]] = (None, None)
        self._lkv_timestamp: float = -999.0  # Timestamp of last successful batsman read
        self._lkv_max_age: float = 3.0  # Max seconds to trust LKV (handles replays/transitions)
        self._lkv_miss_count: int = 0  # Consecutive OCR misses
        
        # SCOREBOARD STATE MANAGER
        self._scoreboard_hidden: bool = False  # True when scoreboard has been hidden for >5 consecutive misses
        self._scoreboard_hidden_since: float = -999.0  # Timestamp when scoreboard was first detected as hidden
        self._scoreboard_visible_threshold: int = 5  # Consecutive misses before declaring hidden (~10s at 2s interval)
        self._debug_failures_dir: str = "debug_failures"  # Directory for failure snapshots
        Path(self._debug_failures_dir).mkdir(parents=True, exist_ok=True)
        
        # LOOK-AHEAD state for delta lag resolution
        self._pending_event: Optional[Dict] = None  # Event awaiting delta attribution
        self._pending_event_frame: Optional[np.ndarray] = None
        self._pending_event_ts: float = -999.0
        self._lookahead_frames_remaining: int = 0
        self._lookahead_max_frames: int = 30  # Max frames to look ahead (~1-2 seconds)
        
        # CONTINUOUS STRIKER TRACKING
        self.striker_manager = StrikerSessionManager(
            gap_threshold=config.striker_gap_threshold,
            min_segment_duration=config.min_segment_duration
        )
        
        # multimodal_engine logic removed
        
        self.all_events: List[Dict] = []
        self.player_events: Dict[str, List[Dict]] = {}  # Fixed: Dict, not List
        
        # Per-player delivery tracking
        self.player_deliveries: Dict[str, List[Dict]] = {}  # {player: [delivery_events]}
        
        # BOWLER SPELL TRACKING
        self.prev_overs: Optional[Tuple[int, int]] = None  # (overs, balls) from last frame
        self.current_bowler: str = "Unknown"  # Memory state: last known bowler name
        self.current_bowler_ts: float = -1.0  # Timestamp when current_bowler was last confirmed by OCR
        self.target_bowler: Optional[str] = None  # CLI target for --target-bowler filtering
        self.bowler_delivery_events: List[Dict] = []  # All deliveries attributed to target bowler
        # Memory TTL: how long to trust last-known bowler when OCR fails on a delivery frame
        # Cricket overs = ~2-4 min broadcast. 120s HARD cutoff prevents stale attribution.
        self.BOWLER_MEMORY_TTL: float = 120.0
    
    def _save_failure_snapshot(self, frame: np.ndarray, timestamp: float) -> None:
        """Save cropped ROI snapshot when OCR detection fails.
        
        Visual Debugger: Saves only the batsman ROI crop so you can open
        debug_failures/ and verify if the scoreboard was on screen.
        """
        try:
            cfg = self.config.scoreboard_config
            bat_crop = frame[cfg.batsman_roi_y:cfg.batsman_roi_y + cfg.batsman_roi_height,
                            cfg.batsman_roi_x:cfg.batsman_roi_x + cfg.batsman_roi_width]
            if bat_crop.size > 0:
                out_path = f"{self._debug_failures_dir}/failure_{timestamp:.1f}s.jpg"
                cv2.imwrite(out_path, bat_crop)
                logger.debug(f"💾 Failure snapshot saved: {out_path}")
        except Exception as e:
            logger.debug(f"⚠️ Could not save failure snapshot at {timestamp:.1f}s: {e}")

    def _save_debug_frame(self, frame: np.ndarray, timestamp: float, reason: str) -> None:
        """Save annotated debug frame when OCR warnings trigger.
        
        Saves the full frame with ROI rectangles drawn, plus individual ROI crops,
        so you can visually inspect exactly what OCR saw at that timestamp.
        """
        debug_dir = self.config.debug_ocr_dir
        if not debug_dir:
            return
        
        Path(debug_dir).mkdir(parents=True, exist_ok=True)
        safe_reason = re.sub(r'[^\w]', '_', reason)
        prefix = f"{debug_dir}/warn_{timestamp:.1f}s_{safe_reason}"
        
        # 1. Save full frame with ROI rectangles drawn
        annotated = frame.copy()
        cfg = self.config.scoreboard_config
        
        # Draw score ROI (green)
        cv2.rectangle(annotated, 
                      (cfg.roi_x, cfg.roi_y), 
                      (cfg.roi_x + cfg.roi_width, cfg.roi_y + cfg.roi_height), 
                      (0, 255, 0), 2)
        cv2.putText(annotated, "SCORE", (cfg.roi_x, cfg.roi_y - 5), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
        
        # Draw batsman ROI (red)
        cv2.rectangle(annotated,
                      (cfg.batsman_roi_x, cfg.batsman_roi_y),
                      (cfg.batsman_roi_x + cfg.batsman_roi_width, cfg.batsman_roi_y + cfg.batsman_roi_height),
                      (0, 0, 255), 2)
        cv2.putText(annotated, "BATSMAN", (cfg.batsman_roi_x, cfg.batsman_roi_y - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
        
        # Draw overs ROI (blue)
        cv2.rectangle(annotated,
                      (cfg.overs_roi_x, cfg.overs_roi_y),
                      (cfg.overs_roi_x + cfg.overs_roi_width, cfg.overs_roi_y + cfg.overs_roi_height),
                      (255, 0, 0), 2)
        
        # Add timestamp and reason label
        cv2.putText(annotated, f"t={timestamp:.1f}s | {reason}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        
        cv2.imwrite(f"{prefix}_full.jpg", annotated)
        
        # 2. Save individual ROI crops
        try:
            score_crop = frame[cfg.roi_y:cfg.roi_y+cfg.roi_height, cfg.roi_x:cfg.roi_x+cfg.roi_width]
            cv2.imwrite(f"{prefix}_score_crop.jpg", score_crop)
        except Exception:
            pass
        
        try:
            bat_crop = frame[cfg.batsman_roi_y:cfg.batsman_roi_y+cfg.batsman_roi_height, 
                            cfg.batsman_roi_x:cfg.batsman_roi_x+cfg.batsman_roi_width]
            cv2.imwrite(f"{prefix}_batsman_crop.jpg", bat_crop)
        except Exception:
            pass
        
        logger.debug(f"💾 Debug frame saved: {prefix}_full.jpg")

    def _process_ocr(self, frame: np.ndarray, timestamp: float) -> Tuple[Optional[Dict], str, float]:
        # Generate debug path if debug mode is enabled
        debug_path = None
        if self.config.debug_ocr_dir:
            debug_path = f"{self.config.debug_ocr_dir}/ts_{timestamp:.1f}"
        
        score_roi = self.ocr_reader.extract_score_roi(frame, debug_path=debug_path)
        overs_roi = self.ocr_reader.extract_overs_roi(frame, debug_path=debug_path)
        if score_roi is None: return None, "Unknown", 0.0
        
        prev_wickets = self.event_detector.get_last_wickets()
        score, confidence, _ = self.ocr_reader.read_score(score_roi, min_confidence=0.4, prev_wickets=prev_wickets)
        overs = self.ocr_reader.read_overs(overs_roi) if overs_roi is not None else None
        
        # Note: relying on delta logic primarily
        batsman_name = self.ocr_reader.read_batsman_name(frame, timestamp, debug_dir=self.config.debug_ocr_dir)
        
        event = None
        if score:
            event = self.event_detector.detect(score, timestamp, overs)
        
        return event, batsman_name, confidence

    # _create_mm_candidate_from_ocr removed (no longer needed)

    def process_frame(self, frame: np.ndarray, timestamp: float) -> Optional[Dict]:
        """Process frame with LKV Fallback, Look-Ahead Retry, and Ball-by-Ball Tracking.
        
        Fixes three failure modes:
        1. "No text detected" → LKV (Last Known Value) fallback for transient overlay gaps
        2. "Delta Logic Inconclusive" → Look-Ahead retry for scoreboard lag
        3. Debug frame saving on any warning for post-mortem inspection
        """
        
        # === PHASE 0: RESOLVE PENDING LOOK-AHEAD EVENT ===
        if self._pending_event and self._lookahead_frames_remaining > 0:
            resolved = self._resolve_lookahead(frame, timestamp)
            if resolved:
                return resolved
            self._lookahead_frames_remaining -= 1
            if self._lookahead_frames_remaining <= 0:
                # Look-ahead exhausted — attribute to memory/last known striker
                logger.warning(f"   ⏰ Look-ahead exhausted for {self._pending_event['type']} at "
                              f"{self._pending_event_ts:.1f}s. Using memory: {self.current_striker}")
                self._pending_event['player'] = self.current_striker
                self._pending_event['batsman'] = self.current_striker
                self._pending_event['attribution'] = 'lookahead_exhausted_memory'
                self._record_event(self._pending_event)
                result = self._pending_event
                self._pending_event = None
                self._pending_event_frame = None
                return result
        
        # === PHASE 1: READ BATSMEN DETAILS (with LKV fallback) ===
        current_batsmen = (None, None)
        batsman_roi = self.ocr_reader.extract_batsman_name_roi(frame)
        if batsman_roi is not None:
            results = self.ocr_reader.reader.readtext(batsman_roi, detail=0, paragraph=True)
            if results:
                raw_text = ' '.join(results)
                current_batsmen = parse_batsmen_details_robust(raw_text)

        # LKV FALLBACK + SCOREBOARD STATE MANAGER
        if current_batsmen[0] is None:
            self._lkv_miss_count += 1
            age = timestamp - self._lkv_timestamp
            
            if self._lkv_miss_count < self._scoreboard_visible_threshold:
                # Phase 1: Transient miss (<5 consecutive). Use LKV, assume striker unchanged.
                if self._lkv_batsmen[0] is not None and age <= self._lkv_max_age * 2:
                    current_batsmen = self._lkv_batsmen
                    logger.debug(f"🔄 LKV fallback at {timestamp:.1f}s (age={age:.1f}s, misses={self._lkv_miss_count})")
                else:
                    # Save visual debug snapshot on first miss in streak
                    if self._lkv_miss_count == 1:
                        self._save_failure_snapshot(frame, timestamp)
                        self._save_debug_frame(frame, timestamp, "no_text_detected")
            
            elif self._lkv_miss_count == self._scoreboard_visible_threshold:
                # Phase 2: Transition → scoreboard hidden. Log ONCE, save snapshot.
                self._scoreboard_hidden = True
                self._scoreboard_hidden_since = timestamp - (self._scoreboard_visible_threshold * self.config.sample_interval)
                logger.warning(f"📉 Scoreboard hidden at ~{self._scoreboard_hidden_since:.1f}s "
                              f"(no text for {self._lkv_miss_count} consecutive frames). "
                              f"Pausing detection until reappearance.")
                self._save_failure_snapshot(frame, timestamp)
            
            else:
                # Phase 3: Scoreboard still hidden. SILENCE — no warnings, no debug saves.
                pass
        
        else:
            # Successful read — update LKV cache, reset miss counter, check reappearance
            if self._scoreboard_hidden:
                gap_duration = timestamp - self._scoreboard_hidden_since
                logger.info(f"📈 Scoreboard reappeared at {timestamp:.1f}s "
                           f"(was hidden for {gap_duration:.1f}s)")
                self._scoreboard_hidden = False
            
            self._lkv_batsmen = current_batsmen
            self._lkv_timestamp = timestamp
            self._lkv_miss_count = 0
            
            # [STATE] Debug: Log exactly what OCR sees when scoreboard is parsed
            b1, b2 = current_batsmen
            p1_str = f"{b1.name} ({b1.runs}/{b1.balls})" if b1 else "None"
            p2_str = f"{b2.name} ({b2.runs}/{b2.balls})" if b2 else "None"
            logger.info(f"[STATE] {timestamp:.1f}s | P1: {p1_str} | P2: {p2_str}")

        # === PHASE 2: BALL-BY-BALL TRACKING (Delivery Detection) ===
        delivery_event = None
        if self.config.track_deliveries and current_batsmen[0]:
            delivery_event = self._detect_delivery(current_batsmen, timestamp)

        # === PHASE 2.5: BOWLER SPELL TRACKING (Overs-Based Delivery Detection) ===
        bowler_delivery = None
        if self.target_bowler:
            bowler_delivery = self._detect_bowler_delivery(frame, timestamp)

        # === PHASE 3: SCORE-BASED EVENT DETECTION (4s, 6s, Wickets) ===
        ocr_event, _, ocr_confidence = self._process_ocr(frame, timestamp)
        
        # === PHASE 4: PLAYER RESOLUTION (Delta Logic + Look-Ahead) ===
        detected_player = "Unknown"
        
        if ocr_event:
            logger.info(f"🎯 EVENT DETECTED: {ocr_event['type']} at {timestamp:.1f}s")
            
            delta_winner = None
            
            # --- A. TRY DELTA LOGIC (Best Accuracy) ---
            if (current_batsmen[0] and self.prev_batsmen[0]):
                b1_new, b2_new = current_batsmen
                b1_old, b2_old = self.prev_batsmen
                
                # Calculate diffs
                diff1 = b1_new.runs - b1_old.runs
                diff2 = b2_new.runs - b2_old.runs
                runs_scored = ocr_event.get('runs_scored', 0)
                
                # Debug print
                logger.debug(f"[DELTA] Event Runs: {runs_scored} | "
                            f"{b1_new.name}: {b1_old.runs}→{b1_new.runs} (Δ{diff1}) | "
                            f"{b2_new.name}: {b2_old.runs}→{b2_new.runs} (Δ{diff2})")

                # Allow ±1 tolerance for OCR jitter
                if diff1 >= runs_scored - 1 and diff1 > 0:
                    delta_winner = b1_new.name
                elif diff2 >= runs_scored - 1 and diff2 > 0:
                    delta_winner = b2_new.name
            
            if delta_winner:
                detected_player = delta_winner
                self.current_striker = delta_winner  # UPDATE MEMORY
                logger.info(f"   ✅ Delta Logic Winner: {detected_player}")
            
            else:
                # --- B. LOOK-AHEAD: Queue event, wait for batsman score to catch up ---
                logger.warning(f"   ⚠️ Delta Logic Inconclusive — initiating look-ahead retry")
                self._save_debug_frame(frame, timestamp, "delta_inconclusive")
                
                # Store the event and wait for next frames to resolve
                self._pending_event = ocr_event.copy()
                self._pending_event_frame = frame.copy()
                self._pending_event_ts = timestamp
                self._lookahead_frames_remaining = self._lookahead_max_frames
                
                # Update history before returning (so next frame has correct prev_batsmen)
                if current_batsmen[0]:
                    self.prev_batsmen = current_batsmen
                return delivery_event  # Don't record event yet — let look-ahead resolve it

            ocr_event['player'] = detected_player
            ocr_event['batsman'] = detected_player
            ocr_event['attribution'] = 'delta_logic'

        # === PHASE 5: Update History ===
        if current_batsmen[0]:
            self.prev_batsmen = current_batsmen

        # === PHASE 6: Confirmation & Recording ===
        if self.mode == "full" and self.mm_engine:
            ocr_candidates = []
            if ocr_event:
                ocr_candidates.append(self._create_mm_candidate_from_ocr(ocr_event, ocr_confidence))
            
            fused_events = self.mm_engine.process_frame(
                frame, timestamp, ocr_candidates=ocr_candidates, batsman_name=detected_player
            )
            
            if not fused_events and ocr_event:
                logger.info(f"   ⚠️ Visual confirmation failed, falling back to OCR for {ocr_event['type']}")
                fallback_event = ocr_event.copy()
                fallback_event['signals'] = ['ocr_fallback']
                self._record_event(fallback_event)
                return fallback_event
            
            for fe in fused_events:
                event_dict = {
                    'type': fe.event_type.value, 'timestamp': fe.timestamp, 'confidence': fe.confidence,
                    'player': fe.player.name if fe.player else detected_player,
                    'score_before': fe.score_before, 'score_after': fe.score_after,
                    'signals': fe.contributing_signals
                }
                self._record_event(event_dict)
                return event_dict
        
        elif self.mode == "ocr" and ocr_event:
            self._record_event(ocr_event)
            return ocr_event
        
        # Return delivery event if no boundary/wicket event
        return delivery_event

    def _resolve_lookahead(self, frame: np.ndarray, timestamp: float) -> Optional[Dict]:
        """Try to resolve a pending event using fresh batsman data from this frame.
        
        The total score updated (e.g., 100→104), but the batsman's individual score 
        was stale. This method checks if the batsman score has now caught up.
        """
        batsman_roi = self.ocr_reader.extract_batsman_name_roi(frame)
        if batsman_roi is None:
            return None
            
        results = self.ocr_reader.reader.readtext(batsman_roi, detail=0, paragraph=True)
        if not results:
            return None
            
        raw_text = ' '.join(results)
        current_batsmen = parse_batsmen_details_robust(raw_text)
        if not current_batsmen[0]:
            return None
        
        # Try delta logic against the state from BEFORE the pending event
        if self.prev_batsmen[0]:
            b1_new, b2_new = current_batsmen
            b1_old, b2_old = self.prev_batsmen
            
            runs_scored = self._pending_event.get('runs_scored', 0)
            diff1 = b1_new.runs - b1_old.runs
            diff2 = b2_new.runs - b2_old.runs
            
            delta_winner = None
            if diff1 >= runs_scored - 1 and diff1 > 0:
                delta_winner = b1_new.name
            elif diff2 >= runs_scored - 1 and diff2 > 0:
                delta_winner = b2_new.name
            
            if delta_winner:
                logger.info(f"   🔁 Look-ahead resolved at {timestamp:.1f}s: "
                           f"{self._pending_event['type']} → {delta_winner}")
                self._pending_event['player'] = delta_winner
                self._pending_event['batsman'] = delta_winner
                self._pending_event['attribution'] = 'lookahead_resolved'
                self.current_striker = delta_winner
                self._record_event(self._pending_event)
                
                # Update state
                self.prev_batsmen = current_batsmen
                self._lkv_batsmen = current_batsmen
                self._lkv_timestamp = timestamp
                
                result = self._pending_event
                self._pending_event = None
                self._pending_event_frame = None
                return result
        
        # Update LKV even during look-ahead
        if current_batsmen[0]:
            self._lkv_batsmen = current_batsmen
            self._lkv_timestamp = timestamp
        
        return None

    def _detect_bowler_delivery(self, frame: np.ndarray, timestamp: float) -> Optional[Dict]:
        """
        Detect deliveries bowled by the target bowler via overs increment.
        
        Trigger Logic:
        - Read current overs from OCR
        - If current_overs > self.prev_overs → a delivery was bowled
        - Read bowler name from frame; if fuzzy_match to self.target_bowler → log BOWLER_DELIVERY
        - Memory Fallback: if bowler OCR fails on overs-change frame, use self.current_bowler
        
        Handles:
        - Normal increment: 14.1 → 14.2
        - Over boundary: 14.5 → 15.0
        - Wide/no-ball: overs stay same (no trigger — those don't count as legal deliveries)
        
        Args:
            frame: Current video frame
            timestamp: Current video timestamp
            
        Returns:
            BOWLER_DELIVERY event dict if target bowler delivered, None otherwise
        """
        # Read current overs from frame
        overs_roi = self.ocr_reader.extract_overs_roi(frame)
        current_overs = self.ocr_reader.read_overs(overs_roi) if overs_roi is not None else None
        
        if current_overs is None:
            return None
        
        # Convert overs tuple to comparable float: (14, 2) → 14.2
        def overs_to_float(ov: Tuple[int, int]) -> float:
            return ov[0] + ov[1] / 10.0
        
        current_overs_f = overs_to_float(current_overs)
        
        # Check if overs advanced (delivery bowled)
        delivery_detected = False
        if self.prev_overs is not None:
            prev_overs_f = overs_to_float(self.prev_overs)
            
            # Overs must increase (handles 14.2→14.3 and 14.5→15.0)
            # Guard against wild OCR jumps (>2 overs at once is suspicious)
            overs_diff = current_overs_f - prev_overs_f
            if 0 < overs_diff <= 2.0:
                delivery_detected = True
                logger.info(f"   🎳 Overs advanced: {self.prev_overs[0]}.{self.prev_overs[1]} → "
                            f"{current_overs[0]}.{current_overs[1]} at {timestamp:.1f}s")
            else:
                logger.debug(f"   ⏱ Overs unchanged: {current_overs[0]}.{current_overs[1]} at {timestamp:.1f}s")
        
        # Always update prev_overs for next frame comparison
        self.prev_overs = current_overs
        
        if not delivery_detected:
            # Even when no delivery, opportunistically read bowler name for memory state
            bowler_name = self.ocr_reader.read_bowler_name(
                frame, timestamp, debug_dir=self.config.debug_ocr_dir
            )
            if bowler_name != 'Unknown':
                self.current_bowler = bowler_name
                self.current_bowler_ts = timestamp
            return None
        
        # === DELIVERY DETECTED: Attribute to bowler ===
        
        # Read bowler name from frame
        bowler_name = self.ocr_reader.read_bowler_name(
            frame, timestamp, debug_dir=self.config.debug_ocr_dir
        )
        
        if bowler_name != 'Unknown':
            # Fresh OCR read — update memory
            self.current_bowler = bowler_name
            self.current_bowler_ts = timestamp
        else:
            # OCR failed — check if memory is still fresh enough to trust
            memory_age = timestamp - self.current_bowler_ts
            if self.current_bowler != 'Unknown' and memory_age <= self.BOWLER_MEMORY_TTL:
                bowler_name = self.current_bowler
                logger.debug(f"   🔄 Bowler OCR failed, using memory ({memory_age:.0f}s old): {bowler_name}")
            else:
                # Memory is stale (>120s) or never set — skip this delivery entirely
                logger.info(f"   ⏭️ Delivery at {timestamp:.1f}s skipped: bowler OCR failed & "
                           f"memory stale ({memory_age:.0f}s since last confirmed read)")
                return None
        
        # Check if this bowler matches our target
        is_target = False
        if self.target_bowler and bowler_name != 'Unknown':
            is_target = fuzzy_match_player(bowler_name, self.target_bowler)
        
        # Log every delivery for visibility
        match_symbol = "✅" if is_target else "⬜"
        logger.info(f"   {match_symbol} Delivery at {timestamp:.1f}s | "
                   f"Overs: {current_overs[0]}.{current_overs[1]} | "
                   f"Bowler: {bowler_name} | Target: {self.target_bowler} | "
                   f"Match: {is_target}")
        
        if is_target:
            event = {
                'type': 'BOWLER_DELIVERY',
                'timestamp': timestamp,
                'bowler': bowler_name,
                'overs': f"{current_overs[0]}.{current_overs[1]}",
                'description': f"Delivery by {bowler_name} at {current_overs[0]}.{current_overs[1]} overs",
                'attribution': 'overs_delta'
            }
            self.bowler_delivery_events.append(event)
            return event
        
        return None
    
    def _detect_delivery(self, current_batsmen: Tuple[Optional[BatsmanState], Optional[BatsmanState]], 
                         timestamp: float) -> Optional[Dict]:
        """
        Detect delivery events by monitoring balls faced increment.
        
        A delivery is recorded when a batsman's ball count increases by 1.
        This captures ALL deliveries: dot balls, singles, doubles, and boundaries.
        
        Args:
            current_batsmen: Tuple of current batsman states
            timestamp: Current video timestamp
            
        Returns:
            Delivery event dict if detected, None otherwise
        """
        if not current_batsmen[0]:
            return None
        
        delivery_event = None
        deliveries_detected = []  # Track all detected deliveries in this frame
        
        for batsman in current_batsmen:
            if batsman is None:
                continue
            
            player_name = batsman.name
            norm_name = normalize_player_name(player_name)
            current_balls = batsman.balls
            current_runs = batsman.runs
            
            # Get previous ball count for this player (fuzzy key lookup)
            prev_balls = None
            matched_key = None
            for stored_name in self.last_balls:
                if normalize_player_name(stored_name) == norm_name:
                    prev_balls = self.last_balls[stored_name]
                    matched_key = stored_name
                    break
            
            # First time seeing this player - establish baseline
            if prev_balls is None:
                self.last_balls[player_name] = current_balls
                self._last_runs[player_name] = current_runs
                logger.info(f"📍 Baseline set for {player_name} (normalized: {norm_name}): "
                           f"{current_runs} runs, {current_balls} balls")
                continue
            
            # Migrate key if OCR spelling changed (e.g., 'MAHESH RAM' -> 'MAHESHRAM')
            if matched_key and matched_key != player_name:
                logger.debug(f"🔀 Name variant: '{matched_key}' → '{player_name}' (same player)")
                self.last_balls[player_name] = self.last_balls.pop(matched_key)
                self._last_runs[player_name] = self._last_runs.pop(matched_key, current_runs)
            
            # Now we have baseline, detect delivery
            balls_delta = current_balls - prev_balls
            
            # Get previous runs for delta calculation
            prev_runs = self._last_runs.get(player_name, current_runs)
            runs_delta = current_runs - prev_runs
            
            # CRITICAL: Detect OCR errors - runs should NEVER decrease
            if runs_delta < 0:
                self.ocr_error_count += 1
                logger.error(f"🚨 OCR ERROR DETECTED: {player_name}'s runs decreased from {prev_runs} → {current_runs}!")
                logger.error(f"   Resetting baseline. Skipping delivery detection until state stabilizes.")
                # Reset baseline with current (hopefully correct) values
                self.last_balls[player_name] = current_balls
                self._last_runs[player_name] = current_runs
                continue
            
            # CRITICAL: If balls jumped significantly but runs didn't change, likely replay/pause
            # Threshold: > 3 balls with 0 runs is suspicious; 2-3 dots in a row is normal
            if balls_delta > 3 and runs_delta == 0:
                logger.warning(f"⚠️ {player_name}: balls jumped {balls_delta} but runs unchanged. "
                              f"Likely replay/pause. Resetting baseline.")
                self.last_balls[player_name] = current_balls
                self._last_runs[player_name] = current_runs
                continue
            
            # Delivery detected: exactly 1 ball increment
            if balls_delta == 1:
                # Calculate runs scored on this delivery
                runs_this_ball = runs_delta
                
                # CRITICAL: Sanity check for extreme run values (indicates OCR corruption)
                if runs_this_ball > 20:  # Max realistic: 6 runs + extras should be < 20
                    self.ocr_error_count += 1
                    logger.error(f"🚨 OCR ERROR: {player_name} appears to have scored {runs_this_ball} runs in one ball!")
                    logger.error(f"   Previous: {prev_runs} runs, Current: {current_runs} runs")
                    logger.error(f"   Resetting baseline. Skipping this delivery.")
                    # Reset and skip
                    self.last_balls[player_name] = current_balls
                    self._last_runs[player_name] = current_runs
                    continue
                
                # Sanity check: runs per delivery should not exceed 8 (6 + 2 extras max)
                if runs_this_ball > 8:
                    logger.warning(f"⚠️ Unusual runs delta: {player_name} scored {runs_this_ball} on one ball "
                                  f"({prev_runs} → {current_runs}). Possible OCR error or missed frames.")
                    # Cap at 8 to prevent obviously wrong values
                    runs_this_ball = min(runs_this_ball, 8)
                
                delivery_event = {
                    'type': 'DELIVERY',
                    'timestamp': timestamp,
                    'player': player_name,
                    'batsman': player_name,
                    'balls_faced': current_balls,
                    'runs_this_ball': max(0, runs_this_ball),  # Clamp negative
                    'total_runs': current_runs,
                    'confidence': 1.0 if runs_this_ball <= 6 else 0.5,  # Lower confidence for unusual values
                }
                
                # Classify the delivery
                if runs_this_ball == 0:
                    delivery_event['delivery_type'] = 'DOT'
                elif runs_this_ball in (1, 2, 3):
                    delivery_event['delivery_type'] = 'RUN'
                elif runs_this_ball == 4:
                    delivery_event['delivery_type'] = 'FOUR'
                elif runs_this_ball == 6:
                    delivery_event['delivery_type'] = 'SIX'
                else:
                    delivery_event['delivery_type'] = 'OTHER'
                
                deliveries_detected.append((player_name, delivery_event))
                
            elif balls_delta > 1:
                # Multiple balls skipped - sampling gap
                # Instead of discarding, SYNTHESIZE delivery events for the gap
                if runs_delta < 0:
                    self.ocr_error_count += 1
                    logger.error(f"🚨 OCR ERROR: {player_name} runs decreased from {prev_runs} → {current_runs} "
                                f"while balls jumped {balls_delta}. Resetting baseline.")
                elif runs_delta > balls_delta * 8:  # Unrealistic: > 8 runs per ball average
                    self.ocr_error_count += 1
                    logger.error(f"🚨 OCR ERROR: {player_name} runs jumped by {runs_delta} across {balls_delta} balls "
                                f"({prev_runs} → {current_runs}). Resetting baseline.")
                else:
                    # SYNTHESIZE missed deliveries instead of discarding
                    logger.info(f"🔧 Synthesizing {balls_delta} missed deliveries for {player_name} "
                               f"(balls: {prev_balls} → {current_balls}, runs: {prev_runs} → {current_runs})")
                    
                    # FIX: Spread synthesized timestamps across the hidden window
                    # so each delivery gets a distinct video clip in the reel
                    gap_start = getattr(self, '_scoreboard_hidden_since', -999.0)
                    if gap_start < 0 or gap_start >= timestamp:
                        # Fallback: estimate gap from ball count and sample interval
                        gap_start = timestamp - (balls_delta * self.config.sample_interval * 2)
                    gap_start = max(0, gap_start)
                    
                    for i in range(balls_delta):
                        synth_ball_num = prev_balls + i + 1
                        
                        # Interpolate timestamp within the hidden window
                        if balls_delta > 1:
                            t_frac = (i + 1) / balls_delta
                            synth_ts = gap_start + t_frac * (timestamp - gap_start)
                        else:
                            synth_ts = timestamp
                        
                        # Assign all runs to the last missed ball (best guess)
                        # Earlier missed balls are treated as dots
                        if i == balls_delta - 1:
                            synth_runs = runs_delta
                        else:
                            synth_runs = 0
                        
                        # For synthesized deliveries, don't cap runs —
                        # they represent aggregate data and stats accuracy matters
                        synth_runs = max(0, synth_runs)
                        
                        # Classify delivery type
                        if synth_runs == 0:
                            dtype = 'DOT'
                        elif synth_runs in (1, 2, 3):
                            dtype = 'RUN'
                        elif synth_runs == 4:
                            dtype = 'FOUR'
                        elif synth_runs in (5, 6, 7, 8):
                            dtype = 'SIX'
                        else:
                            dtype = 'OTHER'
                        
                        synth_event = {
                            'type': 'DELIVERY',
                            'timestamp': synth_ts,
                            'player': player_name,
                            'batsman': player_name,
                            'balls_faced': synth_ball_num,
                            'runs_this_ball': synth_runs,
                            'total_runs': prev_runs + (runs_delta if i == balls_delta - 1 else 0),
                            'confidence': 0.6,  # Lower confidence for synthesized
                            'delivery_type': dtype,
                            'synthesized': True,
                        }
                        deliveries_detected.append((player_name, synth_event))
                    
                    logger.info(f"   → Synthesized {balls_delta} deliveries ({runs_delta} runs total)")
            
            # Update tracking state
            self.last_balls[player_name] = current_balls
            self._last_runs[player_name] = current_runs
        
        # Record deliveries — may have multiple from synthesized gap recovery
        # FIX: Record ALL players' deliveries (both players can legitimately
        # have missed deliveries after a long scoreboard gap)
        unique_players = set(p for p, _ in deliveries_detected)
        if len(unique_players) > 1:
            logger.warning(f"⚠️ Multiple players had ball increments in same frame @ {timestamp:.1f}s "
                          f"(likely scoreboard reappearance after gap). Recording all.")
        
        if deliveries_detected:
            for player_name, dev_event in deliveries_detected:
                self._record_delivery(dev_event)
                synth_tag = " [SYNTH]" if dev_event.get('synthesized') else ""
                ev_ts = dev_event.get('timestamp', timestamp)
                logger.info(f"🏏 DELIVERY{synth_tag}: {player_name} ball #{dev_event['balls_faced']} "
                            f"({dev_event['delivery_type']}, +{dev_event['runs_this_ball']} runs) @ {ev_ts:.1f}s")
            
            # Update current striker to the last delivery's player
            self.current_striker = deliveries_detected[-1][0]
            delivery_event = deliveries_detected[0][1]  # Return first for compatibility
            
            # Log if delivery was for a non-target player (helps debug filtering)
            if hasattr(self.config, '_target_player') and self.config._target_player:
                for player_name, _ in deliveries_detected:
                    if not fuzzy_match_player(player_name, self.config._target_player):
                        logger.info(f"   ⚠️ Ball incremented for '{player_name}' (norm: {normalize_player_name(player_name)}), "
                                   f"but target is '{self.config._target_player}' "
                                   f"(norm: {normalize_player_name(self.config._target_player)})")
        
        return delivery_event
    
    def _record_delivery(self, event: Dict):
        """Record a delivery event to delivery-specific tracking lists.
        
        Uses normalized name matching to merge OCR variants into a single key.
        e.g., 'MAHESH RAM', 'MAHESHRAM*', 'MAHESHRAM' all map to one entry.
        """
        self.delivery_events.append(event)
        player = event.get('player', 'Unknown')
        norm_player = normalize_player_name(player)
        
        # Find existing key that matches (fuzzy)
        existing_key = None
        for stored_name in self.player_deliveries:
            if normalize_player_name(stored_name) == norm_player:
                existing_key = stored_name
                break
        
        if existing_key:
            self.player_deliveries[existing_key].append(event)
        else:
            self.player_deliveries[player] = [event]
    
    def _record_event(self, event: Dict):
        self.all_events.append(event)
        player = event.get('player', 'Unknown')
        if player not in self.player_events: self.player_events[player] = []
        self.player_events[player].append(event)
    
    def _sample_striker(self, frame: np.ndarray, timestamp: float) -> str:
        """
        Sample the current striker from the batsman ROI.
        Uses Delta Logic when both batsmen are visible, falls back to first name.
        Includes LKV fallback for transient OCR failures.
        """
        batsman_roi = self.ocr_reader.extract_batsman_name_roi(frame)
        if batsman_roi is None:
            return "Unknown"
        
        results = self.ocr_reader.reader.readtext(batsman_roi, detail=0, paragraph=True)
        raw_text = ' '.join(results) if results else ""
        current_batsmen = parse_batsmen_details_robust(raw_text)
        
        # LKV FALLBACK: If OCR failed, use last known batsmen within age threshold
        if not current_batsmen[0]:
            age = timestamp - self._lkv_timestamp
            if self._lkv_batsmen[0] and age <= self._lkv_max_age:
                current_batsmen = self._lkv_batsmen
                logger.debug(f"🔄 Striker LKV fallback at {timestamp:.1f}s (age={age:.1f}s)")
            else:
                # Scoreboard hidden — only save debug if not already in hidden state
                if not self._scoreboard_hidden:
                    self._save_failure_snapshot(frame, timestamp)
                    self._save_debug_frame(frame, timestamp, "striker_unknown_no_lkv")
                return "Unknown"
        
        # Update LKV cache on successful read
        if current_batsmen[0]:
            self._lkv_batsmen = current_batsmen
            self._lkv_timestamp = timestamp
        
        striker = "Unknown"
        
        if current_batsmen[0] and self.prev_batsmen[0]:
            # Delta Logic: compare ball counts to determine striker
            b1_new, b2_new = current_batsmen
            b1_old, b2_old = self.prev_batsmen
            
            # Striker usually has increasing balls faced
            balls_diff1 = b1_new.balls - b1_old.balls if b1_old else 0
            balls_diff2 = b2_new.balls - b2_old.balls if b2_old else 0
            
            if balls_diff1 > 0 and balls_diff1 > balls_diff2:
                striker = b1_new.name
            elif balls_diff2 > 0:
                striker = b2_new.name
            else:
                # No balls faced delta - use runs delta or memory
                runs_diff1 = b1_new.runs - b1_old.runs if b1_old else 0
                runs_diff2 = b2_new.runs - b2_old.balls if b2_old else 0
                
                if runs_diff1 > 0:
                    striker = b1_new.name
                elif runs_diff2 > 0:
                    striker = b2_new.name
                elif self.current_striker != "Unknown":
                    striker = self.current_striker
                elif current_batsmen[0]:
                    striker = current_batsmen[0].name
        
        elif current_batsmen[0]:
            # First reading - use first batsman as default
            striker = current_batsmen[0].name
        
        # Update state
        if current_batsmen[0]:
            self.prev_batsmen = current_batsmen
        if striker != "Unknown":
            self.current_striker = striker
        
        return striker
    
    def process_video(self, video_path: str, start_time: float = 0.0, 
                      max_duration: float = None, continuous_tracking: bool = True) -> List[Dict]:
        """
        Process video with optional continuous striker tracking.
        
        Args:
            video_path: Path to video file
            start_time: Start processing from this timestamp
            max_duration: Maximum duration to process
            continuous_tracking: Enable high-frequency striker sampling for full innings
        
        Returns:
            List of detected events
        """
        logger.info(f"🏏 Processing Video: {Path(video_path).name}")
        if continuous_tracking:
            logger.info(f"📍 Continuous Striker Tracking: ENABLED (interval: {self.config.sample_interval}s)")
        
        video = cv2.VideoCapture(video_path)
        fps = video.get(cv2.CAP_PROP_FPS)
        total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
        total_duration = total_frames / fps
        
        frame_count = int(start_time * fps)
        video.set(cv2.CAP_PROP_POS_FRAMES, frame_count)
        
        sample_frame_interval = int(fps * self.config.sample_interval)
        last_progress_log = start_time
        
        try:
            while True:
                ret, frame = video.read()
                if not ret: break
                
                timestamp = frame_count / fps
                if max_duration and timestamp > start_time + max_duration: break
                
                # Check frame interval for processing
                if frame_count % sample_frame_interval == 0:
                    
                    # CONTINUOUS STRIKER TRACKING (every sample)
                    if continuous_tracking:
                        striker = self._sample_striker(frame, timestamp)
                        self.striker_manager.add_reading(timestamp, striker)
                    
                    # EVENT DETECTION (uses delta logic internally)
                    self.process_frame(frame, timestamp)
                    
                    # Progress logging (every 30 seconds)
                    if timestamp - last_progress_log >= 30:
                        events_count = len(self.all_events)
                        readings_count = len(self.striker_manager.timeline)
                        logger.info(f"⏱️ {timestamp:.0f}s / {total_duration:.0f}s | "
                                   f"Events: {events_count} | Striker readings: {readings_count}")
                        last_progress_log = timestamp

                frame_count += 1
        finally:
            video.release()
        
        # Log striker tracking summary
        if continuous_tracking and self.striker_manager.timeline:
            segments = self.striker_manager.get_segments()
            total_readings = len(self.striker_manager.timeline)
            logger.info(f"📊 Striker Tracking Complete: {total_readings} readings → "
                       f"{sum(len(s) for s in segments.values())} segments for "
                       f"{len(segments)} players")
            
        return self.all_events

    def generate_all_player_reels(self, video_path: str, output_dir: str = None, 
                                   min_boundaries: int = 1) -> Dict[str, str]:
        """
        Generate per-player innings highlight reels.
        
        Args:
            video_path: Path to source video
            output_dir: Output directory for reels
            min_boundaries: Minimum boundaries required to generate a reel (default: 1)
        
        Returns:
            Dict mapping player names to reel file paths
        """
        reels = {}
        output_dir = output_dir or self.config.player_reels_dir
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        video_stem = Path(video_path).stem
        
        for player, events in self.player_events.items():
            # Skip unknown players
            if player == 'Unknown':
                logger.info(f"   ⏭️  Skipping 'Unknown' player ({len(events)} events)")
                continue
            
            # Count boundaries for threshold check
            boundaries = len([e for e in events if e.get('type') in ('FOUR', 'SIX')])
            
            # Skip if below minimum threshold
            if boundaries < min_boundaries:
                logger.info(f"   ⏭️  Skipping {player}: {boundaries} boundaries (min: {min_boundaries})")
                continue
            
            # Sort events chronologically by timestamp
            sorted_events = sorted(events, key=lambda e: e.get('timestamp', 0))
            
            logger.info(f"   🎬 Generating reel for {player}: {len(sorted_events)} events")
            
            # Extract clips for this player
            clips = extract_clips(video_path=video_path, events=sorted_events, output_dir=output_dir)
            
            if clips:
                # Sanitize player name for filename (remove spaces, special chars)
                safe_name = re.sub(r'[^\w]', '', player.replace(' ', '_'))
                reel_path = str(Path(output_dir) / f"{video_stem}_{safe_name}_Innings.mp4")
                
                result = create_supercut(clips, reel_path)
                if result:
                    reels[player] = reel_path
                    logger.info(f"   ✅ {player} reel: {reel_path}")
        
        return reels
    
    def get_player_stats(self) -> Dict:
        """Get aggregated player statistics."""
        stats = {}
        for player, events in self.player_events.items():
            if player == 'Unknown':
                continue
            
            # Sort events chronologically
            sorted_events = sorted(events, key=lambda e: e.get('timestamp', 0))
            
            fours = len([e for e in events if e.get('type') == 'FOUR'])
            sixes = len([e for e in events if e.get('type') == 'SIX'])
            wickets = len([e for e in events if e.get('type') == 'WICKET'])
            
            # Calculate timestamps for first and last boundary
            boundary_events = [e for e in sorted_events if e.get('type') in ('FOUR', 'SIX')]
            first_boundary = boundary_events[0]['timestamp'] if boundary_events else None
            last_boundary = boundary_events[-1]['timestamp'] if boundary_events else None
            
            stats[player] = {
                'total_highlights': len(events),
                'fours': fours,
                'sixes': sixes,
                'wickets': wickets,
                'boundary_runs': fours * 4 + sixes * 6,
                'first_boundary_ts': first_boundary,
                'last_boundary_ts': last_boundary
            }
        
        return stats
    
    def generate_summary_report(self, video_path: str, reels: Dict[str, str], 
                                 output_dir: str = None) -> str:
        """
        Generate a summary report (CSV) listing player stats and reel paths.
        
        Args:
            video_path: Source video path
            reels: Dict mapping player names to reel paths
            output_dir: Output directory for report
        
        Returns:
            Path to generated report file
        """
        import csv
        from datetime import timedelta
        
        output_dir = output_dir or self.config.player_reels_dir
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        video_stem = Path(video_path).stem
        report_path = Path(output_dir) / f"{video_stem}_summary.csv"
        
        stats = self.get_player_stats()
        
        # Prepare report data
        report_data = []
        for player, pstats in stats.items():
            reel_path = reels.get(player, 'N/A')
            
            # Format timestamps as MM:SS
            def fmt_ts(ts):
                if ts is None:
                    return 'N/A'
                return str(timedelta(seconds=int(ts)))[2:]  # Strip hours
            
            report_data.append({
                'Player': player,
                'Fours': pstats['fours'],
                'Sixes': pstats['sixes'],
                'Total Boundaries': pstats['fours'] + pstats['sixes'],
                'Boundary Runs': pstats['boundary_runs'],
                'First Boundary': fmt_ts(pstats['first_boundary_ts']),
                'Last Boundary': fmt_ts(pstats['last_boundary_ts']),
                'Reel Path': reel_path
            })
        
        # Sort by boundary runs (descending)
        report_data.sort(key=lambda x: x['Boundary Runs'], reverse=True)
        
        # Write CSV
        with open(report_path, 'w', newline='', encoding='utf-8') as f:
            if report_data:
                writer = csv.DictWriter(f, fieldnames=report_data[0].keys())
                writer.writeheader()
                writer.writerows(report_data)
        
        # Also print to console
        logger.info("\n" + "=" * 70)
        logger.info("📊 INNINGS HIGHLIGHT SUMMARY")
        logger.info("=" * 70)
        logger.info(f"{'Player':<20} {'4s':>4} {'6s':>4} {'Runs':>6} {'First':>8} {'Last':>8}")
        logger.info("-" * 70)
        
        for row in report_data:
            logger.info(f"{row['Player']:<20} {row['Fours']:>4} {row['Sixes']:>4} "
                       f"{row['Boundary Runs']:>6} {row['First Boundary']:>8} {row['Last Boundary']:>8}")
        
        logger.info("-" * 70)
        logger.info(f"📄 Report saved: {report_path}")
        
        return str(report_path)
    
    def generate_full_innings(self, video_path: str, output_dir: str = None,
                               min_duration: float = 10.0) -> Dict[str, str]:
        """
        Generate complete innings videos for each player using continuous striker tracking data.
        
        This creates one continuous video file for each player containing all segments
        where they were on strike, stitched together chronologically.
        
        Args:
            video_path: Path to source video
            output_dir: Output directory for innings videos
            min_duration: Minimum total strike duration (seconds) to generate video
        
        Returns:
            Dict mapping player names to innings video paths
        """
        from datetime import timedelta
        
        output_dir = output_dir or self.config.innings_dir
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        video_stem = Path(video_path).stem
        segments = self.striker_manager.get_segments()
        
        if not segments:
            logger.warning("⚠️ No striker segments found. Run process_video with continuous_tracking=True first.")
            return {}
        
        innings_videos = {}
        
        # Get video duration for segment clamping
        video = cv2.VideoCapture(video_path)
        video_duration = video.get(cv2.CAP_PROP_FRAME_COUNT) / video.get(cv2.CAP_PROP_FPS)
        video.release()
        
        logger.info(f"\n🏏 Generating Full Innings Videos...")
        logger.info(f"   Source: {video_path} ({video_duration:.1f}s)")
        
        for player, player_segments in segments.items():
            total_duration = sum(seg.duration for seg in player_segments)
            
            # Skip if below minimum duration
            if total_duration < min_duration:
                logger.info(f"   ⏭️  Skipping {player}: {total_duration:.1f}s (min: {min_duration}s)")
                continue
            
            logger.info(f"   🎬 {player}: {len(player_segments)} segments, "
                       f"{total_duration:.1f}s total time on strike")
            
            # Sanitize player name for filename
            safe_name = re.sub(r'[^\w]', '', player.replace(' ', '_'))
            output_path = str(Path(output_dir) / f"{video_stem}_{safe_name}_Full_Innings.mp4")
            
            # Use FFmpeg concat demuxer for efficient stitching
            result = self._ffmpeg_extract_and_concat(
                video_path=video_path,
                segments=[(seg.start_time, min(seg.end_time, video_duration)) for seg in player_segments],
                output_path=output_path,
                player_name=player
            )
            
            if result:
                # Get output file size
                file_size = Path(output_path).stat().st_size / (1024 * 1024)
                innings_videos[player] = output_path
                logger.info(f"   ✅ {player}: {output_path} ({file_size:.1f} MB)")
        
        return innings_videos
    
    def generate_ball_by_ball_innings(self, video_path: str, player: str = None, 
                                       output_dir: str = None, 
                                       min_deliveries: int = 1) -> Dict[str, str]:
        """
        Generate ball-by-ball innings compilation for specified player(s).
        
        Creates a video containing clips of every delivery faced by the batsman,
        using configurable padding (tighter for deliveries vs boundaries).
        
        Args:
            video_path: Path to source video
            player: Specific player name, or None for all players
            output_dir: Output directory for innings videos
            min_deliveries: Minimum deliveries required to generate video
        
        Returns:
            Dict mapping player names to innings video paths
        """
        from datetime import timedelta
        
        output_dir = output_dir or self.config.innings_dir
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        video_stem = Path(video_path).stem
        
        if not self.player_deliveries:
            logger.warning("⚠️ No deliveries recorded. Run process_video with track_deliveries=True first.")
            return {}
        
        # Filter players (fuzzy matching for target player)
        players_to_process = {}
        if player:
            # Fuzzy lookup: find any key that matches the target
            matched_key = None
            for stored_name in self.player_deliveries:
                if fuzzy_match_player(stored_name, player):
                    matched_key = stored_name
                    break
            
            if matched_key:
                players_to_process[matched_key] = self.player_deliveries[matched_key]
                if matched_key != player:
                    logger.info(f"🔀 Fuzzy match: '{player}' → '{matched_key}' "
                               f"({len(self.player_deliveries[matched_key])} deliveries)")
            else:
                logger.warning(f"⚠️ No deliveries found for player: {player}")
                logger.info(f"   Available players: {list(self.player_deliveries.keys())}")
                logger.info(f"   Normalized target: {normalize_player_name(player)}")
                for k in self.player_deliveries:
                    logger.info(f"   Normalized '{k}': {normalize_player_name(k)}")
                return {}
        else:
            players_to_process = self.player_deliveries
        
        innings_videos = {}
        
        # Get video duration for clamping
        video = cv2.VideoCapture(video_path)
        video_duration = video.get(cv2.CAP_PROP_FRAME_COUNT) / video.get(cv2.CAP_PROP_FPS)
        video.release()
        
        logger.info(f"\n🏏 Generating Ball-by-Ball Innings Compilations...")
        logger.info(f"   Source: {video_path} ({video_duration:.1f}s)")
        
        for player_name, deliveries in players_to_process.items():
            if player_name == 'Unknown':
                continue
            
            # Skip if below minimum deliveries
            if len(deliveries) < min_deliveries:
                logger.info(f"   ⏭️  Skipping {player_name}: {len(deliveries)} deliveries (min: {min_deliveries})")
                continue
            
            # Sort deliveries chronologically
            sorted_deliveries = sorted(deliveries, key=lambda d: d.get('timestamp', 0))
            
            # Count delivery types
            dots = len([d for d in sorted_deliveries if d.get('delivery_type') == 'DOT'])
            runs = len([d for d in sorted_deliveries if d.get('delivery_type') == 'RUN'])
            fours = len([d for d in sorted_deliveries if d.get('delivery_type') == 'FOUR'])
            sixes = len([d for d in sorted_deliveries if d.get('delivery_type') == 'SIX'])
            total_runs = sum(d.get('runs_this_ball', 0) for d in sorted_deliveries)
            
            logger.info(f"   🎬 {player_name}: {len(sorted_deliveries)} deliveries "
                       f"(Dots: {dots}, Runs: {runs}, 4s: {fours}, 6s: {sixes}, Total: {total_runs} runs)")
            
            # Build segments with appropriate padding for each delivery type
            # For synthesized deliveries (happened off-screen during scoreboard gap),
            # group them into a single clip at the reappearance point to avoid
            # showing footage of the other batsman from during the gap.
            segments = []
            synth_group = []  # Buffer for consecutive synthesized deliveries
            
            def flush_synth_group():
                """Emit one clip for a group of synthesized deliveries at the latest timestamp."""
                if not synth_group:
                    return
                # Use the latest timestamp (reappearance point) for the clip
                latest_ts = max(d.get('timestamp', 0) for d in synth_group)
                pre_pad, post_pad = self.config.clip_padding.get_padding('DELIVERY')
                start = max(0, latest_ts - pre_pad)
                end = min(video_duration, latest_ts + post_pad)
                segments.append((start, end))
                logger.debug(f"      📦 Grouped {len(synth_group)} synthesized deliveries → 1 clip @ {latest_ts:.1f}s")
                synth_group.clear()
            
            for delivery in sorted_deliveries:
                if delivery.get('synthesized', False):
                    # Split synth groups when there's a large timestamp gap
                    # (indicates deliveries from different scoreboard gaps)
                    if synth_group:
                        last_ts = synth_group[-1].get('timestamp', 0)
                        this_ts = delivery.get('timestamp', 0)
                        if this_ts - last_ts > 30:  # Different scoreboard gap
                            flush_synth_group()
                    synth_group.append(delivery)
                    continue
                
                # Flush any pending synthesized group before a real delivery
                flush_synth_group()
                
                ts = delivery.get('timestamp', 0)
                event_type = delivery.get('delivery_type', 'DELIVERY')
                
                # Get appropriate padding based on delivery type
                if event_type in ('FOUR', 'SIX'):
                    pre_pad, post_pad = self.config.clip_padding.get_padding('FOUR')
                else:
                    pre_pad, post_pad = self.config.clip_padding.get_padding('DELIVERY')
                
                start = max(0, ts - pre_pad)
                end = min(video_duration, ts + post_pad)
                segments.append((start, end))
            
            # Flush any remaining synthesized deliveries at the end
            flush_synth_group()
            
            # Merge overlapping segments conservatively to avoid including other players
            # For ball-by-ball videos, only merge if segments truly overlap (not just adjacent)
            merged_segments = self._merge_overlapping_segments(segments, merge_tolerance=0.1)
            
            logger.info(f"      → {len(segments)} clips → {len(merged_segments)} segments after merging")
            
            # Debug: Show first and last few deliveries
            if len(sorted_deliveries) > 0:
                logger.debug(f"      First delivery: {sorted_deliveries[0].get('timestamp'):.1f}s - "
                           f"{sorted_deliveries[0].get('delivery_type')}")
                logger.debug(f"      Last delivery: {sorted_deliveries[-1].get('timestamp'):.1f}s - "
                           f"{sorted_deliveries[-1].get('delivery_type')}")
            
            # Generate output path
            safe_name = re.sub(r'[^\w]', '', player_name.replace(' ', '_'))
            output_path = str(Path(output_dir) / f"{video_stem}_{safe_name}_BallByBall.mp4")
            
            # Use FFmpeg to stitch
            result = self._ffmpeg_extract_and_concat(
                video_path=video_path,
                segments=merged_segments,
                output_path=output_path,
                player_name=player_name
            )
            
            if result:
                file_size = Path(output_path).stat().st_size / (1024 * 1024)
                innings_videos[player_name] = output_path
                logger.info(f"   ✅ {player_name}: {output_path} ({file_size:.1f} MB)")
        
        return innings_videos
    
    def generate_bowler_spell_reel(self, video_path: str, output_dir: str = None) -> Optional[str]:
        """
        Generate a supercut reel of every delivery bowled by the target bowler.
        
        Uses bowler_delivery_events collected during process_video to extract
        clips with bowler-specific padding (8s before, 5s after each delivery).
        
        Args:
            video_path: Path to source video
            output_dir: Output directory for the reel
        
        Returns:
            Path to generated reel file, or None if no deliveries found
        """
        if not self.bowler_delivery_events:
            logger.warning(f"⚠️ No deliveries found for target bowler: {self.target_bowler}")
            return None
        
        output_dir = output_dir or self.config.player_reels_dir
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        video_stem = Path(video_path).stem
        
        # Get video duration for clamping
        video = cv2.VideoCapture(video_path)
        video_duration = video.get(cv2.CAP_PROP_FRAME_COUNT) / video.get(cv2.CAP_PROP_FPS)
        video.release()
        
        # Sort deliveries chronologically
        sorted_deliveries = sorted(self.bowler_delivery_events, key=lambda d: d.get('timestamp', 0))
        
        logger.info(f"\n🎳 Generating Bowler Spell Reel for {self.target_bowler}...")
        logger.info(f"   {len(sorted_deliveries)} deliveries found")
        logger.info(f"   Source: {video_path} ({video_duration:.1f}s)")
        
        # Use bowler-specific padding from ClipPadding
        pre_pad, post_pad = self.config.clip_padding.get_padding('BOWLER_DELIVERY')
        
        # Build segments with padding
        segments = []
        for delivery in sorted_deliveries:
            ts = delivery.get('timestamp', 0)
            start = max(0, ts - pre_pad)
            end = min(video_duration, ts + post_pad)
            segments.append((start, end))
        
        # Merge overlapping segments
        merged_segments = self._merge_overlapping_segments(segments, merge_tolerance=0.5)
        
        total_duration = sum(e - s for s, e in merged_segments)
        logger.info(f"   → {len(segments)} clips → {len(merged_segments)} segments after merging")
        logger.info(f"   → Estimated reel duration: {total_duration:.1f}s")
        
        # Generate output path
        safe_name = re.sub(r'[^\w]', '', (self.target_bowler or 'Unknown').replace(' ', '_'))
        output_path = str(Path(output_dir) / f"{video_stem}_{safe_name}_BowlerSpell.mp4")
        
        # Use FFmpeg to stitch
        result = self._ffmpeg_extract_and_concat(
            video_path=video_path,
            segments=merged_segments,
            output_path=output_path,
            player_name=self.target_bowler or 'Unknown'
        )
        
        if result:
            file_size = Path(output_path).stat().st_size / (1024 * 1024)
            logger.info(f"   ✅ Bowler spell reel: {output_path} ({file_size:.1f} MB)")
            return output_path
        else:
            logger.error(f"   ❌ Failed to create bowler spell reel")
            return None
    
    def _merge_overlapping_segments(self, segments: List[Tuple[float, float]], 
                                    merge_tolerance: float = 1.0) -> List[Tuple[float, float]]:
        """
        Merge overlapping or adjacent time segments to avoid duplicate footage.
        
        Args:
            segments: List of (start_time, end_time) tuples
            merge_tolerance: Maximum gap (seconds) between segments to merge.
                           Use 0.1 for strict overlap-only merging (ball-by-ball videos)
                           Use 1.0+ for aggressive merging (full innings videos)
            
        Returns:
            List of merged non-overlapping segments
        """
        if not segments:
            return []
        
        # Sort by start time
        sorted_segs = sorted(segments, key=lambda x: x[0])
        
        merged = [list(sorted_segs[0])]
        
        for start, end in sorted_segs[1:]:
            last = merged[-1]
            
            # Only merge if segments truly overlap or are within tolerance
            if start <= last[1] + merge_tolerance:
                last[1] = max(last[1], end)
            else:
                merged.append([start, end])
        
        return [(s, e) for s, e in merged]
    
    def get_delivery_stats(self, player: str = None) -> Dict[str, Dict]:
        """
        Get delivery statistics for player(s).
        
        Args:
            player: Specific player name, or None for all players
            
        Returns:
            Dict with delivery statistics per player
        """
        stats = {}
        
        if player:
            # Fuzzy lookup
            matched_key = None
            for stored_name in self.player_deliveries:
                if fuzzy_match_player(stored_name, player):
                    matched_key = stored_name
                    break
            players = {matched_key: self.player_deliveries[matched_key]} if matched_key else {}
        else:
            players = self.player_deliveries
        
        for player_name, deliveries in players.items():
            if player_name == 'Unknown' or not deliveries:
                continue
            
            # Sort for timestamp range
            sorted_deliveries = sorted(deliveries, key=lambda d: d.get('timestamp', 0))
            
            dots = len([d for d in deliveries if d.get('delivery_type') == 'DOT'])
            runs_1_3 = len([d for d in deliveries if d.get('delivery_type') == 'RUN'])
            fours = len([d for d in deliveries if d.get('delivery_type') == 'FOUR'])
            sixes = len([d for d in deliveries if d.get('delivery_type') == 'SIX'])
            total_runs = sum(d.get('runs_this_ball', 0) for d in deliveries)
            
            stats[player_name] = {
                'total_deliveries': len(deliveries),
                'dots': dots,
                'runs_1_3': runs_1_3,
                'fours': fours,
                'sixes': sixes,
                'total_runs': total_runs,
                'strike_rate': (total_runs / len(deliveries) * 100) if deliveries else 0,
                'first_ball_ts': sorted_deliveries[0].get('timestamp') if sorted_deliveries else None,
                'last_ball_ts': sorted_deliveries[-1].get('timestamp') if sorted_deliveries else None,
            }
        
        return stats
    
    def _ffmpeg_extract_and_concat(self, video_path: str, segments: List[Tuple[float, float]],
                                    output_path: str, player_name: str = "") -> bool:
        """
        Use FFmpeg to extract and concatenate segments efficiently (zero-copy where possible).
        
        Args:
            video_path: Path to source video
            segments: List of (start_time, end_time) tuples
            output_path: Path for output video
            player_name: Player name for logging
        
        Returns:
            True if successful, False otherwise
        """
        import tempfile
        import os
        
        if not segments:
            return False
        
        temp_dir = Path(output_path).parent / ".temp_segments"
        temp_dir.mkdir(exist_ok=True)
        
        segment_files = []
        
        try:
            # Step 1: Extract each segment using stream copy (zero-copy, fast)
            for i, (start, end) in enumerate(segments):
                duration = end - start
                segment_path = str(temp_dir / f"seg_{i:04d}.mp4")
                segment_files.append(segment_path)
                
                cmd = [
                    'ffmpeg', '-y',
                    '-ss', str(start),
                    '-i', video_path,
                    '-t', str(duration),
                    '-c', 'copy',  # Stream copy (no re-encoding)
                    '-avoid_negative_ts', 'make_zero',
                    segment_path
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode != 0:
                    logger.error(f"FFmpeg segment extraction failed: {result.stderr[:500]}")
                    return False
            
            # Step 2: Create concat list file with proper escaping for Windows
            concat_list_path = str(temp_dir / "concat_list.txt")
            with open(concat_list_path, 'w', encoding='utf-8') as f:
                for seg_path in segment_files:
                    # Use absolute path and escape for FFmpeg
                    abs_path = str(Path(seg_path).resolve())
                    # FFmpeg requires forward slashes and single quotes for paths with special chars
                    escaped_path = abs_path.replace('\\', '/').replace("'", "'\\''")
                    f.write(f"file '{escaped_path}'\n")
            
            # Step 3: Concatenate segments using concat demuxer
            concat_cmd = [
                'ffmpeg', '-y',
                '-f', 'concat',
                '-safe', '0',
                '-i', concat_list_path,
                '-c', 'copy',
                output_path
            ]
            
            result = subprocess.run(concat_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                # Try re-encoding as fallback
                logger.warning("Stream copy concat failed, trying re-encode fallback...")
                concat_cmd_reencode = [
                    'ffmpeg', '-y',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', concat_list_path,
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                    '-c:a', 'aac', '-b:a', '128k',
                    output_path
                ]
                result = subprocess.run(concat_cmd_reencode, capture_output=True, text=True)
                if result.returncode != 0:
                    logger.error(f"FFmpeg concatenation failed: {result.stderr[:500]}")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error during FFmpeg processing: {e}")
            return False
            
        finally:
            # Cleanup temp files
            for seg_path in segment_files:
                try:
                    Path(seg_path).unlink(missing_ok=True)
                except:
                    pass
            try:
                (temp_dir / "concat_list.txt").unlink(missing_ok=True)
                temp_dir.rmdir()
            except:
                pass
    
    def get_striker_summary(self) -> Dict[str, Dict]:
        """
        Get striker tracking summary for all players.
        
        Returns:
            Dict with player summaries including segment count and total time on strike
        """
        from datetime import timedelta
        
        summary = self.striker_manager.get_summary()
        
        # Format for display
        formatted = {}
        for player, data in summary.items():
            total_secs = data['total_time_on_strike']
            formatted[player] = {
                'segment_count': data['segment_count'],
                'total_time_on_strike': total_secs,
                'time_formatted': str(timedelta(seconds=int(total_secs))),
                'segments': data['segments']
            }
        
        return formatted

# --- CLI ---
def parse_args():
    parser = argparse.ArgumentParser(description='Cricket Highlight Generator with Full Innings Segmentation')
    parser.add_argument('--video-path', required=True, help='Path to video file')
    parser.add_argument('--config', help='Path to ROI config JSON')
    parser.add_argument('--mode', default='full', choices=['full', 'ocr', 'cv-only'],
                        help='Detection mode (default: full)')
    
    # Reel generation options
    parser.add_argument('--all-player-reels', action='store_true',
                        help='Generate individual boundary highlight reels for all players')
    parser.add_argument('--player', help='Generate reel for specific player only')
    parser.add_argument('--min-boundaries', type=int, default=1,
                        help='Minimum boundaries required to generate a reel (default: 1)')
    
    # Full innings options
    parser.add_argument('--full-innings', action='store_true',
                        help='Generate full innings videos (all time on strike)')
    parser.add_argument('--min-strike-time', type=float, default=10.0,
                        help='Minimum total strike time (seconds) to generate innings video (default: 10)')
    parser.add_argument('--gap-threshold', type=float, default=5.0,
                        help='Maximum gap (seconds) to merge across for striker tracking (default: 5)')
    
    # Ball-by-ball tracking options
    parser.add_argument('--ball-by-ball', action='store_true',
                        help='Track every delivery (not just boundaries) for complete innings compilation')
    parser.add_argument('--target-player', type=str, default=None,
                        help='Generate ball-by-ball innings for specific player only')
    parser.add_argument('--min-deliveries', type=int, default=1,
                        help='Minimum deliveries required to generate ball-by-ball video (default: 1)')
    
    # Bowler spell tracking options
    parser.add_argument('--bowler-spell', action='store_true',
                        help='Generate highlight reel of every delivery bowled by --target-bowler')
    parser.add_argument('--target-bowler', type=str, default=None,
                        help='Target bowler name for spell reel (e.g., "BOULT", "BUMRAH")')
    
    # Bowler ROI overrides
    parser.add_argument('--bowler-roi-x', type=int, help='X coordinate of bowler name region')
    parser.add_argument('--bowler-roi-y', type=int, help='Y coordinate of bowler name region')
    parser.add_argument('--bowler-roi-width', type=int, help='Width of bowler name region')
    parser.add_argument('--bowler-roi-height', type=int, help='Height of bowler name region')
    
    # General options
    parser.add_argument('--start-time', type=float, default=0.0,
                        help='Start processing from this timestamp')
    parser.add_argument('--max-duration', type=float, default=None,
                        help='Maximum duration to process (seconds)')
    parser.add_argument('--sample-interval', type=float, default=1.0,
                        help='Frame sampling interval in seconds (default: 1.0, increase to 2-3 for faster processing)')
    parser.add_argument('--gpu', action='store_true', help='Enable GPU acceleration')
    parser.add_argument('--report', action='store_true', 
                        help='Generate CSV summary report')
    parser.add_argument('--quiet', action='store_true',
                        help='Reduce logging verbosity (suppress per-frame OCR logs)')
    parser.add_argument('--debug-ocr', action='store_true',
                        help='Save failed OCR ROI images to storage/debug_ocr for inspection')
    return parser.parse_args()

def main():
    args = parse_args()
    
    # Set logging level based on quiet flag
    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)
    
    sb_config = ScoreboardConfig(args.config)
    sb_config.use_gpu = args.gpu
    
    # Optimize mode selection: use OCR-only for ball-by-ball or bowler-spell tracking (faster)
    mode = args.mode
    if (args.ball_by_ball or args.bowler_spell) and mode == 'full':
        mode = 'ocr'  # Skip expensive CV operations for ball-by-ball / bowler spell
        if not args.quiet:
            logger.info("💡 OCR-only mode: Skipping CV operations for faster processing")
    
    config = IntegratedConfig(
        scoreboard_config=sb_config, 
        mode=mode, 
        use_gpu=args.gpu,
        striker_gap_threshold=args.gap_threshold,
        sample_interval=args.sample_interval,  # Use custom sample interval
        track_deliveries=args.ball_by_ball,  # Enable ball-by-ball tracking if requested
        debug_ocr_dir="storage/debug_ocr" if args.debug_ocr else None  # Debug OCR failures if enabled
    )
    # Stash target player on config for failure-reason logging inside _detect_delivery
    config._target_player = args.target_player
    detector = IntegratedDetector(config)
    
    # Apply bowler ROI overrides if provided
    if args.bowler_roi_x is not None:
        sb_config.bowler_roi_x = args.bowler_roi_x
    if args.bowler_roi_y is not None:
        sb_config.bowler_roi_y = args.bowler_roi_y
    if args.bowler_roi_width is not None:
        sb_config.bowler_roi_width = args.bowler_roi_width
    if args.bowler_roi_height is not None:
        sb_config.bowler_roi_height = args.bowler_roi_height
    
    # Set target bowler on detector if --bowler-spell or --target-bowler provided
    if args.target_bowler:
        detector.target_bowler = args.target_bowler.upper()
        logger.info(f"🎳 Target bowler: {detector.target_bowler}")
        logger.info(f"🎳 Effective Bowler ROI: ({sb_config.bowler_roi_x}, {sb_config.bowler_roi_y}) "
                    f"{sb_config.bowler_roi_width}x{sb_config.bowler_roi_height}")
    elif args.bowler_spell:
        logger.error("❌ --bowler-spell requires --target-bowler to be specified")
        return
    
    # Bowler-spell mode: no need for continuous batsman striker tracking
    # Overs/bowler detection runs independently via process_frame Phase 2.5
    # Use 3s default interval for bowler-spell (overs change every ~20s, 1s wastes CPU)
    if args.bowler_spell and not (args.full_innings or args.ball_by_ball or args.all_player_reels):
        if args.sample_interval == 1.0:
            config.sample_interval = 3.0
            logger.info("🎳 Bowler-spell mode: using 3s sample interval (override with --sample-interval)")

    # Process video with continuous tracking if full innings or ball-by-ball requested
    # Bowler-spell alone does NOT need continuous striker tracking
    continuous_tracking = args.full_innings or args.all_player_reels or args.ball_by_ball
    detector.process_video(
        args.video_path, 
        start_time=args.start_time,
        max_duration=args.max_duration,
        continuous_tracking=continuous_tracking
    )
    
    # Display event stats
    stats = detector.get_player_stats()
    if stats:
        logger.info("\n📊 Boundary Detection Summary:")
        for player, pstats in stats.items():
            logger.info(f"   {player}: {pstats['fours']} fours, {pstats['sixes']} sixes "
                       f"({pstats['boundary_runs']} runs)")
    
    # Display striker tracking summary
    if continuous_tracking:
        striker_summary = detector.get_striker_summary()
        if striker_summary:
            logger.info("\n⏱️ Striker Tracking Summary:")
            for player, data in striker_summary.items():
                logger.info(f"   {player}: {data['segment_count']} segments, "
                           f"{data['time_formatted']} total on strike")
    
    # Display ball-by-ball delivery stats if enabled
    if args.ball_by_ball:
        delivery_stats = detector.get_delivery_stats()
        if delivery_stats:
            logger.info("\n🏏 Ball-by-Ball Delivery Summary:")
            for player, dstats in delivery_stats.items():
                logger.info(f"   {player}: {dstats['total_deliveries']} balls faced, "
                           f"{dstats['total_runs']} runs (SR: {dstats['strike_rate']:.1f})")
                logger.info(f"      → Dots: {dstats['dots']}, Singles/Doubles/Triples: {dstats['runs_1_3']}, "
                           f"4s: {dstats['fours']}, 6s: {dstats['sixes']}")
    
    reels = {}
    innings_videos = {}
    ball_by_ball_videos = {}
    bowler_spell_reel = None
    
    # Generate boundary highlight reels
    if args.all_player_reels:
        logger.info("\n🎬 Generating Per-Player Boundary Reels...")
        reels = detector.generate_all_player_reels(
            args.video_path, 
            min_boundaries=args.min_boundaries
        )
    elif args.player:
        # Single player reel
        events = detector.player_events.get(args.player, [])
        if events:
            sorted_events = sorted(events, key=lambda e: e.get('timestamp', 0))
            clips = extract_clips(args.video_path, sorted_events, detector.config.player_reels_dir)
            if clips:
                safe_name = re.sub(r'[^\w]', '', args.player.replace(' ', '_'))
                reel_path = str(Path(detector.config.player_reels_dir) / 
                              f"{Path(args.video_path).stem}_{safe_name}_Innings.mp4")
                if create_supercut(clips, reel_path):
                    reels[args.player] = reel_path
                    logger.info(f"✅ {args.player} reel: {reel_path}")
        else:
            logger.warning(f"No events found for player: {args.player}")
    
    # Generate full innings videos
    if args.full_innings:
        innings_videos = detector.generate_full_innings(
            args.video_path,
            min_duration=args.min_strike_time
        )
    
    # Generate ball-by-ball innings videos
    if args.ball_by_ball:
        ball_by_ball_videos = detector.generate_ball_by_ball_innings(
            args.video_path,
            player=args.target_player,
            min_deliveries=args.min_deliveries
        )
    
    # Generate bowler spell reel
    if args.bowler_spell and args.target_bowler:
        bowler_spell_reel = detector.generate_bowler_spell_reel(args.video_path)
    
    # Display bowler spell summary
    if args.target_bowler:
        n_deliveries = len(detector.bowler_delivery_events)
        logger.info(f"\n🎳 Bowler Spell Summary for {detector.target_bowler}:")
        logger.info(f"   Deliveries matched: {n_deliveries}")
        if n_deliveries > 0:
            first_ts = detector.bowler_delivery_events[0].get('timestamp', 0)
            last_ts = detector.bowler_delivery_events[-1].get('timestamp', 0)
            logger.info(f"   First delivery: {first_ts:.1f}s")
            logger.info(f"   Last delivery: {last_ts:.1f}s")
    
    # Generate summary report
    if args.report or args.all_player_reels:
        detector.generate_summary_report(args.video_path, reels)
    
    # Print full innings summary
    if innings_videos:
        logger.info("\n" + "=" * 70)
        logger.info("🏏 FULL INNINGS VIDEOS")
        logger.info("=" * 70)
        for player, path in innings_videos.items():
            file_size = Path(path).stat().st_size / (1024 * 1024)
            logger.info(f"   {player}: {path} ({file_size:.1f} MB)")
    
    # Print ball-by-ball innings summary
    if ball_by_ball_videos:
        logger.info("\n" + "=" * 70)
        logger.info("🏏 BALL-BY-BALL INNINGS VIDEOS")
        logger.info("=" * 70)
        for player, path in ball_by_ball_videos.items():
            file_size = Path(path).stat().st_size / (1024 * 1024)
            logger.info(f"   {player}: {path} ({file_size:.1f} MB)")
        
        # Check for missed deliveries and warn
        delivery_stats = detector.get_delivery_stats(args.target_player)
        if delivery_stats and args.sample_interval > 1.0:
            logger.info("\n⚠️  Note: Sample interval was {:.1f}s. Some deliveries may have been missed.".format(args.sample_interval))
            logger.info("   For complete coverage, use --sample-interval 1.0 (slower but captures every delivery)")
        
        # Report OCR errors if any occurred
        if detector.ocr_error_count > 0:
            logger.warning(f"\n⚠️  Detected {detector.ocr_error_count} OCR corruption(s) during processing.")
            logger.warning("   These occur when scores/balls are misread (e.g., '15' read as '155').")
            logger.warning("   The system automatically resets and recovers, but some deliveries may be skipped.")
            logger.warning("   💡 Tip: Use --debug-ocr to save failed ROI images for ROI adjustment.")
    
    # Print bowler spell reel summary
    if bowler_spell_reel:
        logger.info("\n" + "=" * 70)
        logger.info("🎳 BOWLER SPELL REEL")
        logger.info("=" * 70)
        file_size = Path(bowler_spell_reel).stat().st_size / (1024 * 1024)
        logger.info(f"   {detector.target_bowler}: {bowler_spell_reel} ({file_size:.1f} MB)")
        logger.info(f"   Deliveries: {len(detector.bowler_delivery_events)}")
    
    logger.info("\n" + "=" * 70)
    logger.info("🏏 PROCESSING COMPLETE")
    logger.info("=" * 70)

if __name__ == '__main__':
    main()
