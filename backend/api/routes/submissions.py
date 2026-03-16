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

import logging
import importlib
import os
import re
import shutil
import tempfile
import uuid
from pathlib import Path
from datetime import datetime

import cv2
import numpy as np
import pandas as pd
import google.cloud.storage as gcs
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.user import User
from database.models.submission import VideoSubmission, SubmissionStatus
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
except ImportError:
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
except ImportError:
    BATTING_ENGINE_AVAILABLE = False
    BATTING_MEDIAPIPE_AVAILABLE = False

logger = logging.getLogger(__name__)

router = APIRouter()

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
    if _GCS_BUCKET_NAME:
        _gcs_client = gcs.Client()
        _gcs_bucket_upload = _gcs_client.bucket(_GCS_BUCKET_NAME)
        logger.info("Submissions GCS client ready — bucket '%s'", _GCS_BUCKET_NAME)
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
    """Return all users with role=COACH (for player's upload dropdown)."""
    coaches = (
        db.query(User)
        .filter(User.role == "COACH", User.is_active == True, User.deleted_at == None)
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
    PENDING → PROCESSING → DRAFT_REVIEW
    """
    if current_user.role not in ("COACH", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only coaches can run analysis.")

    sub = get_submission_by_id(db, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")
    if sub.coach_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not your submission to analyze.")
    if sub.status != SubmissionStatus.PENDING:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot analyze — current status is {sub.status.value}. Only PENDING submissions can be analyzed.",
        )

    # Mark PROCESSING
    mark_processing(db, sub)

    # Resolve video file path on disk
    video_file_path = sub.video_url.replace("/static/submissions/", "storage/submissions/")

    if not os.path.isfile(video_file_path):
        raise HTTPException(status_code=404, detail="Video file not found on disk.")

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

        # Save PDF
        report_filename = f"submission_report_{sub.id}.pdf"
        report_path = REPORTS_DIR / report_filename
        with open(report_path, "wb") as f:
            f.write(pdf_bytes)

        pdf_report_url = f"/static/reports/{report_filename}"

        publish_submission(
            db,
            sub,
            coach_final_text=edited_text,
            pdf_report_url=pdf_report_url,
        )

        logger.info("Submission %s published by coach %s", sub.id, current_user.id)
        return _to_detail(sub)

    except Exception as e:
        error_msg = f"Publish failed: {type(e).__name__}: {str(e)}"
        logger.exception("PUBLISH ERROR — %s", error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


#  DETAIL: Get single submission
@router.get("/{submission_id}", response_model=SubmissionDetail)
def get_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get full submission detail.
    - Player can see own submissions (PUBLISHED shows everything, others show status only).
    - Coach can see submissions assigned to them.
    """
    sub = get_submission_by_id(db, submission_id)
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
    ai_text = _batting_gemini.call_gemini(prompt, video_path) if _batting_gemini else "AI feedback unavailable."
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
    ai_text = _bowling_gemini.call_gemini(prompt, video_path) if _bowling_gemini else "AI feedback unavailable."
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
