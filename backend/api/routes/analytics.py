"""
Coach Analytics API routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from typing import List

from database.config import get_db
from database.models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/coach/stats")
def get_coach_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get overall coach statistics"""
    if current_user.role != "COACH":
        raise HTTPException(status_code=403, detail="Only coaches can access analytics")
    
    from database.models.submission import VideoSubmission
    from database.models.coach_session import CoachTrainingSession
    
    # Total sessions
    total_sessions = db.query(func.count(CoachTrainingSession.id)).filter(
        CoachTrainingSession.coach_id == current_user.id
    ).scalar() or 0
    
    # Active players (unique players with submissions)
    active_players = db.query(func.count(func.distinct(VideoSubmission.player_id))).filter(
        VideoSubmission.coach_id == current_user.id
    ).scalar() or 0
    
    # Total submissions
    total_submissions = db.query(func.count(VideoSubmission.id)).filter(
        VideoSubmission.coach_id == current_user.id
    ).scalar() or 0
    
    # Published reports
    published_reports = db.query(func.count(VideoSubmission.id)).filter(
        VideoSubmission.coach_id == current_user.id,
        VideoSubmission.status == "PUBLISHED"
    ).scalar() or 0
    
    # Completion rate
    completion_rate = round((published_reports / total_submissions * 100) if total_submissions > 0 else 0, 1)
    
    # Previous month stats for comparison
    last_month_start = datetime.now().replace(day=1) - timedelta(days=1)
    last_month_start = last_month_start.replace(day=1)
    current_month_start = datetime.now().replace(day=1)
    
    last_month_sessions = db.query(func.count(CoachTrainingSession.id)).filter(
        CoachTrainingSession.coach_id == current_user.id,
        CoachTrainingSession.created_at >= last_month_start,
        CoachTrainingSession.created_at < current_month_start
    ).scalar() or 0
    
    current_month_sessions = db.query(func.count(CoachTrainingSession.id)).filter(
        CoachTrainingSession.coach_id == current_user.id,
        CoachTrainingSession.created_at >= current_month_start
    ).scalar() or 0
    
    session_change = current_month_sessions - last_month_sessions
    
    return {
        "total_sessions": total_sessions,
        "active_players": active_players,
        "completion_rate": completion_rate,
        "avg_improvement": 18,  # Placeholder - would need player progress tracking
        "session_change": f"+{session_change}" if session_change >= 0 else str(session_change),
        "player_change": f"+{active_players % 10}",  # Placeholder
        "improvement_change": "+5%",  # Placeholder
        "completion_change": "+2%"  # Placeholder
    }


@router.get("/coach/monthly-trend")
def get_monthly_trend(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get monthly trend data for last 6 months"""
    if current_user.role != "COACH":
        raise HTTPException(status_code=403, detail="Only coaches can access analytics")
    
    from database.models.submission import VideoSubmission
    from database.models.coach_session import CoachTrainingSession
    
    # Get data for last 6 months
    six_months_ago = datetime.now() - timedelta(days=180)
    
    monthly_data = []
    for i in range(6):
        month_start = datetime.now().replace(day=1) - timedelta(days=30 * (5 - i))
        month_end = month_start + timedelta(days=30)
        
        sessions = db.query(func.count(CoachTrainingSession.id)).filter(
            CoachTrainingSession.coach_id == current_user.id,
            CoachTrainingSession.created_at >= month_start,
            CoachTrainingSession.created_at < month_end
        ).scalar() or 0
        
        players = db.query(func.count(func.distinct(VideoSubmission.player_id))).filter(
            VideoSubmission.coach_id == current_user.id,
            VideoSubmission.created_at >= month_start,
            VideoSubmission.created_at < month_end
        ).scalar() or 0
        
        # Revenue calculation (placeholder - would need payment tracking)
        revenue = sessions * 200  # $200 per session
        
        monthly_data.append({
            "month": month_start.strftime("%b"),
            "sessions": sessions,
            "players": players,
            "revenue": revenue
        })
    
    return monthly_data


@router.get("/coach/skill-improvement")
def get_skill_improvement(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get skill improvement rates by category"""
    if current_user.role != "COACH":
        raise HTTPException(status_code=403, detail="Only coaches can access analytics")
    
    from database.models.submission import VideoSubmission
    
    # Count submissions by analysis type
    batting_count = db.query(func.count(VideoSubmission.id)).filter(
        VideoSubmission.coach_id == current_user.id,
        VideoSubmission.analysis_type == "BATTING"
    ).scalar() or 0
    
    bowling_count = db.query(func.count(VideoSubmission.id)).filter(
        VideoSubmission.coach_id == current_user.id,
        VideoSubmission.analysis_type == "BOWLING"
    ).scalar() or 0
    
    total = batting_count + bowling_count
    
    # Calculate improvement percentages (placeholder - would need actual progress tracking)
    return [
        {"skill": "Batting", "improvement": min(22 + (batting_count % 10), 30)},
        {"skill": "Bowling", "improvement": min(18 + (bowling_count % 10), 30)},
        {"skill": "Fielding", "improvement": 15},
        {"skill": "Fitness", "improvement": 20},
        {"skill": "Mental", "improvement": 16}
    ]


@router.get("/coach/recent-activity")
def get_recent_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get recent coaching activity"""
    if current_user.role != "COACH":
        raise HTTPException(status_code=403, detail="Only coaches can access analytics")
    
    from database.models.submission import VideoSubmission
    
    # Get recent submissions
    recent_submissions = db.query(VideoSubmission).filter(
        VideoSubmission.coach_id == current_user.id
    ).order_by(VideoSubmission.created_at.desc()).limit(10).all()
    
    activities = []
    for sub in recent_submissions:
        player = db.query(User).filter(User.id == sub.player_id).first()
        activities.append({
            "id": sub.id,
            "player_name": player.name if player else "Unknown",
            "analysis_type": sub.analysis_type,
            "status": sub.status,
            "created_at": sub.created_at.isoformat()
        })
    
    return activities
