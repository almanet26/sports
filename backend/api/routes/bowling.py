"""
Bowling Analysis API Routes
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
from database.crud.bowling import create_bowling_analysis, get_analysis_by_id, list_analyses_for_player
from database.models.user import User
from schemas.bowling import (
    BowlingAnalysisResponse,
    BowlingAnalysisListResponse,
    BowlingAnalysisSummary,
    BiometricsResponse,
    FeedbackResponse,
    DetectedBowlingFlaw,
    BowlingDrillRecommendation,
)
from utils.auth import get_current_user
from scripts.bowling_engine import (
    CricketPoseAnalyzer, 
    GeminiManager, 
    create_pdf, 
    MEDIAPIPE_AVAILABLE,
    BOWLING_ANALYSIS_PROMPT,
    extract_bowling_flaws,
    extract_bowling_drills,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Directories
REPORTS_DIR = Path("storage/reports")
VIDEOS_DIR = Path("storage/bowling_videos")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

# Singleton engines (heavy init — reuse across requests)
analyzer = CricketPoseAnalyzer() if MEDIAPIPE_AVAILABLE else None
gemini = GeminiManager()


def _cleanup_file(path: Path) -> None:
    if path.exists():
        try:
            os.remove(path)
        except Exception as e:
            logger.warning("Failed to clean up temp file %s: %s", path, e)


@router.post("/analyze", response_model=BowlingAnalysisResponse)
async def analyze_bowling(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a bowling video for biomechanics analysis.
    Persists the result to the database and returns the full analysis.
    """
    # Check if MediaPipe is available
    if not MEDIAPIPE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Bowling analysis feature is currently unavailable. MediaPipe dependency not installed on server."
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
        raw_df, display_df, images, annotated_video_path = analyzer.process_video(str(temp_video_path))

        if display_df.empty:
            return JSONResponse(
                status_code=422,
                content={"error": "No bowler detected. Ensure full body is visible."},
            )

        # Move annotated video to permanent storage
        video_filename = f"bowling_{file_id}_annotated.mp4"
        final_video_path = VIDEOS_DIR / video_filename
        shutil.move(annotated_video_path, final_video_path)
        annotated_video_url = f"/static/bowling_videos/{video_filename}"

        # AI Feedback — use upgraded prompt with YouTube drill extraction
        prompt = BOWLING_ANALYSIS_PROMPT.format(
            metrics_summary=display_df.describe().to_string()
        )
        feedback_text = gemini.call_gemini(prompt, str(temp_video_path))

        # Extract structured data from AI markdown
        detected_flaws = extract_bowling_flaws(feedback_text)
        drill_recommendations = extract_bowling_drills(feedback_text)

        # PDF Report
        pdf_bytes = create_pdf(feedback_text, display_df, images)
        report_filename = f"bowling_report_{file_id}.pdf"
        report_path = REPORTS_DIR / report_filename

        with open(report_path, "wb") as f:
            f.write(pdf_bytes)

        report_url = f"/static/reports/{report_filename}"

        # Extract summary biometrics from raw DataFrame (before column renaming)
        if not raw_df.empty and 'r_elbow_angle' in raw_df.columns:
            avg_elbow = float(round(raw_df['r_elbow_angle'].mean(), 2))
            release_cons = float(round(raw_df['r_wrist_y'].std(), 4))
        else:
            avg_elbow = 0.0
            release_cons = 0.0
        
        summary_stats = display_df.describe().T

        # Persist to DB
        analysis = create_bowling_analysis(
            db,
            player_id=current_user.id,
            original_filename=file.filename,
            avg_elbow_angle=avg_elbow,
            release_consistency=release_cons,
            metrics_snapshot=summary_stats.to_dict() if not summary_stats.empty else None,
            ai_feedback=feedback_text,
            report_url=report_url,
        )

        return BowlingAnalysisResponse(
            id=analysis.id,
            player_id=analysis.player_id,
            original_filename=analysis.original_filename,
            biometrics=BiometricsResponse(
                avg_elbow_angle=avg_elbow,
                release_consistency=release_cons,
            ),
            feedback=FeedbackResponse(
                summary="Analysis complete. See full report.",
                full_text=feedback_text,
            ),
            annotated_video_url=annotated_video_url,
            report_url=report_url,
            created_at=analysis.created_at,
            detected_flaws=[
                DetectedBowlingFlaw(**f) for f in detected_flaws
            ],
            drill_recommendations=[
                BowlingDrillRecommendation(**d) for d in drill_recommendations
            ],
        )

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Analysis failed: {type(e).__name__}: {str(e)}"
        logger.exception(f"BOWLING ERROR - {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)


@router.get("/history", response_model=BowlingAnalysisListResponse)
def get_bowling_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current player's past bowling analyses (newest first)."""
    analyses, total = list_analyses_for_player(
        db, current_user.id, limit=limit, offset=offset
    )
    return BowlingAnalysisListResponse(
        analyses=[
            BowlingAnalysisSummary(
                id=a.id,
                original_filename=a.original_filename,
                avg_elbow_angle=a.avg_elbow_angle,
                release_consistency=a.release_consistency,
                report_url=a.report_url,
                created_at=a.created_at,
            )
            for a in analyses
        ],
        total=total,
    )


@router.get("/{analysis_id}", response_model=BowlingAnalysisResponse)
def get_bowling_analysis(
    analysis_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch a single bowling analysis by ID (must belong to the requesting user)."""
    analysis = get_analysis_by_id(db, analysis_id)

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.player_id != current_user.id and current_user.role not in ("COACH", "ADMIN"):
        raise HTTPException(status_code=403, detail="Not authorized to view this analysis")

    # Re-extract structured data from stored AI feedback
    ai_text = analysis.ai_feedback or ""
    detected_flaws = extract_bowling_flaws(ai_text)
    drill_recs = extract_bowling_drills(ai_text)

    return BowlingAnalysisResponse(
        id=analysis.id,
        player_id=analysis.player_id,
        original_filename=analysis.original_filename,
        biometrics=BiometricsResponse(
            avg_elbow_angle=analysis.avg_elbow_angle or 0.0,
            release_consistency=analysis.release_consistency or 0.0,
        ),
        feedback=FeedbackResponse(
            summary="See full report for details.",
            full_text=ai_text,
        ),
        report_url=analysis.report_url,
        created_at=analysis.created_at,
        detected_flaws=[
            DetectedBowlingFlaw(**f) for f in detected_flaws
        ],
        drill_recommendations=[
            BowlingDrillRecommendation(**d) for d in drill_recs
        ],
    )
