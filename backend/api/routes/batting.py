"""
Batting Analysis API Routes
Authenticated endpoints for Player role.
"""

import logging
import shutil
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import pandas as pd

from database.config import get_db
from database.crud.batting import (
    create_batting_analysis,
    get_batting_analysis_by_id,
    list_batting_analyses_for_player,
)
from database.models.user import User
from schemas.batting import (
    BattingAnalysisResponse,
    BattingAnalysisListResponse,
    BattingAnalysisSummary,
    BattingBiometricsResponse,
    BattingFeedbackResponse,
    BattingPhaseInfo,
    DrillRecommendation,
    DetectedFlaw,
)
from utils.auth import get_current_user
from scripts.batting_engine import (
    BattingPoseAnalyzer,
    BattingGeminiManager,
    create_batting_pdf,
    BATTING_MEDIAPIPE_AVAILABLE,
    BATTING_ANALYSIS_PROMPT,
    extract_drill_recommendations,
    extract_detected_flaws,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Directories
REPORTS_DIR = Path("storage/reports")
VIDEOS_DIR = Path("storage/batting_videos")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

# Singleton engines (heavy init — reuse across requests)
analyzer = BattingPoseAnalyzer() if BATTING_MEDIAPIPE_AVAILABLE else None
gemini = BattingGeminiManager()


def _cleanup_file(path: Path) -> None:
    if path.exists():
        try:
            os.remove(path)
        except Exception as e:
            logger.warning("Failed to clean up temp file %s: %s", path, e)


# POST /batting/analyze
@router.post("/analyze", response_model=BattingAnalysisResponse)
async def analyze_batting(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a batting video for biomechanics analysis.
    Persists the result to the database and returns the full analysis.
    """
    if not BATTING_MEDIAPIPE_AVAILABLE or analyzer is None:
        raise HTTPException(
            status_code=503,
            detail="Batting analysis feature is currently unavailable. MediaPipe dependency not installed on server.",
        )

    if not file.filename or not file.filename.lower().endswith(('.mp4', '.mov', '.avi')):
        raise HTTPException(status_code=400, detail="Invalid file type. Upload MP4, MOV, or AVI.")

    file_id = str(uuid.uuid4())
    temp_video_path = REPORTS_DIR / f"{file_id}_{file.filename}"

    # Save upload
    try:
        with open(temp_video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save video: {e}")

    background_tasks.add_task(_cleanup_file, temp_video_path)

    try:
        # Biomechanics
        raw_df, display_df, images, annotated_video_path, phase_info = analyzer.process_video(
            str(temp_video_path)
        )

        if display_df.empty:
            return JSONResponse(
                status_code=422,
                content={"error": "No batter detected. Ensure full body is visible."},
            )

        # Move annotated video to permanent storage
        video_filename = f"batting_{file_id}_annotated.mp4"
        final_video_path = VIDEOS_DIR / video_filename
        shutil.move(annotated_video_path, final_video_path)
        annotated_video_url = f"/static/batting_videos/{video_filename}"

        # AI Feedback 
        prompt = BATTING_ANALYSIS_PROMPT.format(
            metrics_summary=display_df.describe().to_string(),
            phase_info=phase_info,
        )
        feedback_text = gemini.call_gemini(prompt, str(temp_video_path))

        # Extract structured data from AI response
        drill_recs = extract_drill_recommendations(feedback_text)
        detected_flaws = extract_detected_flaws(feedback_text)

        # PDF Report
        pdf_bytes = create_batting_pdf(feedback_text, display_df, images, phase_info)
        report_filename = f"batting_report_{file_id}.pdf"
        report_path = REPORTS_DIR / report_filename

        with open(report_path, "wb") as f:
            f.write(pdf_bytes)

        report_url = f"/static/reports/{report_filename}"

        # Extract summary biometrics 
        avg_head = float(round(raw_df['head_alignment'].mean(), 4)) if 'head_alignment' in raw_df.columns else 0.0
        avg_stride = float(round(raw_df['stride_length'].mean(), 4)) if 'stride_length' in raw_df.columns else 0.0
        avg_backlift = float(round(raw_df['backlift_height'].mean(), 4)) if 'backlift_height' in raw_df.columns else 0.0
        avg_knee = float(round(raw_df['front_knee_angle'].mean(), 2)) if 'front_knee_angle' in raw_df.columns else 0.0
        avg_shoulder = float(round(raw_df['shoulder_rotation'].mean(), 2)) if 'shoulder_rotation' in raw_df.columns else 0.0

        summary_stats = display_df.describe().T

        # Persist to DB 
        analysis = create_batting_analysis(
            db,
            player_id=current_user.id,
            original_filename=file.filename,
            avg_head_alignment=avg_head,
            avg_stride_length=avg_stride,
            avg_backlift_height=avg_backlift,
            avg_front_knee_angle=avg_knee,
            avg_shoulder_rotation=avg_shoulder,
            metrics_snapshot=summary_stats.to_dict() if not summary_stats.empty else None,
            phase_info=phase_info,
            ai_feedback=feedback_text,
            report_url=report_url,
        )

        return BattingAnalysisResponse(
            id=analysis.id,
            player_id=analysis.player_id,
            original_filename=analysis.original_filename,
            biometrics=BattingBiometricsResponse(
                avg_head_alignment=avg_head,
                avg_stride_length=avg_stride,
                avg_backlift_height=avg_backlift,
                avg_front_knee_angle=avg_knee,
                avg_shoulder_rotation=avg_shoulder,
            ),
            feedback=BattingFeedbackResponse(
                summary="Batting analysis complete. See full report.",
                full_text=feedback_text,
            ),
            phases=BattingPhaseInfo(**phase_info) if phase_info else None,
            annotated_video_url=annotated_video_url,
            report_url=report_url,
            created_at=analysis.created_at,
            detected_flaws=[
                DetectedFlaw(
                    flaw_name=f.get("flaw_name", ""),
                    description=f.get("description", ""),
                    rating=f.get("rating"),
                    timestamp=f.get("timestamp"),
                )
                for f in detected_flaws
            ],
            drill_recommendations=[
                DrillRecommendation(
                    query=d["query"],
                    title=d["title"],
                    link=d["link"],
                    reason=d["reason"],
                )
                for d in drill_recs
            ],
        )

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Analysis failed: {type(e).__name__}: {str(e)}"
        logger.exception(f"BATTING ERROR - {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)


# GET /batting/history
@router.get("/history", response_model=BattingAnalysisListResponse)
def get_batting_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List current user's past batting analyses (newest first)."""
    results, total = list_batting_analyses_for_player(
        db, current_user.id, limit=limit, offset=offset
    )
    return BattingAnalysisListResponse(
        analyses=[
            BattingAnalysisSummary(
                id=a.id,
                original_filename=a.original_filename,
                avg_head_alignment=a.avg_head_alignment,
                avg_stride_length=a.avg_stride_length,
                avg_front_knee_angle=a.avg_front_knee_angle,
                report_url=a.report_url,
                created_at=a.created_at,
            )
            for a in results
        ],
        total=total,
    )


# GET /batting/{analysis_id}
@router.get("/{analysis_id}", response_model=BattingAnalysisResponse)
def get_batting_analysis(
    analysis_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch a single batting analysis by ID."""
    analysis = get_batting_analysis_by_id(db, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    if analysis.player_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    # Re-extract structured data from saved feedback text
    saved_feedback = analysis.ai_feedback or ""
    drill_recs = extract_drill_recommendations(saved_feedback)
    detected_flaws = extract_detected_flaws(saved_feedback)

    return BattingAnalysisResponse(
        id=analysis.id,
        player_id=analysis.player_id,
        original_filename=analysis.original_filename,
        biometrics=BattingBiometricsResponse(
            avg_head_alignment=analysis.avg_head_alignment or 0.0,
            avg_stride_length=analysis.avg_stride_length or 0.0,
            avg_backlift_height=analysis.avg_backlift_height or 0.0,
            avg_front_knee_angle=analysis.avg_front_knee_angle or 0.0,
            avg_shoulder_rotation=analysis.avg_shoulder_rotation or 0.0,
        ),
        feedback=BattingFeedbackResponse(
            summary="Batting analysis complete.",
            full_text=saved_feedback,
        ),
        phases=BattingPhaseInfo(**analysis.phase_info) if analysis.phase_info else None,
        annotated_video_url=None,  # Not stored in DB
        report_url=analysis.report_url,
        created_at=analysis.created_at,
        detected_flaws=[
            DetectedFlaw(
                flaw_name=f.get("flaw_name", ""),
                description=f.get("description", ""),
                rating=f.get("rating"),
                timestamp=f.get("timestamp"),
            )
            for f in detected_flaws
        ],
        drill_recommendations=[
            DrillRecommendation(
                query=d["query"],
                title=d["title"],
                link=d["link"],
                reason=d["reason"],
            )
            for d in drill_recs
        ],
    )
