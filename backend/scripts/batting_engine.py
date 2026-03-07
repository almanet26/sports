"""
Batting Biomechanics Analysis Engine
=====================================
Uses MediaPipe pose estimation to analyze batting technique.

Core Metrics (body mechanics only — MediaPipe cannot track the bat):
  A. Head Alignment   — head position relative to base (feet)
  B. Stride Length     — ankle-to-ankle distance tracking
  C. Hand Path         — wrist height trajectory (backlift → contact → follow-through)

Phase Detection State Machine:
  Stance → Trigger/Stride → Downswing → Impact → Follow-Through
"""

import cv2
import numpy as np
import os
import re
import subprocess
import time
import math
import urllib.parse
import pandas as pd
from google import genai
from dotenv import load_dotenv
from PIL import Image
from fpdf import FPDF
import io
import logging

logger = logging.getLogger(__name__)

# ==========================================
# MEDIAPIPE IMPORTS (same fallback as bowling)
# ==========================================
mp_pose_module = None
mp_drawing_module = None
POSE_CONNECTIONS = None
_import_strategy = None

# Strategy 1: mediapipe.solutions (v0.8-0.9)
try:
    import mediapipe.solutions.pose as _mp_pose
    import mediapipe.solutions.drawing_utils as _mp_draw
    from mediapipe.solutions.pose import POSE_CONNECTIONS as _POSE_CONN
    mp_pose_module = _mp_pose
    mp_drawing_module = _mp_draw
    POSE_CONNECTIONS = _POSE_CONN
    _import_strategy = "mediapipe.solutions (v0.8-0.9)"
except (ImportError, AttributeError) as e:
    logger.debug("Batting Strategy 1 failed: %s", e)

# Strategy 2: mediapipe.python.solutions (v0.10+)
if mp_pose_module is None:
    try:
        from mediapipe.python.solutions import pose as _mp_pose
        from mediapipe.python.solutions import drawing_utils as _mp_draw
        from mediapipe.python.solutions.pose import POSE_CONNECTIONS as _POSE_CONN
        mp_pose_module = _mp_pose
        mp_drawing_module = _mp_draw
        POSE_CONNECTIONS = _POSE_CONN
        _import_strategy = "mediapipe.python.solutions (v0.10+)"
    except (ImportError, AttributeError) as e:
        logger.debug("Batting Strategy 2 failed: %s", e)

# Strategy 3: base import
if mp_pose_module is None:
    try:
        import mediapipe as mp
        if hasattr(mp, 'solutions'):
            mp_pose_module = mp.solutions.pose
            mp_drawing_module = mp.solutions.drawing_utils
            POSE_CONNECTIONS = mp.solutions.pose.POSE_CONNECTIONS
            _import_strategy = "mediapipe base import"
    except (ImportError, AttributeError) as e:
        logger.debug("Batting Strategy 3 failed: %s", e)

BATTING_MEDIAPIPE_AVAILABLE = mp_pose_module is not None and mp_drawing_module is not None

if BATTING_MEDIAPIPE_AVAILABLE:
    logger.info("✓ Batting engine: MediaPipe loaded via %s", _import_strategy)
else:
    logger.warning("✗ Batting engine: MediaPipe not available")

# ==========================================
# CONFIGURATION
# ==========================================
load_dotenv()

# MediaPipe landmark indices
NOSE = 0
LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12
LEFT_ELBOW = 13
RIGHT_ELBOW = 14
LEFT_WRIST = 15
RIGHT_WRIST = 16
LEFT_HIP = 23
RIGHT_HIP = 24
LEFT_KNEE = 25
RIGHT_KNEE = 26
LEFT_ANKLE = 27
RIGHT_ANKLE = 28

# Batting metric display labels
BATTING_METRIC_LABELS = {
    "head_alignment": "Head Alignment Ratio",
    "stride_length": "Stride Length (Norm.)",
    "backlift_height": "Backlift Height (Norm.)",
    "front_knee_angle": "Front Knee Angle (°)",
    "back_knee_angle": "Back Knee Angle (°)",
    "shoulder_rotation": "Shoulder Rotation (°)",
    "wrist_height": "Wrist Height (Norm.)",
    "hip_rotation": "Hip Rotation (°)",
    "timestamp": "Time (Seconds)",
}

# Batting phase names
PHASES = ["Stance", "Trigger/Stride", "Downswing", "Impact", "Follow-Through"]

# UPGRADED GEMINI PROMPT PATTERN (for detailed technical feedback + YouTube drill recommendations)
BATTING_ANALYSIS_PROMPT = """
You are a professional elite cricket batting coach and biomechanics analyst.
Analyze this batter's technique using the provided biomechanical metrics.

IMPORTANT: MediaPipe tracks the BODY only, NOT the bat or ball.
Your analysis must focus on body mechanics, balance, and movement patterns.

METRICS SUMMARY:
{metrics_summary}

PHASE DETECTION:
{phase_info}

REQUIRED STRUCTURE (use this exact format):

**OVERALL ASSESSMENT**
Provide a 2-3 sentence executive summary of the batter's technique.

**PHASE-BY-PHASE TECHNICAL ANALYSIS**

**1. Stance & Setup**
- Head position and balance assessment
- Base width and weight distribution

**2. Trigger Movement & Stride**
- Stride length and timing
- Weight transfer pattern

**3. Downswing & Shot Execution**
- Shoulder rotation analysis
- Front knee position at contact

**4. Impact Zone**
- Head alignment at impact (within base?)
- Balance and stability

**5. Follow-Through**
- Completion of shot
- Balance maintenance

**WEAKNESSES**
For EACH weakness identified, provide EXACTLY this format:
- [Weakness Name] (Rating: X/10). [Timestamp: X.XXs]. [Detailed explanation]

**SPECIFIC CORRECTIONS & DRILLS**
- **Drill 1**: [Name] - [Detailed instructions]
- **Drill 2**: [Name] - [Detailed instructions]
- **Drill 3**: [Name] - [Detailed instructions]

**PERFORMANCE SUMMARY**
- **Primary Strength**: [Specific strength]
- **Critical Weakness**: [Specific weakness]
- **Top Priority Fix**: [Single most important correction]

**RECOMMENDED TUTORIALS**
Provide a search intent for EVERY weakness identified above.
1. Search Intent: [3-5 word YouTube search query for fixing weakness #1 - MUST include 'batting']
   Why this video: [One line explanation]
... (Repeat for ALL weaknesses)

**CRITICAL MANDATE**: For EVERY weakness listed, you MUST provide a [Timestamp: X.XXs] where the error is visible.

FORMATTING RULES:
- Use ** for bold headings and emphasis
- Use - for bullet points
- Keep each point actionable and specific
- Reference actual metrics when relevant
- Avoid vague advice

Tone: Direct, professional, encouraging but honest.
"""


# YOUTUBE HELPERS
def generate_youtube_search_link(query: str) -> str:
    """Build a YouTube search URL from a plain-text query string.
    
    We NEVER ask Gemini for URLs (hallucination risk). Gemini provides
    a short search phrase and we construct the link deterministically.
    """
    encoded = urllib.parse.quote_plus(query.strip())
    return f"https://www.youtube.com/results?search_query={encoded}"


def extract_drill_recommendations(report_text: str) -> list[dict]:
    """Parse Gemini's markdown report and extract drill recommendations.
    
    Looks for the RECOMMENDED TUTORIALS section, extracts Search Intent + Why lines,
    and builds structured drill objects with YouTube search links.
    
    Returns:
        List of dicts: [{"query": str, "title": str, "link": str, "reason": str}, ...]
    """
    drills: list[dict] = []
    
    if "**RECOMMENDED TUTORIAL" not in report_text:
        return drills
    
    try:
        # Split at tutorials section
        if "**RECOMMENDED TUTORIALS**" in report_text:
            parts = report_text.split("**RECOMMENDED TUTORIALS**")
        else:
            parts = report_text.split("**RECOMMENDED TUTORIAL**")
        
        if len(parts) < 2:
            return drills
        
        tutorial_content = "".join(parts[1:])
        search_intents = re.findall(r"Search Intent:\s*(.*)", tutorial_content)
        whys = re.findall(r"Why this video:\s*(.*)", tutorial_content)
        
        for i, intent in enumerate(search_intents):
            clean_intent = intent.strip().strip('*_`[]()')
            # Also replace markdown in the middle
            clean_intent = clean_intent.replace('**', '').replace('*', '').strip()
            
            why = whys[i].strip() if i < len(whys) else "To improve your technique."
            # Strip markdown from reason text
            why = why.replace('**', '').replace('*', '').strip()
            
            # Append 'cricket batting tutorial' for better search results
            full_query = f"{clean_intent} cricket batting tutorial"
            link = generate_youtube_search_link(full_query)
            
            drills.append({
                "query": clean_intent,
                "title": f"Batting Tutorial: {clean_intent}",
                "link": link,
                "reason": why,
            })
    except Exception as e:
        logger.warning("Failed to extract drill recommendations: %s", e)
    
    return drills


def extract_detected_flaws(report_text: str) -> list[dict]:
    """Parse the WEAKNESSES section from Gemini's markdown report.
    
    Expected format per line:
      - [Weakness Name] (Rating: X/10). [Timestamp: X.XXs]. [Description]
    
    Returns:
        List of dicts: [{"flaw_name": str, "rating": int|None, "timestamp": str|None, "description": str}, ...]
    """
    flaws: list[dict] = []
    
    # Find the WEAKNESSES section
    match = re.search(r'\*\*WEAKNESSES\*\*\s*\n(.*?)(?=\n\*\*[A-Z]|\Z)', report_text, re.DOTALL)
    if not match:
        return flaws
    
    section = match.group(1)
    
    for line in section.strip().split('\n'):
        line = line.strip()
        if not line.startswith('-'):
            continue
        line = line.lstrip('- ').strip()
        
        # Extract rating
        rating_match = re.search(r'\(Rating:\s*(\d+)/10\)', line)
        rating = int(rating_match.group(1)) if rating_match else None
        
        # Extract timestamp
        ts_match = re.search(r'\[Timestamp:\s*([\d.]+)s\]', line)
        timestamp = ts_match.group(1) if ts_match else None
        
        # Extract flaw name (text before first parenthesis)
        name_match = re.match(r'^([^(\[]+)', line)
        flaw_name = name_match.group(1).strip().rstrip('.') if name_match else line[:50]
        # Strip markdown formatting
        flaw_name = flaw_name.replace('**', '').replace('*', '').strip()
        
        # Description is everything after the timestamp bracket (or rating bracket)
        desc = line
        if ts_match:
            desc = line[ts_match.end():].strip().lstrip('. ')
        elif rating_match:
            desc = line[rating_match.end():].strip().lstrip('. ')
        # Strip markdown formatting from description
        desc = desc.replace('**', '').replace('*', '').strip()
        
        flaws.append({
            "flaw_name": flaw_name,
            "rating": rating,
            "timestamp": timestamp,
            "description": desc if desc else flaw_name,
        })
    
    return flaws


def parse_and_render_markdown(pdf, text: str, base_font_size: int = 11) -> None:
    """Parse markdown text and render to FPDF with headings, bold, bullets."""
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            pdf.ln(3)
            i += 1
            continue

        # Heading: ## or **HEADING**
        if line.startswith('##'):
            clean = line.lstrip('#').strip().replace('**', '')
            safe = clean.encode('latin-1', 'replace').decode('latin-1')
            pdf.set_font('Helvetica', 'B', base_font_size + 3)
            pdf.set_text_color(0, 100, 180)
            pdf.cell(0, 10, safe, 0, 1, 'L')
            pdf.set_text_color(60, 60, 60)
            i += 1
            continue

        if line.startswith('**') and line.endswith('**') and len(line) > 4:
            clean = line.strip('*').strip()
            safe = clean.encode('latin-1', 'replace').decode('latin-1')
            pdf.set_font('Helvetica', 'B', base_font_size + 1)
            pdf.set_text_color(0, 80, 160)
            pdf.cell(0, 8, safe, 0, 1, 'L')
            pdf.set_text_color(60, 60, 60)
            i += 1
            continue

        # Bullet
        if line.startswith('- ') or line.startswith('* '):
            clean = line[2:].replace('**', '')
            safe = clean.encode('latin-1', 'replace').decode('latin-1')
            pdf.set_font('Helvetica', '', base_font_size)
            pdf.set_x(15)
            pdf.multi_cell(0, 6, f"  - {safe}")
            pdf.set_x(10)
            i += 1
            continue

        # Regular paragraph
        clean = line.replace('**', '')
        safe = clean.encode('latin-1', 'replace').decode('latin-1')
        pdf.set_font('Helvetica', '', base_font_size)
        pdf.multi_cell(0, 6, safe)
        pdf.ln(1)
        i += 1


# ==========================================
# GEMINI API MANAGER (shared pattern)
# ==========================================
class BattingGeminiManager:
    """Gemini key manager for batting analysis."""

    def __init__(self) -> None:
        self.keys: list[str] = []
        for i in range(1, 6):
            val = os.getenv(f"GEMINI_API_KEY_{i}")
            if val and "your_api_key" not in val and len(val) > 10:
                self.keys.append(val.strip())
        if not self.keys:
            val = os.getenv("GEMINI_API_KEY")
            if val and "your_api_key" not in val and len(val) > 10:
                self.keys.append(val.strip())
        self.current_index = 0
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    def get_client(self):
        if not self.keys:
            return None
        return genai.Client(api_key=self.keys[self.current_index % len(self.keys)])

    def call_gemini(self, prompt: str, video_path: str | None = None) -> str:
        client = self.get_client()
        if not client:
            return "AI Feedback unavailable. (No API Key)"
        try:
            contents = [prompt]
            if video_path:
                try:
                    uploaded_video = client.files.upload(file=video_path)
                    while uploaded_video.state == "PROCESSING":
                        time.sleep(2)
                        uploaded_video = client.files.get(name=uploaded_video.name)
                    contents.append(uploaded_video)
                except Exception as e:
                    return f"Video upload failed: {e}. Falling back to text-only analysis."
            response = client.models.generate_content(
                model=self.model_name,
                contents=contents,
            )
            return response.text
        except Exception as e:
            return f"Gemini Error: {e}"


# ==========================================
# BATTING BIOMECHANICS ENGINE
# ==========================================
if BATTING_MEDIAPIPE_AVAILABLE:
    class BattingPoseAnalyzer:
        """
        Analyzes batting technique using MediaPipe pose landmarks.

        Tracked metrics per frame:
          - head_alignment:    nose X relative to ankle base (0–1 = within base)
          - stride_length:     normalized distance between ankles
          - backlift_height:   average wrist Y (lower value = higher backlift)
          - front_knee_angle:  angle at the front knee
          - back_knee_angle:   angle at the back knee
          - shoulder_rotation: angle formed by shoulders relative to horizontal
          - wrist_height:      average wrist Y position
          - hip_rotation:      angle formed by hips relative to horizontal
        """

        def __init__(self) -> None:
            self.mp_pose = mp_pose_module
            self.mp_drawing = mp_drawing_module
            self.pose_connections = POSE_CONNECTIONS
            try:
                self.pose = self.mp_pose.Pose(
                    static_image_mode=False,
                    model_complexity=1,
                    enable_segmentation=False,
                    min_detection_confidence=0.7,
                    min_tracking_confidence=0.7,
                )
            except Exception as e:
                raise e

        # ----- Geometry helpers -----
        @staticmethod
        def _angle(a: list, b: list, c: list) -> float:
            """Angle at point b formed by segments ba and bc (degrees)."""
            a, b, c = np.array(a), np.array(b), np.array(c)
            rad = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
            deg = np.abs(rad * 180.0 / np.pi)
            return float(360 - deg if deg > 180 else deg)

        @staticmethod
        def _dist(a: list, b: list) -> float:
            return float(math.hypot(a[0] - b[0], a[1] - b[1]))

        @staticmethod
        def _head_alignment(nose_x: float, back_ankle_x: float, front_ankle_x: float) -> float:
            """
            R = (nose_x - back_ankle_x) / (front_ankle_x - back_ankle_x)
            0-1 = within base, <0 or >1 = outside centre of gravity.
            """
            denom = front_ankle_x - back_ankle_x
            if abs(denom) < 1e-6:
                return 0.5  # feet together, assume centred
            return float((nose_x - back_ankle_x) / denom)

        @staticmethod
        def _shoulder_rotation(l_shoulder: list, r_shoulder: list) -> float:
            """Angle of the shoulder line relative to horizontal (degrees)."""
            dx = r_shoulder[0] - l_shoulder[0]
            dy = r_shoulder[1] - l_shoulder[1]
            return float(abs(math.degrees(math.atan2(dy, dx))))

        @staticmethod
        def _hip_rotation(l_hip: list, r_hip: list) -> float:
            dx = r_hip[0] - l_hip[0]
            dy = r_hip[1] - l_hip[1]
            return float(abs(math.degrees(math.atan2(dy, dx))))

        # ----- Phase detection -----
        @staticmethod
        def detect_phases(df: pd.DataFrame) -> dict[str, int | None]:
            """
            Identify key phase-transition frames from the metric timeseries.

            Returns dict with frame indices for:
              stance_end, stride_peak, downswing_start, impact, followthrough_start
            """
            phases: dict[str, int | None] = {
                "stance_end": None,
                "stride_peak": None,
                "downswing_start": None,
                "impact": None,
                "followthrough_start": None,
            }
            if df.empty or len(df) < 5:
                return phases

            # Stride peak = max stride_length
            stride_peak_idx = int(df["stride_length"].idxmax())
            phases["stride_peak"] = stride_peak_idx

            # Stance end = halfway to stride peak
            phases["stance_end"] = max(0, stride_peak_idx // 2)

            # Impact = lowest average wrist_height after stride peak
            post_stride = df.loc[stride_peak_idx:]
            if not post_stride.empty:
                impact_idx = int(post_stride["wrist_height"].idxmin())
                phases["impact"] = impact_idx

                # Downswing start = stride_peak (wrists begin dropping)
                phases["downswing_start"] = stride_peak_idx

                # Follow-through = after impact, wrist rises again
                post_impact = df.loc[impact_idx:]
                if len(post_impact) > 2:
                    phases["followthrough_start"] = impact_idx + 1

            return phases

        # ----- Main processor -----
        def process_video(self, video_path: str):
            """
            Process a batting video and return:
              (raw_df, display_df, captured_images, annotated_video_path, phase_info)
            """
            cap = cv2.VideoCapture(video_path)
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

            metrics: list[dict] = []

            # Annotated output video
            output_path = (
                video_path
                .replace('.mp4', '_bat_annotated.mp4')
                .replace('.mov', '_bat_annotated.mp4')
                .replace('.avi', '_bat_annotated.mp4')
            )
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

            frame_idx = 0
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                # Skip every other frame for performance
                if frame_idx % 2 != 0:
                    out.write(frame)
                    frame_idx += 1
                    continue

                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = self.pose.process(frame_rgb)
                annotated = frame.copy()

                if results.pose_landmarks:
                    lm = results.pose_landmarks.landmark

                    def gp(idx: int) -> list[float]:
                        return [lm[idx].x, lm[idx].y]

                    nose = gp(NOSE)
                    l_shoulder = gp(LEFT_SHOULDER)
                    r_shoulder = gp(RIGHT_SHOULDER)
                    l_wrist = gp(LEFT_WRIST)
                    r_wrist = gp(RIGHT_WRIST)
                    l_hip = gp(LEFT_HIP)
                    r_hip = gp(RIGHT_HIP)
                    l_knee = gp(LEFT_KNEE)
                    r_knee = gp(RIGHT_KNEE)
                    l_ankle = gp(LEFT_ANKLE)
                    r_ankle = gp(RIGHT_ANKLE)

                    # Determine front/back foot (front = lower X for right-hander by convention)
                    front_ankle = l_ankle if l_ankle[0] < r_ankle[0] else r_ankle
                    back_ankle = r_ankle if l_ankle[0] < r_ankle[0] else l_ankle

                    # --- Core metrics ---
                    head_align = self._head_alignment(nose[0], back_ankle[0], front_ankle[0])
                    stride_len = self._dist(l_ankle, r_ankle)
                    avg_wrist_y = (l_wrist[1] + r_wrist[1]) / 2
                    front_knee_angle = self._angle(
                        l_hip if front_ankle is l_ankle else r_hip,
                        l_knee if front_ankle is l_ankle else r_knee,
                        front_ankle,
                    )
                    back_knee_angle = self._angle(
                        r_hip if back_ankle is r_ankle else l_hip,
                        r_knee if back_ankle is r_ankle else l_knee,
                        back_ankle,
                    )
                    shoulder_rot = self._shoulder_rotation(l_shoulder, r_shoulder)
                    hip_rot = self._hip_rotation(l_hip, r_hip)

                    frame_data = {
                        "frame": frame_idx,
                        "head_alignment": round(head_align, 4),
                        "stride_length": round(stride_len, 4),
                        "backlift_height": round(avg_wrist_y, 4),
                        "front_knee_angle": round(front_knee_angle, 2),
                        "back_knee_angle": round(back_knee_angle, 2),
                        "shoulder_rotation": round(shoulder_rot, 2),
                        "wrist_height": round(avg_wrist_y, 4),
                        "hip_rotation": round(hip_rot, 2),
                        "timestamp": round(frame_idx / fps, 2),
                    }
                    metrics.append(frame_data)

                    # Draw skeleton (cyan dots + white lines)
                    self.mp_drawing.draw_landmarks(
                        annotated,
                        results.pose_landmarks,
                        self.pose_connections,
                        landmark_drawing_spec=self.mp_drawing.DrawingSpec(
                            color=(255, 220, 0), thickness=6, circle_radius=8,
                        ),
                        connection_drawing_spec=self.mp_drawing.DrawingSpec(
                            color=(255, 255, 255), thickness=4,
                        ),
                    )

                out.write(annotated)
                frame_idx += 1

            cap.release()
            out.release()

            # Optimize video for web streaming - re-encode to H.264 with faststart
            try:
                temp_optimized = output_path.replace(".mp4", "_optimized.mp4")
                subprocess.run(
                    [
                        "ffmpeg", "-i", output_path,
                        "-c:v", "libx264",  # Re-encode to H.264 (web-compatible)
                        "-preset", "fast",  # Encoding speed vs compression
                        "-crf", "23",  # Constant Rate Factor (quality: 0=lossless, 51=worst)
                        "-movflags", "+faststart",  # Move moov atom to beginning
                        "-y",  # Overwrite if exists
                        temp_optimized
                    ],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=120  # Allow more time for re-encoding
                )
                # Replace original with optimized version
                os.replace(temp_optimized, output_path)
                logger.info(f"Video optimized for web streaming (H.264)")
            except subprocess.TimeoutExpired:
                logger.warning(f"Video optimization timed out - using original")
            except Exception as e:
                logger.warning(f"Video optimization failed (using original): {e}")

            df = pd.DataFrame(metrics)
            display_df = pd.DataFrame()
            captured_images: dict[str, np.ndarray] = {}
            phase_info: dict[str, int | None] = {}

            if not df.empty:
                display_df = df.drop(columns=["frame"]).rename(columns=BATTING_METRIC_LABELS)

                # Phase detection
                phase_info = self.detect_phases(df)

                # Capture key frames
                key_frames = {
                    "Stance": phase_info.get("stance_end"),
                    "Stride Peak": phase_info.get("stride_peak"),
                    "Impact": phase_info.get("impact"),
                    "Follow-Through": phase_info.get("followthrough_start"),
                }
                cap2 = cv2.VideoCapture(output_path)
                for label, fidx in key_frames.items():
                    if fidx is not None:
                        cap2.set(cv2.CAP_PROP_POS_FRAMES, fidx)
                        ret, frm = cap2.read()
                        if ret:
                            captured_images[label] = cv2.cvtColor(frm, cv2.COLOR_BGR2RGB)
                cap2.release()

            return df, display_df, captured_images, output_path, phase_info

else:
    class BattingPoseAnalyzer:
        def __init__(self):
            raise RuntimeError(
                "BattingPoseAnalyzer requires MediaPipe. "
                "Install: pip install mediapipe>=0.10.0"
            )

        def process_video(self, video_path: str):
            raise RuntimeError("MediaPipe not available")


# ==========================================
# PDF GENERATOR (Batting)
# ==========================================
class BattingPDFReport(FPDF):
    def header(self):
        self.set_fill_color(10, 25, 50)
        self.rect(0, 0, 210, 45, 'F')
        self.set_text_color(255, 255, 255)
        self.set_font('Helvetica', 'B', 22)
        self.cell(0, 22, 'ELITE BATTER ANALYSIS REPORT', 0, 1, 'C')
        self.set_font('Helvetica', '', 11)
        self.set_text_color(255, 200, 50)
        self.cell(0, 6, 'AI-Powered Batting Biomechanics Analysis', 0, 1, 'C')
        self.set_draw_color(255, 180, 0)
        self.set_line_width(0.8)
        self.line(20, 42, 190, 42)
        self.ln(12)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, f'Elite Cricket Analytics | Batting Report | Page {self.page_no()}', 0, 0, 'C')


def create_batting_pdf(
    feedback: str,
    metrics_df: pd.DataFrame,
    images: dict[str, np.ndarray],
    phase_info: dict[str, int | None] | None = None,
) -> bytes:
    """Generate a professional PDF report for batting analysis."""
    pdf = BattingPDFReport()
    pdf.add_page()

    # --- AI Feedback ---
    pdf.set_font('Helvetica', 'B', 18)
    pdf.set_text_color(0, 100, 180)
    pdf.cell(0, 12, 'AI Batting Coach Feedback', 0, 1, 'C')
    pdf.ln(5)
    pdf.set_text_color(60, 60, 60)
    parse_and_render_markdown(pdf, feedback, base_font_size=11)
    pdf.ln(10)

    # --- Phase Summary ---
    if phase_info:
        pdf.add_page()
        pdf.set_font('Helvetica', 'B', 18)
        pdf.set_text_color(0, 100, 180)
        pdf.cell(0, 12, 'Shot Phase Detection', 0, 1, 'C')
        pdf.ln(5)
        pdf.set_font('Helvetica', '', 12)
        pdf.set_text_color(60, 60, 60)
        for phase_name, frame_idx in phase_info.items():
            label = phase_name.replace('_', ' ').title()
            val = f"Frame {frame_idx}" if frame_idx is not None else "Not detected"
            safe = f"{label}: {val}".encode('latin-1', 'replace').decode('latin-1')
            pdf.cell(0, 8, safe, 0, 1, 'L')
        pdf.ln(8)

    # --- Metrics Table ---
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 18)
    pdf.set_text_color(0, 100, 180)
    pdf.cell(0, 12, 'Batting Biometrics Summary', 0, 1, 'C')
    pdf.ln(8)
    pdf.set_text_color(60, 60, 60)

    if not metrics_df.empty:
        summary = metrics_df.describe().T[['mean', 'max', 'min']]
        col_w = pdf.w / 4.5

        # Header
        pdf.set_fill_color(20, 120, 200)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font('Helvetica', 'B', 11)
        pdf.cell(col_w + 10, 10, 'Metric', 1, 0, 'C', 1)
        pdf.cell(col_w - 10, 10, 'Average', 1, 0, 'C', 1)
        pdf.cell(col_w - 10, 10, 'Max', 1, 0, 'C', 1)
        pdf.cell(col_w - 10, 10, 'Min', 1, 1, 'C', 1)

        # Rows
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(60, 60, 60)
        alt = True
        for idx, row in summary.iterrows():
            pdf.set_fill_color(245, 245, 245) if alt else pdf.set_fill_color(255, 255, 255)
            safe_idx = str(idx).encode('latin-1', 'replace').decode('latin-1')
            pdf.cell(col_w + 10, 9, safe_idx, 1, 0, 'L', 1)
            pdf.cell(col_w - 10, 9, f"{row['mean']:.2f}", 1, 0, 'C', 1)
            pdf.cell(col_w - 10, 9, f"{row['max']:.2f}", 1, 0, 'C', 1)
            pdf.cell(col_w - 10, 9, f"{row['min']:.2f}", 1, 1, 'C', 1)
            alt = not alt

    # --- Key Frame Images ---
    if images:
        pdf.add_page()
        pdf.set_font('Helvetica', 'B', 18)
        pdf.set_text_color(0, 100, 180)
        pdf.cell(0, 12, 'Key Batting Action Frames', 0, 1, 'C')
        pdf.ln(5)
        for label, img_arr in images.items():
            pdf.set_font('Helvetica', 'B', 13)
            pdf.set_text_color(0, 150, 200)
            pdf.cell(0, 10, label, 0, 1, 'L')
            pdf.set_text_color(60, 60, 60)
            img = Image.fromarray(img_arr)
            pdf.image(img, x=15, w=180)
            pdf.ln(8)

    return bytes(pdf.output())
