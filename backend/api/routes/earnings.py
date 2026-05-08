from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from database.config import get_db
from database.models.submission import VideoSubmission
from database.models.subscription import Subscription
from database.models.plan_config import PlanConfig
from database.models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/earnings")

COACH_REVENUE_SHARE = 0.7  # 70% of plan price goes to coach


@router.get("")
def get_coach_earnings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get all unique players who submitted to this coach
    player_ids = (
        db.query(VideoSubmission.player_id)
        .filter(VideoSubmission.coach_id == current_user.id)
        .distinct()
        .all()
    )
    player_ids = [p[0] for p in player_ids]

    transactions = []
    total_earned = 0.0
    pending = 0.0
    now = datetime.now(timezone.utc)

    for pid in player_ids:
        player = db.query(User).filter(User.id == pid).first()
        if not player:
            continue

        sub = db.query(Subscription).filter(Subscription.user_id == pid).first()
        if not sub:
            continue

        plan = db.query(PlanConfig).filter(PlanConfig.plan_key == sub.plan_key).first()
        if not plan:
            continue

        amount = round(plan.price_inr * COACH_REVENUE_SHARE, 2)
        end_dt = sub.expires_at
        if end_dt and end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)

        is_active = end_dt and end_dt > now
        tx_status = "paid" if is_active else "pending"

        if tx_status == "paid":
            total_earned += amount
        else:
            pending += amount

        transactions.append({
            "id": str(sub.id),
            "player": player.name,
            "type": plan.display_name,
            "amount": amount,
            "date": sub.started_at.isoformat() if sub.started_at else None,
            "status": tx_status,
        })

    # Monthly breakdown (last 6 months)
    from collections import defaultdict
    monthly: dict = defaultdict(float)
    for tx in transactions:
        if tx["date"] and tx["status"] == "paid":
            month_key = tx["date"][:7]  # YYYY-MM
            monthly[month_key] += tx["amount"]

    chart_data = [
        {"month": k, "earnings": round(v, 2)}
        for k, v in sorted(monthly.items())[-6:]
    ]

    this_month = monthly.get(now.strftime("%Y-%m"), 0.0)

    return {
        "total_earned": round(total_earned, 2),
        "pending": round(pending, 2),
        "this_month": round(this_month, 2),
        "transactions": transactions,
        "chart_data": chart_data,
    }
