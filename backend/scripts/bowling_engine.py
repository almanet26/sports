import cv2
import numpy as np
import os
import re
import subprocess
import time
import logging
import importlib
import urllib.parse
import pandas as pd
from google import genai
from dotenv import load_dotenv
from PIL import Image
from fpdf import FPDF
import io

VideosSearch = None
try:
    _yt_module = importlib.import_module("youtubesearchpython")
    VideosSearch = getattr(_yt_module, "VideosSearch", None)
except Exception:
    VideosSearch = None

logger = logging.getLogger(__name__)

# MediaPipe imports with comprehensive fallback strategy
mp_pose_module = None
mp_drawing_module = None
POSE_CONNECTIONS = None
import_strategy_used = None

# Strategy 1: Try mediapipe.solutions (most common for v0.8-0.9)
try:
    import mediapipe.solutions.pose as mp_pose_module_temp
    import mediapipe.solutions.drawing_utils as mp_drawing_module_temp
    from mediapipe.solutions.pose import POSE_CONNECTIONS as POSE_CONN_TEMP
    mp_pose_module = mp_pose_module_temp
    mp_drawing_module = mp_drawing_module_temp
    POSE_CONNECTIONS = POSE_CONN_TEMP
    import_strategy_used = "mediapipe.solutions (v0.8-0.9)"
except (ImportError, AttributeError) as e:
    print(f"Strategy 1 failed: {e}")
    pass

# Strategy 2: Try mediapipe.python.solutions (v0.10+)
if mp_pose_module is None:
    try:
        from mediapipe.python.solutions import pose as mp_pose_module_temp
        from mediapipe.python.solutions import drawing_utils as mp_drawing_module_temp
        from mediapipe.python.solutions.pose import POSE_CONNECTIONS as POSE_CONN_TEMP
        mp_pose_module = mp_pose_module_temp
        mp_drawing_module = mp_drawing_module_temp
        POSE_CONNECTIONS = POSE_CONN_TEMP
        import_strategy_used = "mediapipe.python.solutions (v0.10+)"
    except (ImportError, AttributeError) as e:
        print(f"🚨 Strategy 2 failed: {e}")
        pass

# Strategy 3: Try base mediapipe import with attribute access
if mp_pose_module is None:
    try:
        import mediapipe as mp
        if hasattr(mp, 'solutions'):
            mp_pose_module = mp.solutions.pose
            mp_drawing_module = mp.solutions.drawing_utils
            POSE_CONNECTIONS = mp.solutions.pose.POSE_CONNECTIONS
            import_strategy_used = "mediapipe base import with .solutions"
    except (ImportError, AttributeError) as e:
        print(f"🚨 Strategy 3 failed: {e}")
        pass

# Final check
MEDIAPIPE_AVAILABLE = False
if mp_pose_module is None or mp_drawing_module is None:
    print(
        "⚠ WARNING: MediaPipe not available. Bowling analysis disabled.\n"
        "Tried import strategies:\n"
        "  1. mediapipe.solutions.pose (v0.8-0.9)\n"
        "  2. mediapipe.python.solutions (v0.10+)\n"
        "  3. mediapipe base import\n"
        "Install: pip install mediapipe>=0.10.0"
    )
    # Set dummy values to allow module import
    mp_pose_module = None
    mp_drawing_module = None
    POSE_CONNECTIONS = None
else:
    print(f"✓ MediaPipe loaded successfully using: {import_strategy_used}")
    MEDIAPIPE_AVAILABLE = True

# ==========================================
# CONFIGURATION & ENVIRONMENT
# ==========================================
load_dotenv()

# Metric name mapping for display and report
METRIC_LABELS = {
    "r_elbow_angle": "Right Elbow Extension (°)",
    "l_elbow_angle": "Left Elbow Extension (°)",
    "r_wrist_y": "Release Height (Relative)",
    "hip_center_y": "Body Height Level",
    "timestamp": "Time (Seconds)"
}

# ==========================================
# UPGRADED GEMINI PROMPT 
# ==========================================
BOWLING_ANALYSIS_PROMPT = """
You are a professional elite cricket bowling coach and biomechanics analyst.
Analyze this fast bowler's technique using the provided biomechanical metrics.

IMPORTANT: MediaPipe tracks the BODY only, NOT the ball.
Your analysis must focus on body mechanics, joint angles, and movement patterns.

METRICS SUMMARY:
{metrics_summary}

REQUIRED STRUCTURE (use this exact format):

**OVERALL ASSESSMENT**
Provide a 2-3 sentence executive summary of the bowler's action quality.

**PHASE-BY-PHASE TECHNICAL ANALYSIS**

**1. Run-Up & Approach**
- Rhythm and momentum assessment
- Body alignment during approach

**2. Back Foot Contact & Loading Phase**
- Hip-shoulder separation at back foot
- Weight loading pattern

**3. Delivery Stride & Front Foot Landing**
- Stride length and alignment
- Front leg brace angle

**4. Release Point & Arm Mechanics**
- Elbow extension angle analysis (legal action check)
- Release height consistency

**5. Follow-Through & Energy Transfer**
- Deceleration pattern
- Balance at completion

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
1. Search Intent: [3-5 word YouTube search query for fixing weakness #1 - MUST include 'bowling']
   Why this video: [One line explanation]
... (Repeat for ALL weaknesses)

**CRITICAL MANDATE**: For EVERY weakness listed, you MUST provide a [Timestamp: X.XXs] where the error is visible.
Do NOT generate any YouTube URLs. Only provide the exact text search phrase.

FORMATTING RULES:
- Use ** for bold headings and emphasis
- Use - for bullet points
- Keep each point actionable and specific
- Reference actual metrics when relevant
- Avoid vague advice

Tone: Direct, professional, encouraging but honest.
"""


# ==========================================
# YOUTUBE HELPERS
# ==========================================
def _build_youtube_url(query: str) -> str:
    """Build a YouTube search URL from a plain-text query string.

    We NEVER ask Gemini for URLs (hallucination risk). Gemini provides
    a short search phrase and we construct the link deterministically.
    """
    encoded = urllib.parse.quote_plus(query.strip())
    return f"https://www.youtube.com/results?search_query={encoded}"


def _clean_tutorial_text(value: str) -> str:
    """Normalize markdown/noisy AI text into plain query-friendly text."""
    cleaned = re.sub(r"\*+", "", value or "")
    cleaned = cleaned.strip().strip("[](){}\"'` ")
    cleaned = re.sub(r"^\d+\.\s*", "", cleaned)
    cleaned = re.sub(r"^(search\s*intent|title|query|link|why\s*this\s*video)\s*:\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _extract_first_url(value: str) -> str | None:
    """Extract first HTTP URL from a line if present."""
    match = re.search(r"https?://[^\s)]+", value or "")
    return match.group(0) if match else None


def _normalize_intent(intent: str, discipline: str) -> str:
    """Ensure intent is concise and anchored to batting/bowling terminology."""
    cleaned = _clean_tutorial_text(intent)
    if not cleaned:
        cleaned = f"{discipline} technique"
    if discipline.lower() not in cleaned.lower():
        cleaned = f"{cleaned} {discipline}".strip()
    return cleaned


def _resolve_youtube_recommendation(intent: str, discipline: str) -> tuple[str, str, str]:
    """Return (query, title, link) using optional live search with deterministic fallback."""
    def _is_specific_youtube_link(url: str) -> bool:
        u = (url or "").lower()
        return "youtube.com/watch?v=" in u or "youtu.be/" in u or "youtube.com/shorts/" in u

    normalized_intent = _normalize_intent(intent, discipline)
    full_query = f"{normalized_intent} cricket {discipline} tutorial"
    fallback_title = f"{discipline.title()} Tutorial: {normalized_intent}"
    fallback_link = _build_youtube_url(full_query)

    logger.info("[BWL] tutorial resolver start query=%s", full_query)

    if VideosSearch is None:
        logger.warning("[BWL] tutorial resolver source=videossearch-unavailable specific=false link=%s", fallback_link)
        return full_query, fallback_title, fallback_link

    try:
        result = VideosSearch(full_query, limit=1).result().get("result", [])
        if result:
            title = _clean_tutorial_text(result[0].get("title", "")) or fallback_title
            link = _extract_first_url(result[0].get("link", "")) or fallback_link
            logger.info(
                "[BWL] tutorial resolver source=videossearch specific=%s link=%s",
                _is_specific_youtube_link(link),
                link,
            )
            return full_query, title, link
    except Exception as e:
        logger.debug("Live YouTube lookup failed for query '%s': %s", full_query, e)

    # Fallback 2: yt-dlp ytsearch is often more reliable than parser libraries.
    try:
        yt_dlp = importlib.import_module("yt_dlp")
        with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as ydl:
            info = ydl.extract_info(f"ytsearch1:{full_query}", download=False)
            entries = (info or {}).get("entries") or []
            if entries:
                entry = entries[0] or {}
                title = _clean_tutorial_text(str(entry.get("title", ""))) or fallback_title
                link = str(entry.get("webpage_url") or entry.get("url") or "").strip()
                if link and not link.startswith("http"):
                    link = f"https://www.youtube.com/watch?v={link}"
                if link:
                    logger.info(
                        "[BWL] tutorial resolver source=yt-dlp specific=%s link=%s",
                        _is_specific_youtube_link(link),
                        link,
                    )
                    return full_query, title, link
    except Exception as e:
        logger.debug("yt-dlp tutorial lookup failed for query '%s': %s", full_query, e)

    logger.warning("[BWL] tutorial resolver source=search-fallback specific=false link=%s", fallback_link)
    return full_query, fallback_title, fallback_link


def extract_bowling_flaws(report_text: str) -> list[dict]:
    """Parse the WEAKNESSES section from Gemini's markdown report.

    Expected format per line:
      - [Weakness Name] (Rating: X/10). [Timestamp: X.XXs]. [Description]

    Returns:
        List of dicts: [{"flaw_name": str, "rating": int|None, "timestamp": str|None, "description": str}, ...]
    """
    flaws: list[dict] = []

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

        # Extract flaw name (text before first parenthesis or bracket)
        name_match = re.match(r'^([^(\[]+)', line)
        flaw_name = name_match.group(1).strip().rstrip('.') if name_match else line[:50]
        flaw_name = flaw_name.replace('**', '').replace('*', '').strip()

        # Description is everything after the timestamp bracket (or rating bracket)
        desc = line
        if ts_match:
            desc = line[ts_match.end():].strip().lstrip('. ')
        elif rating_match:
            desc = line[rating_match.end():].strip().lstrip('. ')
        desc = desc.replace('**', '').replace('*', '').strip()

        flaws.append({
            "flaw_name": flaw_name,
            "rating": rating,
            "timestamp": timestamp,
            "description": desc if desc else flaw_name,
        })

    return flaws


def extract_bowling_drills(report_text: str) -> list[dict]:
    """Parse Gemini's markdown report and extract drill recommendations.

    Looks for the RECOMMENDED TUTORIALS section, extracts Search Intent + Why lines,
    and builds structured drill objects with YouTube search links.

    Returns:
        List of dicts: [{"query": str, "title": str, "link": str, "reason": str}, ...]
    """
    drills: list[dict] = []
    seen_links: set[str] = set()

    section_match = re.search(r"\*\*RECOMMENDED\s+TUTORIALS?\*\*(.*)", report_text, flags=re.IGNORECASE | re.DOTALL)
    tutorial_content = section_match.group(1) if section_match else report_text

    try:
        search_intents = re.findall(r"Search\s*Intent\s*:\s*(.+)", tutorial_content, flags=re.IGNORECASE)
        whys = re.findall(r"Why\s*this\s*video\s*:\s*(.+)", tutorial_content, flags=re.IGNORECASE)

        for i, intent in enumerate(search_intents):
            why = _clean_tutorial_text(whys[i]) if i < len(whys) else "Targets the identified bowling weakness."
            query, title, link = _resolve_youtube_recommendation(intent, "bowling")

            if link in seen_links:
                continue
            seen_links.add(link)

            drills.append(
                {
                    "query": query,
                    "title": title,
                    "link": link,
                    "reason": why,
                }
            )

        # Fallback: parse direct Title/Link blocks if model ignored Search Intent format.
        if not drills:
            titles = re.findall(r"(?:^|\n)\s*\d+\.\s*\*\*?Title\*\*?\s*:\s*(.+)", tutorial_content, flags=re.IGNORECASE)
            links = re.findall(r"(?:^|\n)\s*\*\*?Link\*\*?\s*:\s*(.+)", tutorial_content, flags=re.IGNORECASE)
            why_lines = re.findall(r"(?:^|\n)\s*\*\*?Why\*\*?\s*:\s*(.+)", tutorial_content, flags=re.IGNORECASE)

            for i, raw_title in enumerate(titles):
                title = _clean_tutorial_text(raw_title) or "Bowling Tutorial"
                reason = _clean_tutorial_text(why_lines[i]) if i < len(why_lines) else "Targets the identified bowling weakness."
                link = _extract_first_url(links[i]) if i < len(links) else None

                if link is None:
                    query, resolved_title, resolved_link = _resolve_youtube_recommendation(title, "bowling")
                    title = resolved_title
                    link = resolved_link
                else:
                    query = f"{title} cricket bowling tutorial"

                if link in seen_links:
                    continue
                seen_links.add(link)

                drills.append(
                    {
                        "query": query,
                        "title": title,
                        "link": link,
                        "reason": reason,
                    }
                )

        # Final safety net: generate drills from parsed weaknesses.
        if not drills:
            for flaw in extract_bowling_flaws(report_text)[:4]:
                intent = flaw.get("flaw_name", "bowling technique")
                query, title, link = _resolve_youtube_recommendation(intent, "bowling")
                if link in seen_links:
                    continue
                seen_links.add(link)
                drills.append(
                    {
                        "query": query,
                        "title": title,
                        "link": link,
                        "reason": f"Targets weakness: {intent}",
                    }
                )
    except Exception as e:
        logger.warning("Failed to extract bowling drill recommendations: %s", e)

    return drills


def parse_and_render_markdown(pdf, text, base_font_size=11):
    """
    Parse markdown text and render with proper formatting:
    - Headings: **text** or ## text
    - Bold: **text**
    - Bullets: * or - at line start
    - Regular paragraphs
    """
    lines = text.split('\n')
    i = 0
    
    while i < len(lines):
        line = lines[i].strip()
        
        # Skip empty lines
        if not line:
            pdf.ln(3)
            i += 1
            continue
        
        # Detect headings (lines starting with ## or entirely wrapped in **)
        if line.startswith('##'):
            clean_heading = line.replace('#', '').strip()
            pdf.set_font('Helvetica', 'B', base_font_size + 3)
            pdf.set_text_color(0, 150, 200)
            safe_text = clean_heading.encode('latin-1', 'replace').decode('latin-1')
            pdf.multi_cell(0, 8, safe_text)
            pdf.set_text_color(60, 60, 60)
            pdf.ln(2)
            i += 1
            continue
        
        # Detect bold headings (**Title** as standalone line)
        if line.startswith('**') and line.endswith('**') and line.count('**') == 2:
            clean_heading = line.replace('**', '').strip()
            pdf.set_font('Helvetica', 'B', base_font_size + 2)
            pdf.set_text_color(0, 150, 200)
            safe_text = clean_heading.encode('latin-1', 'replace').decode('latin-1')
            pdf.multi_cell(0, 8, safe_text)
            pdf.set_text_color(60, 60, 60)
            pdf.ln(2)
            i += 1
            continue
        
        # Detect bullet points (*, or -)
        if line.startswith('* ') or line.startswith('- '):
            bullet_text = line[2:].strip()
            
            # Remove any ** formatting for simplicity
            clean_bullet = bullet_text.replace('**', '')
            safe_text = clean_bullet.encode('latin-1', 'replace').decode('latin-1')
            
            # Render as indented text with dash prefix
            pdf.set_font('Helvetica', '', base_font_size)
            pdf.set_x(15)  # Indent
            pdf.multi_cell(0, 6, f"  - {safe_text}")
            pdf.set_x(10)  # Reset
            i += 1
            continue
        
        # Regular paragraph - strip ** formatting
        clean_paragraph = line.replace('**', '')
        safe_text = clean_paragraph.encode('latin-1', 'replace').decode('latin-1')
        pdf.set_font('Helvetica', '', base_font_size)
        pdf.multi_cell(0, 6, safe_text)
        pdf.ln(1)
        
        i += 1

# ==========================================
# GEMINI API MANAGER
# ==========================================
class GeminiManager:
    def __init__(self):
        self.keys = []
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

    def call_gemini(self, prompt, video_path=None, _retry_count: int = 0):
        """Call Gemini with automatic retry on transient / rate-limit errors."""
        MAX_RETRIES = 3
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
                    return f"Video upload failed: {str(e)}. Falling back to text analysis."

            response = client.models.generate_content(
                model=self.model_name,
                contents=contents
            )
            return response.text
        except Exception as e:
            err = str(e).lower()
            is_retryable = any(k in err for k in ("429", "rate", "resource_exhausted", "503", "unavailable", "deadline"))
            if is_retryable and _retry_count < MAX_RETRIES:
                wait = 2 ** (_retry_count + 1)  # 2s, 4s, 8s
                logger.warning(f"Gemini rate-limited, retrying in {wait}s (attempt {_retry_count + 1}/{MAX_RETRIES})")
                time.sleep(wait)
                self.current_index += 1  # rotate to next API key
                return self.call_gemini(prompt, video_path, _retry_count + 1)
            return f"Gemini Error: {str(e)}"

# ==========================================
# BIOMECHANICAL ANALYSIS ENGINE
# ==========================================
if MEDIAPIPE_AVAILABLE:
    class CricketPoseAnalyzer:
        def __init__(self):
            self.mp_pose = mp_pose_module
            self.mp_drawing = mp_drawing_module
            self.pose_connections = POSE_CONNECTIONS
            
            # Reduced model_complexity from 2 to 1 for better stability
            try:
                self.pose = self.mp_pose.Pose(
                    static_image_mode=False,
                    model_complexity=1, 
                    enable_segmentation=False,
                    min_detection_confidence=0.7,
                    min_tracking_confidence=0.7
                )
            except Exception as e:
                raise e

        def calculate_angle(self, a, b, c):
            a, b, c = np.array(a), np.array(b), np.array(c)
            radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
            angle = np.abs(radians*180.0/np.pi)
            return 360-angle if angle > 180.0 else angle

        def process_video(self, video_path):
            cap = cv2.VideoCapture(video_path)
            fps = cap.get(cv2.CAP_PROP_FPS)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            metrics = []
            captured_images = {}
            
            # Create output video writer for annotated version
            output_path = video_path.replace('.mp4', '_annotated.mp4').replace('.mov', '_annotated.mp4').replace('.avi', '_annotated.mp4')
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
            
            frame_idx = 0
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret: break
                
                # Skip every other frame for faster processing (30fps → 15fps analysis)
                if frame_idx % 2 != 0:
                    out.write(frame)  # Write original frame without processing
                    frame_idx += 1
                    continue
                
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = self.pose.process(frame_rgb)
                
                annotated_frame = frame.copy()  # Keep in BGR for video writer
                
                if results.pose_landmarks:
                    landmarks = results.pose_landmarks.landmark
                    def gp(idx): return [landmarks[idx].x, landmarks[idx].y]
                    
                    # Calculations
                    r_elbow = self.calculate_angle(gp(11), gp(13), gp(15))
                    l_elbow = self.calculate_angle(gp(12), gp(14), gp(16))
                    r_wrist = gp(15)
                    
                    frame_data = {
                        "frame": frame_idx,
                        "r_elbow_angle": round(r_elbow, 2),
                        "l_elbow_angle": round(l_elbow, 2),
                        "r_wrist_y": round(r_wrist[1], 4),
                        "hip_center_y": round((gp(23)[1] + gp(24)[1]) / 2, 4),
                        "timestamp": round(frame_idx / fps, 2)
                    }
                    metrics.append(frame_data)
                    
                    # Draw pose landmarks on frame (Yellow dots + white lines) - convert to BGR
                    self.mp_drawing.draw_landmarks(
                        annotated_frame,
                        results.pose_landmarks,
                        self.pose_connections,
                        landmark_drawing_spec=self.mp_drawing.DrawingSpec(
                            color=(0, 220, 255), thickness=6, circle_radius=8  # BGR: Yellow
                        ),
                        connection_drawing_spec=self.mp_drawing.DrawingSpec(
                            color=(255, 255, 255), thickness=4  # BGR: White
                        )
                    )
                
                # Write annotated frame to output video
                out.write(annotated_frame)
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
            
            if not df.empty:
                display_df = df.drop(columns=['frame']).rename(columns=METRIC_LABELS)

                # Capture key frames with pose overlay for thumbnail/preview
                # Release Point (lowest wrist)
                release_idx = df['r_wrist_y'].idxmin()
                cap = cv2.VideoCapture(output_path)
                cap.set(cv2.CAP_PROP_POS_FRAMES, release_idx)
                ret, rel_frame = cap.read()
                if ret:
                    captured_images['Release Point'] = cv2.cvtColor(rel_frame, cv2.COLOR_BGR2RGB)
                cap.release()
            
            return df, display_df, captured_images, output_path
else:
    # MediaPipe not available - define dummy class
    class CricketPoseAnalyzer:
        def __init__(self):
            raise RuntimeError(
                "CricketPoseAnalyzer requires MediaPipe, which is not available. "
                "Please install: pip install mediapipe>=0.10.0"
            )
        
        def process_video(self, video_path):
            raise RuntimeError("MediaPipe not available")

# ==========================================
# PDF GENERATOR
# ==========================================
class PDFReport(FPDF):
    def header(self):
        # Dark header background
        self.set_fill_color(15, 15, 35)
        self.rect(0, 0, 210, 45, 'F')
        
        # Main title
        self.set_text_color(255, 255, 255)
        self.set_font('Helvetica', 'B', 22)
        self.cell(0, 22, 'ELITE BOWLER ANALYSIS REPORT', 0, 1, 'C')
        
        # Subtitle
        self.set_font('Helvetica', '', 11)
        self.set_text_color(100, 200, 255)
        self.cell(0, 6, 'AI-Powered Biomechanical Performance Analysis', 0, 1, 'C')
        
        # Accent line
        self.set_draw_color(0, 150, 200)
        self.set_line_width(0.8)
        self.line(20, 42, 190, 42)
        
        self.ln(12)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, f'Elite Cricket Analytics | AI Coaching Report | Page {self.page_no()}', 0, 0, 'C')

def create_pdf(feedback, metrics_df, images):
    pdf = PDFReport()
    pdf.add_page()
    
    # AI Feedback Section
    pdf.set_text_color(60, 60, 60)
    pdf.set_font('Helvetica', 'B', 18)
    pdf.set_text_color(0, 100, 180)
    pdf.cell(0, 12, 'AI Coach Feedback & Technical Analysis', 0, 1, 'C')
    pdf.ln(5)
    
    # Render markdown with proper formatting
    pdf.set_text_color(60, 60, 60)
    parse_and_render_markdown(pdf, feedback, base_font_size=11)
    pdf.ln(10)
    
    # Page break before biometrics
    pdf.add_page()
    
    # Biometrics Table
    pdf.set_font('Helvetica', 'B', 18)
    pdf.set_text_color(0, 100, 180)
    pdf.cell(0, 12, 'Technical Biometrics Summary', 0, 1, 'C')
    pdf.ln(8)
    pdf.set_text_color(60, 60, 60)
    
    summary = metrics_df.describe().T[['mean', 'max', 'min']]
    summary.index.name = 'Metric Name'
    
    # Table Header
    col_width = pdf.w / 4.5
    pdf.set_fill_color(20, 120, 200)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font('Helvetica', 'B', 11)
    pdf.cell(col_width + 10, 10, 'Biometric Metric', 1, 0, 'C', 1)
    pdf.cell(col_width - 10, 10, 'Average', 1, 0, 'C', 1)
    pdf.cell(col_width - 10, 10, 'Max Value', 1, 0, 'C', 1)
    pdf.cell(col_width - 10, 10, 'Min Value', 1, 1, 'C', 1)
    
    # Table Rows
    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(60, 60, 60)
    row_color = True
    for index, row in summary.iterrows():
        if row_color:
            pdf.set_fill_color(245, 245, 245)
        else:
            pdf.set_fill_color(255, 255, 255)
        
        pdf.cell(col_width + 10, 9, str(index), 1, 0, 'L', 1)
        pdf.cell(col_width - 10, 9, f"{row['mean']:.2f}", 1, 0, 'C', 1)
        pdf.cell(col_width - 10, 9, f"{row['max']:.2f}", 1, 0, 'C', 1)
        pdf.cell(col_width - 10, 9, f"{row['min']:.2f}", 1, 1, 'C', 1)
        row_color = not row_color
    
    pdf.ln(10)
    
    # Posture Images
    if images:
        pdf.add_page()
        pdf.set_font('Helvetica', 'B', 18)
        pdf.set_text_color(0, 100, 180)
        pdf.cell(0, 12, 'Key Bowling Action Frames', 0, 1, 'C')
        pdf.ln(5)
        
        for label, img_arr in images.items():
            pdf.set_font('Helvetica', 'B', 13)
            pdf.set_text_color(0, 150, 200)
            pdf.cell(0, 10, f'{label}', 0, 1, 'L')
            pdf.set_text_color(60, 60, 60)
            
            img = Image.fromarray(img_arr)
            pdf.image(img, x=15, w=180)
            pdf.ln(8)
            
    return bytes(pdf.output())
