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


@router.get("/coach/dashboard")
def get_coach_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Single endpoint returning all coach dashboard data."""
    if current_user.role != "COACH":
        raise HTTPException(status_code=403, detail="Only coaches can access this")

    from database.models.submission import VideoSubmission, SubmissionStatus
    from database.models.coach_session import CoachTrainingSession
    from database.models.coach_training_plan import CoachTrainingPlan
    from database.models.coach_review import CoachReview
    from collections import defaultdict

    # ── Stats ──────────────────────────────────────────────────────────────
    total_sessions = db.query(func.count(CoachTrainingSession.id)).filter(
        CoachTrainingSession.coach_id == current_user.id
    ).scalar() or 0

    active_plans = db.query(func.count(CoachTrainingPlan.id)).filter(
        CoachTrainingPlan.coach_id == current_user.id
    ).scalar() or 0

    all_subs = db.query(VideoSubmission).filter(
        VideoSubmission.coach_id == current_user.id
    ).all()
    published = [s for s in all_subs if s.status == SubmissionStatus.PUBLISHED]
    avg_improvement = round((len(published) / len(all_subs) * 100) if all_subs else 0, 1)

    # ── Athlete progress (weekly submission counts last 6 weeks) ───────────
    from datetime import date, timedelta
    today = date.today()
    weekly = []
    for w in range(5, -1, -1):
        start = today - timedelta(weeks=w + 1)
        end = today - timedelta(weeks=w)
        count = sum(1 for s in all_subs if s.created_at and start <= s.created_at.date() < end)
        pub = sum(1 for s in published if s.created_at and start <= s.created_at.date() < end)
        weekly.append({
            "week": f"W{6 - w}",
            "performance": min(60 + count * 5, 100),
            "technique": min(65 + pub * 8, 100),
            "fitness": min(55 + count * 4, 100),
        })

    # ── Training focus (submissions by type) ──────────────────────────────
    batting = sum(1 for s in all_subs if s.analysis_type == "BATTING")
    bowling = sum(1 for s in all_subs if s.analysis_type == "BOWLING")
    sports_analysis = [
        {"sport": "Batting", "sessions": batting, "improvement": min(20 + batting * 2, 40)},
        {"sport": "Bowling", "sessions": bowling, "improvement": min(15 + bowling * 2, 40)},
        {"sport": "Fielding", "sessions": 0, "improvement": 0},
        {"sport": "Fitness", "sessions": 0, "improvement": 0},
    ]

    # ── Upcoming sessions ─────────────────────────────────────────────────
    upcoming = db.query(CoachTrainingSession).filter(
        CoachTrainingSession.coach_id == current_user.id
    ).order_by(CoachTrainingSession.session_date.asc(), CoachTrainingSession.session_time.asc()).limit(4).all()

    training_sessions = [
        {
            "id": s.id,
            "title": s.topic,
            "athlete": "All Players",
            "date": s.session_date,
            "time": s.session_time,
            "status": "Scheduled",
            "type": s.session_type,
        }
        for s in upcoming
    ]

    # ── Top performers (athletes by published reports) ────────────────────
    player_stats: dict = defaultdict(lambda: {"published": 0, "total": 0, "name": ""})
    for s in all_subs:
        pid = s.player_id
        player_stats[pid]["total"] += 1
        if s.status == SubmissionStatus.PUBLISHED:
            player_stats[pid]["published"] += 1
        if s.player:
            player_stats[pid]["name"] = s.player.name

    badges = ["🥇", "🥈", "🥉", "⭐"]
    leaderboard = sorted(
        [{"id": pid, "name": v["name"], "score": v["published"], "total": v["total"]}
         for pid, v in player_stats.items() if v["name"]],
        key=lambda x: -x["score"]
    )[:4]
    for i, p in enumerate(leaderboard):
        p["badge"] = badges[i] if i < len(badges) else "⭐"
        p["improvement"] = f"+{p['score']} reports"

    # ── Skills radar (batting vs bowling ratio) ───────────────────────────
    total = batting + bowling or 1
    bat_pct = round(batting / total * 100)
    bowl_pct = round(bowling / total * 100)
    skills_radar = [
        {"skill": "Batting", "A": bat_pct, "B": bowl_pct, "fullMark": 100},
        {"skill": "Bowling", "A": bowl_pct, "B": bat_pct, "fullMark": 100},
        {"skill": "Reports", "A": min(len(published) * 10, 100), "B": min(len(all_subs) * 5, 100), "fullMark": 100},
        {"skill": "Players", "A": min(len(player_stats) * 15, 100), "B": min(len(player_stats) * 10, 100), "fullMark": 100},
        {"skill": "Sessions", "A": min(total_sessions * 8, 100), "B": min(active_plans * 12, 100), "fullMark": 100},
        {"skill": "Plans", "A": min(active_plans * 12, 100), "B": min(total_sessions * 8, 100), "fullMark": 100},
    ]

    # ── Reviews ───────────────────────────────────────────────────────────
    reviews = db.query(CoachReview).filter(CoachReview.coach_id == current_user.id).all()
    recent_reviews = []
    for r in sorted(reviews, key=lambda x: x.created_at or datetime.min, reverse=True)[:3]:
        player = db.query(User).filter(User.id == r.player_id).first()
        recent_reviews.append({
            "id": r.id,
            "player_name": player.name if player else "Unknown",
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    avg_rating = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else 0

    return {
        "stats": {
            "total_sessions": total_sessions,
            "active_plans": active_plans,
            "avg_improvement": avg_improvement,
            "total_athletes": len(player_stats),
        },
        "athlete_progress": weekly,
        "sports_analysis": sports_analysis,
        "skills_radar": skills_radar,
        "training_sessions": training_sessions,
        "leaderboard": leaderboard,
        "recent_reviews": recent_reviews,
        "review_stats": {"average_rating": avg_rating, "total_reviews": len(reviews)},
    }


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
