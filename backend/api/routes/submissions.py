"""
Video Submission API Routes 

Player:
  POST   /upload            — Upload video + select coach → PENDING
  GET    /player/me         — My published reports (player view)
  GET    /{id}              — Single submission detail

Coach:
  GET    /coach/me          — Inbox (PENDING + DRAFT_REVIEW)
  POST   /{id}/analyze      — Trigger AI analysis → PROCESSING → DRAFT_REVIEW
  PUT    /{id}/publish      — Approve edited text → PUBLISHED (generates PDF)

Shared:
  GET    /coaches           — List available coaches (for player's dropdown)
"""

from __future__ import annotations

import logging
import importlib
import os
import re
import shutil
import tempfile
import uuid
import base64
import binascii
from collections import Counter
from pathlib import Path
from datetime import datetime
from uuid import UUID

try:
    import cv2
    _CV2_AVAILABLE = True
    _CV2_IMPORT_ERROR = ""
except Exception as _cv2_err:
    cv2 = None
    _CV2_AVAILABLE = False
    _CV2_IMPORT_ERROR = str(_cv2_err)

try:
    import numpy as np
    _NP_AVAILABLE = True
    _NP_IMPORT_ERROR = ""
except Exception as _np_err:
    np = None
    _NP_AVAILABLE = False
    _NP_IMPORT_ERROR = str(_np_err)

try:
    import pandas as pd
    _PD_AVAILABLE = True
    _PD_IMPORT_ERROR = ""
except Exception as _pd_err:
    pd = None
    _PD_AVAILABLE = False
    _PD_IMPORT_ERROR = str(_pd_err)

try:
    import google.cloud.storage as gcs
    _GCS_LIB_AVAILABLE = True
    _GCS_IMPORT_ERROR = ""
except Exception as _gcs_err:
    gcs = None
    _GCS_LIB_AVAILABLE = False
    _GCS_IMPORT_ERROR = str(_gcs_err)
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.player_submission import PlayerSubmission
from database.models.user import User
from database.models.subscription import Subscription
from database.models.submission import VideoSubmission, SubmissionStatus
from database.models.video import Video
from database.crud.submission import (
    create_submission,
    get_submission_by_id,
    list_submissions_for_player,
    list_submissions_for_coach,
    mark_processing,
    save_analysis_results,
    publish_submission,
)
from schemas.submission import (
    PublishRequest,
    SubmissionSummary,
    SubmissionListResponse,
    SubmissionDetail,
    CoachListItem,
    CoachListResponse,
)
from dependencies.feature_gate import require_feature
from dependencies.quota_gate import quota_check, increment_usage_atomic
from utils.auth import get_current_user

# Engine imports
try:
    from scripts.bowling_engine import (
        CricketPoseAnalyzer,
        GeminiManager,
        create_pdf,
        MEDIAPIPE_AVAILABLE,
        BOWLING_ANALYSIS_PROMPT,
        extract_bowling_flaws,
        extract_bowling_drills,
    )
    BOWLING_ENGINE_AVAILABLE = True
except Exception:
    BOWLING_ENGINE_AVAILABLE = False
    MEDIAPIPE_AVAILABLE = False

try:
    from scripts.batting_engine import (
        BattingPoseAnalyzer,
        BattingGeminiManager,
        create_batting_pdf,
        BATTING_MEDIAPIPE_AVAILABLE,
        BATTING_ANALYSIS_PROMPT,
        extract_detected_flaws,
        extract_drill_recommendations,
    )
    BATTING_ENGINE_AVAILABLE = True
except Exception:
    BATTING_ENGINE_AVAILABLE = False
    BATTING_MEDIAPIPE_AVAILABLE = False

logger = logging.getLogger(__name__)

router = APIRouter()
public_router = APIRouter(tags=["submissions-public"])

_COACH_SUBMISSION_TIERS = ("coach_starter", "coach_pro", "academy")


# ── Pydantic Models (must be defined before endpoints) ──────────────────────

class PlayerSubmissionCreate(BaseModel):
    coach_id: str
    note: str | None = None
    job_id: str | None = None


class PlayerSubmissionItem(BaseModel):
    id: str
    coach_name: str | None = None
    job_id: str | None = None
    status: str
    note: str | None = None
    created_at: str
    reviewed_at: str | None = None


class PlayerSubmissionListResponse(BaseModel):
    submissions: list[PlayerSubmissionItem]
    total: int


class PlayerProgressPlayer(BaseModel):
    id: str
    name: str
    email: str
    team: str | None = None


class PlayerProgressSummary(BaseModel):
    total_submissions: int
    published_reports: int
    batting_submissions: int
    bowling_submissions: int
    completion_rate: float
    days_since_last_submission: int | None
    improvement_trend: str


class PlayerProgressFlaw(BaseModel):
    flaw: str
    count: int


class PlayerProgressFlawTrend(BaseModel):
    first_report_flaw_count: int
    latest_report_flaw_count: int
    delta: int
    trend: str


class PlayerProgressTimelineItem(BaseModel):
    id: str
    analysis_type: str
    status: str
    created_at: str
    published_at: str | None = None
    flaw_count: int
    pdf_report_url: str | None = None


class PlayerProgressResponse(BaseModel):
    player: PlayerProgressPlayer
    summary: PlayerProgressSummary
    flaw_frequency: list[PlayerProgressFlaw]
    flaw_trend: PlayerProgressFlawTrend | None
    submission_timeline: list[PlayerProgressTimelineItem]

#  Storage dirs — use /tmp/ on Cloud Run (ephemeral), local storage/ for dev
_USE_TMP = os.getenv("CLOUD_RUN", "").lower() in ("1", "true", "yes")
if _USE_TMP:
    _tmp = Path(tempfile.gettempdir())
    SUBMISSIONS_DIR = _tmp / "submissions"
    REPORTS_DIR = _tmp / "reports"
    ANNOTATED_DIR = _tmp / "submission_videos"
    TEMP_FRAMES_DIR = _tmp / "temp_frames"
else:
    SUBMISSIONS_DIR = Path("storage/submissions")
    REPORTS_DIR = Path("storage/reports")
    ANNOTATED_DIR = Path("storage/submission_videos")
    TEMP_FRAMES_DIR = Path("storage/temp_frames")

for d in [SUBMISSIONS_DIR, REPORTS_DIR, ANNOTATED_DIR, TEMP_FRAMES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# GCS client for B2B2C uploads (POST /upload → GCS instead of local disk)
_GCS_BUCKET_NAME: str = os.getenv("GCS_BUCKET_NAME", "")
_gcs_client = None
_gcs_bucket_upload = None
try:
    if _GCS_BUCKET_NAME and _GCS_LIB_AVAILABLE:
        _gcs_client = gcs.Client()
        _gcs_bucket_upload = _gcs_client.bucket(_GCS_BUCKET_NAME)
        logger.info("Submissions GCS client ready — bucket '%s'", _GCS_BUCKET_NAME)
    elif _GCS_BUCKET_NAME and not _GCS_LIB_AVAILABLE:
        logger.warning(
            "Submissions GCS client unavailable — google-cloud-storage missing (%s)",
            _GCS_IMPORT_ERROR,
        )
except Exception as _gcs_init_err:
    logger.warning("Submissions GCS client init failed: %s", _gcs_init_err)

#  Singleton engines (heavy init — reuse) 
_bowling_analyzer = CricketPoseAnalyzer() if BOWLING_ENGINE_AVAILABLE and MEDIAPIPE_AVAILABLE else None
_bowling_gemini = GeminiManager() if BOWLING_ENGINE_AVAILABLE else None

_batting_analyzer = BattingPoseAnalyzer() if BATTING_ENGINE_AVAILABLE and BATTING_MEDIAPIPE_AVAILABLE else None
_batting_gemini = BattingGeminiManager() if BATTING_ENGINE_AVAILABLE else None

_videos_search_cls = None
try:
    _yt_module = importlib.import_module("youtubesearchpython")
    _videos_search_cls = getattr(_yt_module, "VideosSearch", None)
except Exception:
    _videos_search_cls = None

if _videos_search_cls is None:
    logger.warning("Tutorial resolver init — youtubesearchpython unavailable; will rely on yt-dlp/search fallback")
else:
    logger.info("Tutorial resolver init — youtubesearchpython VideosSearch available")


def _resolve_video_path(video_url: str) -> str:
    """
    Resolve video_url (which may be a GCS blob path or local path) to a local file path.
    
    - If video_url starts with gs:// or is a GCS blob path, download it to temp storage
    - If video_url is /static/submissions/, replace with storage/submissions/
    - Otherwise, assume it's already a valid local path
    
    Returns the local file path for Gemini API upload.
    """
    # Case 1: GCS blob path (e.g., "raw_videos/abc123_filename.mp4")
    if _gcs_bucket_upload and not video_url.startswith(("http://", "https://", "/", "gs://")):
        try:
            logger.info("Downloading GCS video: %s", video_url)
            blob = _gcs_bucket_upload.blob(video_url)
            
            # Download to temp storage
            temp_filename = f"temp_{uuid.uuid4()}_{Path(video_url).name}"
            local_path = TEMP_FRAMES_DIR / temp_filename  # Use temp frames dir for temporary videos
            with open(local_path, "wb") as f:
                blob.download_to_file(f)
            
            logger.info("Downloaded GCS video to %s", local_path)
            return str(local_path)
        except Exception as e:
            logger.error("Failed to download GCS video %s: %s", video_url, e)
            raise HTTPException(status_code=500, detail=f"Failed to download video: {e}")
    
    # Case 2: Local /static/ path
    if video_url.startswith("/static/submissions/"):
        video_file_path = video_url.replace("/static/submissions/", "storage/submissions/")
        if not os.path.isfile(video_file_path):
            raise HTTPException(status_code=404, detail="Video file not found on disk.")
        return video_file_path
    
    # Case 3: Assume already a valid local path
    if not os.path.isfile(video_url):
        raise HTTPException(status_code=404, detail=f"Video file not found: {video_url}")
    return video_url


def _is_specific_youtube_link(url: str) -> bool:
    """Return True if URL looks like a concrete YouTube video URL."""
    u = (url or "").strip().lower()
    return (
        "youtube.com/watch?v=" in u
        or "youtu.be/" in u
        or "youtube.com/shorts/" in u
    )


#  HELPERS
def _gcs_to_signed_url(gs_uri: str | None) -> str | None:
    """
    Convert a ``gs://bucket/blob`` URI into a publicly accessible HTTPS URL.

    New uploads store the public URL directly, so this only runs for legacy
    DB records that still hold a ``gs://`` URI.
    Bucket has Uniform Bucket-Level Access enabled — we cannot use object ACLs
    or generate_signed_url(). Instead we construct the deterministic public URL.
    """
    if not gs_uri or not gs_uri.startswith("gs://"):
        return gs_uri
    without_scheme = gs_uri[5:]  # strip "gs://"
    bucket_name, _, blob_name = without_scheme.partition("/")
    return f"https://storage.googleapis.com/{bucket_name}/{blob_name}"


def _to_summary(sub: VideoSubmission) -> SubmissionSummary:
    return SubmissionSummary(
        id=sub.id,
        player_id=sub.player_id,
        coach_id=sub.coach_id,
        player_name=sub.player.name if sub.player else None,
        coach_name=sub.coach.name if sub.coach else None,
        original_filename=sub.original_filename,
        analysis_type=sub.analysis_type,
        status=sub.status.value if isinstance(sub.status, SubmissionStatus) else sub.status,
        created_at=sub.created_at,
        analyzed_at=sub.analyzed_at,
        published_at=sub.published_at,
        pdf_report_url=_gcs_to_signed_url(sub.pdf_report_url),
    )


def _to_detail(sub: VideoSubmission) -> SubmissionDetail:
    source_text = sub.coach_final_text or sub.ai_draft_text or ""
    if sub.analysis_type == "BOWLING":
        flaws = extract_bowling_flaws(source_text) if BOWLING_ENGINE_AVAILABLE else []
        drills = extract_bowling_drills(source_text) if BOWLING_ENGINE_AVAILABLE else []
    else:
        flaws = extract_detected_flaws(source_text) if BATTING_ENGINE_AVAILABLE else []
        drills = extract_drill_recommendations(source_text) if BATTING_ENGINE_AVAILABLE else []

    return SubmissionDetail(
        id=sub.id,
        player_id=sub.player_id,
        coach_id=sub.coach_id,
        player_name=sub.player.name if sub.player else None,
        coach_name=sub.coach.name if sub.coach else None,
        original_filename=sub.original_filename,
        analysis_type=sub.analysis_type,
        status=sub.status.value if isinstance(sub.status, SubmissionStatus) else sub.status,
        video_url=sub.video_url,
        raw_biometrics=sub.raw_biometrics,
        phase_info=sub.phase_info,
        annotated_video_url=_gcs_to_signed_url(sub.annotated_video_url),
        key_frame_url=_gcs_to_signed_url(sub.key_frame_url),
        ai_draft_text=sub.ai_draft_text,
        coach_final_text=sub.coach_final_text,
        detected_flaws=flaws,
        drill_recommendations=drills,
        pdf_report_url=_gcs_to_signed_url(sub.pdf_report_url),
        created_at=sub.created_at,
        analyzed_at=sub.analyzed_at,
        published_at=sub.published_at,
    )


def _require_analysis_libs() -> None:
    missing = []
    if not _CV2_AVAILABLE:
        missing.append("opencv-python-headless")
    if not _NP_AVAILABLE:
        missing.append("numpy")
    if not _PD_AVAILABLE:
        missing.append("pandas")
    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"Analysis dependencies missing: {', '.join(missing)}",
        )


def _extract_flaws_for_progress(sub: VideoSubmission) -> list[dict]:
    source_text = sub.coach_final_text or sub.ai_draft_text or ""
    if not source_text:
        return []
    if sub.analysis_type == "BOWLING":
        return extract_bowling_flaws(source_text) if BOWLING_ENGINE_AVAILABLE else []
    return extract_detected_flaws(source_text) if BATTING_ENGINE_AVAILABLE else []


def _days_since(date_value: datetime | None) -> int | None:
    if not date_value:
        return None
    now = datetime.utcnow()
    if date_value.tzinfo is not None:
        now = datetime.now(date_value.tzinfo)
    delta = now - date_value
    return max(0, delta.days)


def _to_timestamp(date_value: datetime | None) -> float:
    if not date_value:
        return 0.0
    try:
        return date_value.timestamp()
    except Exception:
        return 0.0


def _build_player_progress(db: Session, player: User) -> dict:
    submissions = (
        db.query(VideoSubmission)
        .filter(VideoSubmission.player_id == player.id)
        .order_by(VideoSubmission.created_at.desc())
        .all()
    )

    total = len(submissions)
    published = [
        s
        for s in submissions
        if (s.status.value if isinstance(s.status, SubmissionStatus) else s.status)
        == SubmissionStatus.PUBLISHED.value
    ]
    batting = sum(1 for s in submissions if s.analysis_type == "BATTING")
    bowling = sum(1 for s in submissions if s.analysis_type == "BOWLING")
    completion_rate = round((len(published) / total) * 100, 1) if total else 0

    last_created = submissions[0].created_at if submissions else None
    days_since_last = _days_since(last_created)

    flaw_counter: Counter[str] = Counter()
    flaw_labels: dict[str, str] = {}
    timeline = []
    published_with_flaws = []

    for sub in submissions:
        flaws = _extract_flaws_for_progress(sub)
        flaw_count = len(flaws)

        for flaw in flaws:
            name = str(flaw.get("flaw_name") or "Unknown").strip()
            key = name.lower() if name else "unknown"
            flaw_counter[key] += 1
            flaw_labels.setdefault(key, name or "Unknown")

        status_value = sub.status.value if isinstance(sub.status, SubmissionStatus) else sub.status

        timeline.append(
            {
                "id": sub.id,
                "analysis_type": sub.analysis_type,
                "status": status_value,
                "created_at": sub.created_at.isoformat() if sub.created_at else "",
                "published_at": sub.published_at.isoformat() if sub.published_at else None,
                "flaw_count": flaw_count,
                "pdf_report_url": _gcs_to_signed_url(sub.pdf_report_url),
            }
        )

        if status_value == SubmissionStatus.PUBLISHED.value:
            published_with_flaws.append((sub, flaw_count))

    flaw_frequency = [
        {"flaw": flaw_labels[key], "count": count}
        for key, count in flaw_counter.most_common()
    ]

    flaw_trend = None
    improvement_trend = "steady"
    if published_with_flaws:
        published_with_flaws.sort(
            key=lambda item: _to_timestamp(item[0].published_at or item[0].created_at)
        )
        first_count = published_with_flaws[0][1]
        latest_count = published_with_flaws[-1][1]
        delta = latest_count - first_count
        if delta < 0:
            trend = "improving"
        elif delta > 0:
            trend = "worsening"
        else:
            trend = "steady"
        flaw_trend = {
            "first_report_flaw_count": first_count,
            "latest_report_flaw_count": latest_count,
            "delta": delta,
            "trend": trend,
        }
        improvement_trend = trend

    return {
        "player": {
            "id": player.id,
            "name": player.name,
            "email": player.email,
            "team": player.team,
        },
        "summary": {
            "total_submissions": total,
            "published_reports": len(published),
            "batting_submissions": batting,
            "bowling_submissions": bowling,
            "completion_rate": completion_rate,
            "days_since_last_submission": days_since_last,
            "improvement_trend": improvement_trend,
        },
        "flaw_frequency": flaw_frequency,
        "flaw_trend": flaw_trend,
        "submission_timeline": timeline,
    }


def _save_key_frame(video_path: str, submission_id: str, frame_idx: int | None) -> str | None:
    """Extract a single frame from the video and save as JPEG."""
    if frame_idx is None:
        return None
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    cap.release()
    if not ret:
        return None
    out_path = TEMP_FRAMES_DIR / f"{submission_id}.jpg"
    cv2.imwrite(str(out_path), frame)
    return f"/static/temp_frames/{submission_id}.jpg"


def _append_tutorial_links(ai_text: str, drills: list[dict]) -> str:
    """Rewrite tutorial section with concrete Title/Link/Why blocks (app.py-style)."""
    if not drills:
        return ai_text

    lines = ["**RECOMMENDED TUTORIALS**"]
    for idx, drill in enumerate(drills, start=1):
        title = str(drill.get("title", "Tutorial")).strip() or "Tutorial"
        link = str(drill.get("link", "")).strip()
        reason = str(drill.get("reason", "To improve the identified weakness.")).strip()
        if not link:
            continue
        lines.append(f"{idx}. Title: {title}")
        lines.append(f"   Link: {link}")
        lines.append(f"   Why: {reason}")
        lines.append("")

    if len(lines) <= 1:
        return ai_text

    tutorials_block = "\n".join(lines).rstrip()

    # Replace existing tutorial section if present, otherwise append at end.
    if "**RECOMMENDED TUTORIAL" in ai_text.upper():
        parts = re.split(r"\*\*RECOMMENDED TUTORIALS?\*\*", ai_text, flags=re.IGNORECASE)
        base_report = parts[0].rstrip()
        return f"{base_report}\n\n{tutorials_block}"

    return f"{ai_text.rstrip()}\n\n{tutorials_block}"


def _post_process_report_with_video_links(report_text: str, discipline: str) -> tuple[str, list[dict]]:
    """App.py-style conversion of Search Intent lines into specific YouTube Title/Link entries."""
    marker = "**RECOMMENDED TUTORIAL"
    if marker not in report_text.upper():
        return report_text, []

    try:
        if "**RECOMMENDED TUTORIALS**" in report_text:
            parts = report_text.split("**RECOMMENDED TUTORIALS**")
            header = "**RECOMMENDED TUTORIALS**"
        else:
            parts = re.split(r"\*\*RECOMMENDED TUTORIALS?\*\*", report_text, flags=re.IGNORECASE)
            header = "**RECOMMENDED TUTORIALS**"

        base_report = parts[0].rstrip()
        tutorial_content = "".join(parts[1:])

        search_intents = re.findall(r"Search Intent:\s*(.*)", tutorial_content, flags=re.IGNORECASE)
        whys = re.findall(r"Why this video:\s*(.*)", tutorial_content, flags=re.IGNORECASE)

        drills: list[dict] = []
        specific_count = 0
        search_count = 0
        for i, raw_intent in enumerate(search_intents):
            intent = raw_intent.strip().strip("*_`[]() ")
            why = whys[i].strip() if i < len(whys) else "To improve your technique."

            title = f"{discipline.title()} Tutorial: {intent}"
            link = ""
            source = "none"

            logger.info(
                "Tutorial resolver start — discipline=%s idx=%s intent=%s",
                discipline,
                i + 1,
                intent,
            )

            try:
                if "youtube.com" in intent.lower() or "youtu.be" in intent.lower():
                    urls = re.findall(r"(https?://[^\s]+)", intent)
                    link = urls[0] if urls else intent
                    title = f"Specific Tutorial: {intent.split('http')[0].strip() or 'Video'}"
                    source = "intent-url"
                else:
                    full_query = f"{intent} cricket {discipline.upper()} tutorial"
                    if _videos_search_cls is not None:
                        try:
                            result = _videos_search_cls(full_query, limit=1).result().get("result", [])
                            if result:
                                title = str(result[0].get("title", title)).strip()
                                link = str(result[0].get("link", "")).strip()
                                source = "videossearch"
                                logger.info(
                                    "Tutorial resolver videossearch hit — discipline=%s idx=%s has_link=%s",
                                    discipline,
                                    i + 1,
                                    bool(link),
                                )
                            else:
                                logger.info(
                                    "Tutorial resolver videossearch empty — discipline=%s idx=%s query=%s",
                                    discipline,
                                    i + 1,
                                    full_query,
                                )
                        except Exception as vs_err:
                            logger.warning(
                                "Tutorial resolver videossearch failed — discipline=%s idx=%s err=%s",
                                discipline,
                                i + 1,
                                vs_err,
                            )
                    else:
                        logger.info(
                            "Tutorial resolver videossearch unavailable — discipline=%s idx=%s",
                            discipline,
                            i + 1,
                        )

                    # Fallback: yt-dlp live search for concrete watch URL.
                    if not link:
                        try:
                            yt_dlp = importlib.import_module("yt_dlp")
                            with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as ydl:
                                info = ydl.extract_info(f"ytsearch1:{full_query}", download=False)
                                entries = (info or {}).get("entries") or []
                                if entries:
                                    entry = entries[0] or {}
                                    title = str(entry.get("title") or title).strip()
                                    link = str(entry.get("webpage_url") or entry.get("url") or "").strip()
                                    if link and not link.startswith("http"):
                                        link = f"https://www.youtube.com/watch?v={link}"
                                    source = "yt-dlp"
                                    logger.info(
                                        "Tutorial resolver yt-dlp hit — discipline=%s idx=%s has_link=%s",
                                        discipline,
                                        i + 1,
                                        bool(link),
                                    )
                                else:
                                    logger.info(
                                        "Tutorial resolver yt-dlp empty — discipline=%s idx=%s query=%s",
                                        discipline,
                                        i + 1,
                                        full_query,
                                    )
                        except Exception as e:
                            logger.warning(
                                "Tutorial resolver yt-dlp failed — discipline=%s idx=%s err=%s",
                                discipline,
                                i + 1,
                                e,
                            )

                    if not link:
                        logger.warning(
                            "Tutorial resolver no direct result — discipline=%s idx=%s query=%s",
                            discipline,
                            i + 1,
                            full_query,
                        )
                        raise RuntimeError("No direct result")
            except Exception as resolve_err:
                query_encoded = intent.replace(" ", "+") + f"+cricket+{discipline.lower()}+tutorial"
                link = f"https://www.youtube.com/results?search_query={query_encoded}"
                source = "search-fallback"
                logger.warning(
                    "Tutorial resolver fallback engaged — discipline=%s idx=%s err=%s",
                    discipline,
                    i + 1,
                    resolve_err,
                )

            if _is_specific_youtube_link(link):
                specific_count += 1
            else:
                search_count += 1

            logger.info(
                "Tutorial resolver result — discipline=%s idx=%s source=%s specific=%s link=%s",
                discipline,
                i + 1,
                source,
                _is_specific_youtube_link(link),
                link,
            )

            drills.append(
                {
                    "query": intent,
                    "title": title,
                    "link": link,
                    "reason": why,
                }
            )

        # If model ignored Search Intent format, keep any existing parsed drills.
        if not drills:
            if discipline == "bowling" and BOWLING_ENGINE_AVAILABLE:
                drills = extract_bowling_drills(report_text)
            elif BATTING_ENGINE_AVAILABLE:
                drills = extract_drill_recommendations(report_text)

        if not drills:
            return report_text, []

        logger.info(
            "Tutorial resolver summary — discipline=%s total=%s specific=%s search_links=%s",
            discipline,
            len(drills),
            specific_count,
            search_count,
        )

        new_section_lines = [header]
        for idx, d in enumerate(drills, start=1):
            new_section_lines.append(f"{idx}. **Title**: {d['title']}")
            new_section_lines.append(f"   **Link**: {d['link']}")
            new_section_lines.append(f"   **Why**: {d['reason']}")
            new_section_lines.append("")

        rewritten = f"{base_report}\n\n" + "\n".join(new_section_lines).rstrip()
        return rewritten, drills
    except Exception as e:
        logger.debug("Tutorial post-processing failed (%s): %s", discipline, e)
        return report_text, []


#  SHARED: List Coaches
@router.get("/coaches", response_model=CoachListResponse)
def list_coaches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return coaches who can actually receive submissions."""
    coaches = (
        db.query(User)
        .join(Subscription, Subscription.user_id == User.id)
        .filter(
            User.role == "COACH",
            User.is_active == True,
            User.deleted_at == None,
            Subscription.status == "active",
            Subscription.role.in_(_COACH_SUBMISSION_TIERS),
        )
        .distinct(User.id)
        .all()
    )
    return CoachListResponse(
        coaches=[
            CoachListItem(id=c.id, name=c.name, email=c.email, team=c.team)
            for c in coaches
        ]
    )


@public_router.get("/coaches", response_model=CoachListResponse)
def list_coaches_public(db: Session = Depends(get_db)):
    coaches = (
        db.query(User)
        .join(Subscription, Subscription.user_id == User.id)
        .filter(
            User.role == "COACH",
            User.is_active == True,
            User.deleted_at == None,
            Subscription.status == "active",
            Subscription.role.in_(_COACH_SUBMISSION_TIERS),
        )
        .distinct(User.id)
        .all()
    )
    return CoachListResponse(
        coaches=[
            CoachListItem(id=c.id, name=c.name, email=c.email, team=c.team)
            for c in coaches
        ]
    )


#  PLAYER: Upload
@router.post("/upload", response_model=SubmissionDetail)
async def player_upload(
    file: UploadFile = File(...),
    coach_id: str = Form(...),
    analysis_type: str = Form("BATTING"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Player uploads a video and selects a coach.
    Creates a new submission in PENDING state.
    """
    # Validate role
    if current_user.role not in ("PLAYER", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only players can upload submissions.")

    # Validate file type
    if not file.filename or not file.filename.lower().endswith(('.mp4', '.mov', '.avi')):
        raise HTTPException(status_code=400, detail="Invalid file type. Upload MP4, MOV, or AVI.")

    # Validate analysis type
    if analysis_type not in ("BATTING", "BOWLING"):
        raise HTTPException(status_code=400, detail="analysis_type must be BATTING or BOWLING.")

    # Validate coach exists and has COACH role
    coach = db.query(User).filter(User.id == coach_id, User.role == "COACH").first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found.")

    # Upload to GCS (Cloud Run) or local disk (dev)
    file_id = str(uuid.uuid4())[:12]
    safe_name = "".join(
        c if c.isalnum() or c in "._-" else "_"
        for c in (file.filename or "upload.mp4")
    )

    if _gcs_bucket_upload is not None:
        blob_name = f"raw_videos/{file_id}_{safe_name}"
        try:
            content = await file.read()
            blob = _gcs_bucket_upload.blob(blob_name)
            blob.upload_from_string(content, content_type=file.content_type or "video/mp4")
            video_url = blob_name  # GCS object path — used by the worker
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to upload to GCS: {e}")
    else:
        # Local dev fallback — save to disk
        safe_filename = f"{file_id}_{safe_name}"
        save_path = SUBMISSIONS_DIR / safe_filename
        try:
            content = await file.read()
            with open(save_path, "wb") as buffer:
                buffer.write(content)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save video: {e}")
        video_url = f"/static/submissions/{safe_filename}"

    sub = create_submission(
        db,
        player_id=current_user.id,
        coach_id=coach_id,
        original_filename=file.filename,
        video_url=video_url,
        analysis_type=analysis_type,
    )

    logger.info(
        "Submission %s created: player=%s coach=%s type=%s",
        sub.id, current_user.id, coach_id, analysis_type,
    )
    return _to_detail(sub)


#  PLAYER: Submit existing gallery video (no re-upload)
@router.post("/from-video", response_model=SubmissionDetail)
def player_submit_existing_video(
    video_id: str = Form(...),
    coach_id: str = Form(...),
    analysis_type: str = Form("BATTING"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Player submits an already-uploaded private gallery video to a coach.

    This does NOT upload the file again; it links the existing video into a new submission.
    """
    if current_user.role not in ("PLAYER", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only players can submit videos.")

    if analysis_type not in ("BATTING", "BOWLING"):
        raise HTTPException(status_code=400, detail="analysis_type must be BATTING or BOWLING.")

    coach = db.query(User).filter(User.id == coach_id, User.role == "COACH").first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found.")

    video = db.query(Video).filter(Video.id == video_id, Video.deleted_at == None).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")

    if str(video.uploaded_by) != str(current_user.id) and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Access denied.")

    # Map local stored path to a served URL; keep remote URLs unchanged.
    file_path = str(video.file_path or "")
    if file_path.startswith("http://") or file_path.startswith("https://"):
        video_url = file_path
    else:
        # Typical stored value is "storage/uploads/<uuid>.ext"
        name = Path(file_path).name if file_path else ""
        video_url = f"/static/uploads/{name}" if name else file_path

    original_name = video.title or f"{video.id}.mp4"

    sub = create_submission(
        db,
        player_id=current_user.id,
        coach_id=coach_id,
        original_filename=original_name,
        video_url=video_url,
        analysis_type=analysis_type,
    )

    logger.info(
        "Submission %s created from existing video: player=%s video=%s coach=%s type=%s",
        sub.id, current_user.id, video.id, coach_id, analysis_type,
    )
    return _to_detail(sub)


#  PLAYER: My Published Reports
@router.get("/player/me", response_model=SubmissionListResponse)
def player_reports(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Player sees only PUBLISHED submissions."""
    items, total = list_submissions_for_player(
        db, current_user.id, limit=limit, offset=offset,
    )
    return SubmissionListResponse(
        submissions=[_to_summary(s) for s in items],
        total=total,
    )


#  PLAYER: All my submissions (all statuses)
@router.get("/player/all", response_model=SubmissionListResponse)
def player_all_submissions(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Player sees all submissions (including pending/processing status indicator)."""
    q = db.query(VideoSubmission).filter(VideoSubmission.player_id == current_user.id)
    total = q.count()
    items = q.order_by(VideoSubmission.created_at.desc()).offset(offset).limit(limit).all()
    return SubmissionListResponse(
        submissions=[_to_summary(s) for s in items],
        total=total,
    )


@router.get("/player/progress", response_model=PlayerProgressResponse)
def player_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("PLAYER", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only players can access this endpoint.")

    return _build_player_progress(db, current_user)


@router.get("/player/{player_id}/progress", response_model=PlayerProgressResponse)
def player_progress_by_id(
    player_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("COACH", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only coaches can access this endpoint.")

    player = db.query(User).filter(User.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if current_user.role == "COACH":
        has_access = (
            db.query(VideoSubmission)
            .filter(
                VideoSubmission.player_id == player_id,
                VideoSubmission.coach_id == current_user.id,
            )
            .first()
        )
        if not has_access:
            raise HTTPException(status_code=404, detail="Player not found")

    return _build_player_progress(db, player)


@public_router.post("/submissions", status_code=201, response_model=PlayerSubmissionItem)
def create_player_submission(
    body: PlayerSubmissionCreate,
    _quota: tuple = Depends(quota_check("player_submission")),
    current_user: User = Depends(require_feature("player_submission")),
    db: Session = Depends(get_db),
) -> PlayerSubmissionItem:
    coach = db.query(User).filter(User.id == body.coach_id, User.role == "COACH").first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    submission = PlayerSubmission(
        player_id=current_user.id,
        coach_id=body.coach_id,
        job_id=body.job_id or None,
        note=body.note,
        status="pending",
    )
    db.add(submission)
    db.flush()

    ok = increment_usage_atomic(current_user.id, "submission_count", "max_submissions_per_month", 1, db)
    if not ok:
        db.rollback()
        raise HTTPException(status_code=429, detail={"error": "quota_exceeded", "reason": "Monthly submission limit reached (concurrent request)."})

    db.commit()
    db.refresh(submission)

    return PlayerSubmissionItem(
        id=submission.id,
        coach_name=coach.name,
        job_id=submission.job_id,
        status=submission.status,
        note=submission.note,
        created_at=submission.created_at.isoformat() if submission.created_at else "",
        reviewed_at=submission.reviewed_at.isoformat() if submission.reviewed_at else None,
    )


@public_router.get("/submissions/my", response_model=PlayerSubmissionListResponse)
def my_player_submissions(
    current_user: User = Depends(require_feature("player_submission")),
    db: Session = Depends(get_db),
) -> PlayerSubmissionListResponse:
    rows = (
        db.query(PlayerSubmission)
        .filter(PlayerSubmission.player_id == current_user.id)
        .order_by(PlayerSubmission.created_at.desc())
        .all()
    )
    return PlayerSubmissionListResponse(
        submissions=[
            PlayerSubmissionItem(
                id=r.id,
                coach_name=r.coach.name if r.coach else None,
                job_id=r.job_id,
                status=r.status,
                note=r.note,
                created_at=r.created_at.isoformat() if r.created_at else "",
                reviewed_at=r.reviewed_at.isoformat() if r.reviewed_at else None,
            )
            for r in rows
        ],
        total=len(rows),
    )


#  COACH: Inbox
@router.get("/coach/me", response_model=SubmissionListResponse)
def coach_inbox(
    status: str | None = Query(None, description="Filter by status: PENDING, DRAFT_REVIEW, PUBLISHED"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Coach inbox: PENDING + DRAFT_REVIEW by default."""
    if current_user.role not in ("COACH", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only coaches can access this endpoint.")

    status_filter = SubmissionStatus(status) if status else None
    items, total = list_submissions_for_coach(
        db, current_user.id, status_filter=status_filter, limit=limit, offset=offset,
    )
    return SubmissionListResponse(
        submissions=[_to_summary(s) for s in items],
        total=total,
    )


#  COACH: Run AI Analysis
@router.post("/{submission_id}/analyze", response_model=SubmissionDetail)
def coach_run_analysis(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Coach triggers AI analysis.
    PENDING or PROCESSING → PROCESSING → DRAFT_REVIEW
    PROCESSING is allowed so coaches can retry stuck submissions.
    """
    if current_user.role not in ("COACH", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only coaches can run analysis.")

    sub = get_submission_by_id(db, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")
    if sub.coach_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not your submission to analyze.")
    if sub.status not in (SubmissionStatus.PENDING, SubmissionStatus.PROCESSING):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot analyze — current status is {sub.status.value}. Only PENDING or PROCESSING submissions can be analyzed.",
        )

    _require_analysis_libs()

    # Mark PROCESSING
    mark_processing(db, sub)

    # Resolve video file path (handles both GCS and local storage)
    try:
        video_file_path = _resolve_video_path(sub.video_url)
    except HTTPException:
        raise
    except Exception as e:
        sub.status = SubmissionStatus.PENDING
        db.commit()
        error_msg = f"Video resolution failed: {type(e).__name__}: {str(e)}"
        logger.exception("VIDEO RESOLUTION ERROR — %s", error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

    try:
        if sub.analysis_type == "BOWLING":
            raw_biometrics, annotated_video_url, ai_draft, phase_info, key_frame_url = (
                _run_bowling_analysis(video_file_path, sub.id)
            )
        else:
            raw_biometrics, annotated_video_url, ai_draft, phase_info, key_frame_url = (
                _run_batting_analysis(video_file_path, sub.id)
            )

        save_analysis_results(
            db,
            sub,
            raw_biometrics=raw_biometrics,
            phase_info=phase_info,
            ai_draft_text=ai_draft,
            annotated_video_url=annotated_video_url,
            key_frame_url=key_frame_url,
        )
        
        # Notify player that analysis is complete
        try:
            from api.routes.notification import create_notification
            create_notification(
                db=db,
                user_id=sub.player_id,
                title="Analysis Complete",
                message=f"Your {sub.analysis_type.lower()} video analysis is ready for coach review",
                notif_type="report"
            )
        except Exception as notif_err:
            logger.warning("Failed to create analysis notification: %s", notif_err)

        logger.info("Analysis complete for submission %s → DRAFT_REVIEW", sub.id)
        return _to_detail(sub)

    except Exception as e:
        # Roll back to PENDING on failure so coach can retry
        sub.status = SubmissionStatus.PENDING
        db.commit()
        error_msg = f"Analysis failed: {type(e).__name__}: {str(e)}"
        logger.exception("SUBMISSION ANALYSIS ERROR — %s", error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


#  COACH: Publish
@router.put("/{submission_id}/publish", response_model=SubmissionDetail)
def coach_publish(
    submission_id: str,
    body: PublishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Coach approves edited text → generates PDF from coach_final_text → PUBLISHED.
    """
    if current_user.role not in ("COACH", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only coaches can publish.")

    sub = get_submission_by_id(db, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")
    if sub.coach_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not your submission to publish.")
    if sub.status != SubmissionStatus.DRAFT_REVIEW:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot publish — current status is {sub.status.value}. Must be DRAFT_REVIEW.",
        )

    edited_text = body.edited_text.strip()
    if not edited_text:
        raise HTTPException(status_code=400, detail="edited_text cannot be empty.")

    _require_analysis_libs()

    # Store sketches if provided
    sketches = body.sketches or []

    try:
        # Build metrics DataFrame from stored raw_biometrics
        metrics_df = pd.DataFrame()
        if sub.raw_biometrics and "records" in sub.raw_biometrics:
            metrics_df = pd.DataFrame(sub.raw_biometrics["records"])

        # Load key frame image if cached
        images: dict[str, np.ndarray] = {}
        key_frame_path = TEMP_FRAMES_DIR / f"{sub.id}.jpg"
        if key_frame_path.exists():
            img = cv2.imread(str(key_frame_path))
            if img is not None:
                images["Key Frame"] = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Convert sketches to images for PDF, preferring captured frame snapshots.
        sketch_images: dict[str, np.ndarray] = {}
        if sketches:
            try:
                # Render each sketch as a photo-like frame + annotation overlay.
                for idx, sketch in enumerate(sketches, start=1):
                    if "coordinates" not in sketch:
                        continue

                    coords = sketch.get("coordinates") or []
                    if len(coords) < 2:
                        continue

                    # Read video timestamp (seconds, float) stored by the frontend.
                    video_ts = sketch.get("timestamp")
                    ts_label = f"@ {float(video_ts):.2f}s" if video_ts is not None else ""

                    base_img: np.ndarray | None = None
                    snapshot_data_url = sketch.get("snapshot_data_url")
                    if isinstance(snapshot_data_url, str) and snapshot_data_url.startswith("data:image"):
                        try:
                            encoded = snapshot_data_url.split(",", 1)[1]
                            decoded = base64.b64decode(encoded)
                            arr = np.frombuffer(decoded, dtype=np.uint8)
                            frame_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                            if frame_bgr is not None:
                                base_img = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                        except (IndexError, ValueError, binascii.Error):
                            base_img = None

                    if base_img is None:
                        if images and "Key Frame" in images:
                            base_img = images["Key Frame"].copy()
                        else:
                            base_img = np.ones((720, 1280, 3), dtype=np.uint8) * 255

                    sketch_canvas = base_img.copy()
                    color = sketch.get("color", "#000000")
                    try:
                        hex_color = str(color).lstrip("#")
                        r = int(hex_color[0:2], 16)
                        g = int(hex_color[2:4], 16)
                        b = int(hex_color[4:6], 16)
                        bgr = (b, g, r)
                    except Exception:
                        bgr = (0, 0, 0)

                    for i in range(len(coords) - 1):
                        pt1 = (int(coords[i]["x"]), int(coords[i]["y"]))
                        pt2 = (int(coords[i + 1]["x"]), int(coords[i + 1]["y"]))
                        cv2.line(sketch_canvas, pt1, pt2, bgr, 3)

                    # Burn timestamp label into the image (BGR color space).
                    if ts_label:
                        font = cv2.FONT_HERSHEY_SIMPLEX
                        font_scale, thickness = 0.7, 2
                        (tw, th), _ = cv2.getTextSize(ts_label, font, font_scale, thickness)
                        # Convert canvas back to BGR for OpenCV overlay then back to RGB.
                        canvas_bgr = cv2.cvtColor(sketch_canvas, cv2.COLOR_RGB2BGR)
                        cv2.rectangle(canvas_bgr, (6, 6), (tw + 14, th + 16), (0, 0, 0), -1)
                        cv2.putText(canvas_bgr, ts_label, (10, th + 10), font, font_scale, (255, 255, 255), thickness)
                        sketch_canvas = cv2.cvtColor(canvas_bgr, cv2.COLOR_BGR2RGB)

                    # Use timestamp in dict key so PDF section heading shows it.
                    section_label = f"Coach Annotation {idx} {ts_label}".strip()
                    sketch_images[section_label] = sketch_canvas

                images.update(sketch_images)
            except Exception as sketch_err:
                logger.warning("Failed to render sketches for PDF: %s", sketch_err)


        # Generate PDF using coach's final text (NOT the AI draft)
        if sub.analysis_type == "BOWLING" and BOWLING_ENGINE_AVAILABLE:
            pdf_bytes = create_pdf(edited_text, metrics_df, images)
        elif BATTING_ENGINE_AVAILABLE:
            pdf_bytes = create_batting_pdf(
                edited_text, metrics_df, images,
                phase_info=sub.phase_info,
            )
        else:
            # Fallback: generate simple text-only PDF
            pdf_bytes = _simple_pdf(edited_text, sub.analysis_type)

        # Save PDF — upload to GCS if available, otherwise serve via static files
        report_filename = f"submission_report_{sub.id}.pdf"
        report_path = REPORTS_DIR / report_filename

        if _gcs_bucket_upload:
            try:
                blob = _gcs_bucket_upload.blob(f"reports/{report_filename}")
                blob.upload_from_string(pdf_bytes, content_type="application/pdf")
                pdf_report_url = f"gs://{_GCS_BUCKET_NAME}/reports/{report_filename}"
            except Exception as gcs_err:
                logger.warning("GCS PDF upload failed, falling back to local: %s", gcs_err)
                with open(report_path, "wb") as f:
                    f.write(pdf_bytes)
                pdf_report_url = f"/static/reports/{report_filename}"
        else:
            with open(report_path, "wb") as f:
                f.write(pdf_bytes)
            pdf_report_url = f"/static/reports/{report_filename}"

        publish_submission(
            db,
            sub,
            coach_final_text=edited_text,
            pdf_report_url=pdf_report_url,
            coach_sketches=sketches,  # Save sketches to DB
        )
        
        # Notify player that report is published
        try:
            from api.routes.notification import create_notification
            create_notification(
                db=db,
                user_id=sub.player_id,
                title="Report Published",
                message=f"Your {sub.analysis_type.lower()} performance report is now available",
                notif_type="report"
            )
        except Exception as notif_err:
            logger.warning("Failed to create publish notification: %s", notif_err)

        logger.info("Submission %s published by coach %s", sub.id, current_user.id)
        return _to_detail(sub)

    except Exception as e:
        error_msg = f"Publish failed: {type(e).__name__}: {str(e)}"
        logger.exception("PUBLISH ERROR — %s", error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


#  DETAIL: Get single submission
@router.get("/{submission_id}", response_model=SubmissionDetail)
def get_submission(
    submission_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get full submission detail.
    - Player can see own submissions (PUBLISHED shows everything, others show status only).
    - Coach can see submissions assigned to them.
    """
    sub = get_submission_by_id(db, str(submission_id))
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")

    is_player = sub.player_id == current_user.id
    is_coach = sub.coach_id == current_user.id
    is_admin = current_user.role == "ADMIN"

    if not (is_player or is_coach or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to view this submission.")

    # Players can only see full detail if PUBLISHED or self-service (player == coach)(testing use case for bowling/batting analysis pages). Self-service uploads (via BowlingAnalysis / BattingAnalysis page) set coach_id = player_id, so the player needs full access to see their own AI results.
    if is_player and not is_coach and sub.status != SubmissionStatus.PUBLISHED:
        # Return a stripped version (player sees status but not AI draft)
        return SubmissionDetail(
            id=sub.id,
            player_id=sub.player_id,
            coach_id=sub.coach_id,
            player_name=sub.player.name if sub.player else None,
            coach_name=sub.coach.name if sub.coach else None,
            original_filename=sub.original_filename,
            analysis_type=sub.analysis_type,
            status=sub.status.value if isinstance(sub.status, SubmissionStatus) else sub.status,
            video_url=sub.video_url,
            created_at=sub.created_at,
            analyzed_at=sub.analyzed_at,
            published_at=sub.published_at,
        )

    return _to_detail(sub)


#  PRIVATE: Analysis Runners
def _run_batting_analysis(
    video_path: str, submission_id: str
) -> tuple[dict, str | None, str, dict, str | None]:
    """Run batting MediaPipe + Gemini. Returns (biometrics, annotated_url, ai_text, phases, key_frame_url)."""
    if not _batting_analyzer:
        raise RuntimeError("Batting analysis engine not available (MediaPipe missing).")

    raw_df, display_df, images, annotated_video_path, phase_info = _batting_analyzer.process_video(video_path)

    if display_df.empty:
        raise ValueError("No batter detected. Ensure full body is visible in the video.")

    # Move annotated video to permanent storage
    annotated_filename = f"sub_{submission_id}_batting_annotated.mp4"
    final_annotated = ANNOTATED_DIR / annotated_filename
    shutil.move(annotated_video_path, final_annotated)
    annotated_url = f"/static/submission_videos/{annotated_filename}"

    # Save key frame (Impact)
    impact_frame = phase_info.get("impact")
    key_frame_url = _save_key_frame(str(final_annotated), submission_id, impact_frame)

    # AI feedback (full prompt includes WEAKNESSES + RECOMMENDED TUTORIALS section)
    prompt = BATTING_ANALYSIS_PROMPT.format(
        metrics_summary=display_df.describe().to_string(),
        phase_info=phase_info,
    )
    if _batting_gemini:
        # Reset key rotation so stale index from prior failures doesn't skip valid keys.
        _batting_gemini.current_index = 0
        logger.info("[SUB] Batting Gemini call (text-only) — submission=%s", submission_id)
        try:
            # Pass video_path=None: the MediaPipe metrics summary in the prompt is
            # already rich enough. Video upload in the submissions context causes
            # Files API key rejections that don't affect the standalone batting route.
            ai_text = _batting_gemini.call_gemini(prompt, None)
        except Exception as gemini_err:
            logger.exception("[SUB] Batting Gemini call failed: %s", gemini_err)
            ai_text = _batting_gemini._fallback_feedback()
    else:
        ai_text = "AI feedback unavailable."
    ai_text, _ = _post_process_report_with_video_links(ai_text, "batting")

    # Pack biometrics for JSON storage
    biometrics = {
        "records": raw_df.to_dict(orient="records") if not raw_df.empty else [],
        # Keep metric-first shape: summary["Metric Name"]["mean"]
        "summary": display_df.describe().T.to_dict(orient="index") if not display_df.empty else {},
    }

    return biometrics, annotated_url, ai_text, phase_info, key_frame_url


def _run_bowling_analysis(
    video_path: str, submission_id: str
) -> tuple[dict, str | None, str, dict, str | None]:
    """Run bowling MediaPipe + Gemini. Returns (biometrics, annotated_url, ai_text, phases, key_frame_url)."""
    if not _bowling_analyzer:
        raise RuntimeError("Bowling analysis engine not available (MediaPipe missing).")

    raw_df, display_df, images, annotated_video_path = _bowling_analyzer.process_video(video_path)

    if display_df.empty:
        raise ValueError("No bowler detected. Ensure full body is visible in the video.")

    # Move annotated video
    annotated_filename = f"sub_{submission_id}_bowling_annotated.mp4"
    final_annotated = ANNOTATED_DIR / annotated_filename
    shutil.move(annotated_video_path, final_annotated)
    annotated_url = f"/static/submission_videos/{annotated_filename}"

    # Save key frame (first captured image or mid-point)
    key_frame_url = None
    if images:
        first_label = list(images.keys())[0]
        img_arr = images[first_label]
        frame_path = TEMP_FRAMES_DIR / f"{submission_id}.jpg"
        img_bgr = cv2.cvtColor(img_arr, cv2.COLOR_RGB2BGR)
        cv2.imwrite(str(frame_path), img_bgr)
        key_frame_url = f"/static/temp_frames/{submission_id}.jpg"

    # AI feedback
    prompt = BOWLING_ANALYSIS_PROMPT.format(
        metrics_summary=display_df.describe().to_string()
    )
    if _bowling_gemini:
        # Reset key rotation so stale index from prior failures doesn't skip valid keys.
        _bowling_gemini.current_index = 0
        logger.info("[SUB] Bowling Gemini call (text-only) — submission=%s", submission_id)
        try:
            # Pass video_path=None: the MediaPipe metrics summary in the prompt is
            # already rich enough. Video upload in the submissions context causes
            # Files API key rejections that don't affect the standalone bowling route.
            ai_text = _bowling_gemini.call_gemini(prompt, None)
        except Exception as gemini_err:
            logger.exception("[SUB] Bowling Gemini call failed: %s", gemini_err)
            ai_text = _bowling_gemini._fallback_feedback()
    else:
        ai_text = "AI feedback unavailable."
    ai_text, _ = _post_process_report_with_video_links(ai_text, "bowling")

    biometrics = {
        "records": raw_df.to_dict(orient="records") if not raw_df.empty else [],
        # Keep metric-first shape: summary["Metric Name"]["mean"]
        "summary": display_df.describe().T.to_dict(orient="index") if not display_df.empty else {},
    }

    return biometrics, annotated_url, ai_text, {}, key_frame_url


def _simple_pdf(text: str, analysis_type: str) -> bytes:
    """Fallback PDF when engine-specific PDF generators aren't available."""
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 15, f"{analysis_type.title()} Analysis Report", 0, 1, "C")
    pdf.ln(10)
    pdf.set_font("Helvetica", "", 12)
    for line in text.split("\n"):
        safe = line.encode("latin-1", "replace").decode("latin-1")
        pdf.multi_cell(0, 7, safe)
    return bytes(pdf.output())
