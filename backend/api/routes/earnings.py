from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from database.config import get_db
from database.models import Transaction, TransactionStatus, User
from utils.auth import get_current_user
from pydantic import BaseModel
from typing import List
from datetime import datetime, timedelta

router = APIRouter()


class TransactionResponse(BaseModel):
    id: str
    player_name: str
    player_email: str
    transaction_type: str
    amount: float
    status: str
    description: str | None
    created_at: datetime
    paid_at: datetime | None

    class Config:
        from_attributes = True


class EarningsStatsResponse(BaseModel):
    total_earned: float
    pending: float
    this_month: float
    total_transactions: int


class MonthlyEarningsResponse(BaseModel):
    month: str
    earnings: float


@router.get("/earnings/stats", response_model=EarningsStatsResponse)
def get_earnings_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get earnings statistics for coach"""
    if current_user.role != "COACH":
        raise HTTPException(status_code=403, detail="Only coaches can access earnings")
    
    # Total earned (paid transactions)
    total_earned = db.query(func.sum(Transaction.amount)).filter(
        Transaction.coach_id == current_user.id,
        Transaction.status == TransactionStatus.PAID
    ).scalar() or 0.0
    
    # Pending amount
    pending = db.query(func.sum(Transaction.amount)).filter(
        Transaction.coach_id == current_user.id,
        Transaction.status == TransactionStatus.PENDING
    ).scalar() or 0.0
    
    # This month earnings
    now = datetime.utcnow()
    this_month = db.query(func.sum(Transaction.amount)).filter(
        Transaction.coach_id == current_user.id,
        Transaction.status == TransactionStatus.PAID,
        extract('year', Transaction.paid_at) == now.year,
        extract('month', Transaction.paid_at) == now.month
    ).scalar() or 0.0
    
    # Total transactions
    total_transactions = db.query(func.count(Transaction.id)).filter(
        Transaction.coach_id == current_user.id
    ).scalar() or 0
    
    return {
        "total_earned": total_earned,
        "pending": pending,
        "this_month": this_month,
        "total_transactions": total_transactions
    }


@router.get("/earnings/monthly", response_model=List[MonthlyEarningsResponse])
def get_monthly_earnings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get monthly earnings for last 6 months"""
    if current_user.role != "COACH":
        raise HTTPException(status_code=403, detail="Only coaches can access earnings")
    
    # Get last 6 months data
    results = []
    now = datetime.utcnow()
    
    for i in range(5, -1, -1):
        target_date = now - timedelta(days=30 * i)
        month_name = target_date.strftime("%b")
        
        earnings = db.query(func.sum(Transaction.amount)).filter(
            Transaction.coach_id == current_user.id,
            Transaction.status == TransactionStatus.PAID,
            extract('year', Transaction.paid_at) == target_date.year,
            extract('month', Transaction.paid_at) == target_date.month
        ).scalar() or 0.0
        
        results.append({"month": month_name, "earnings": earnings})
    
    return results


@router.get("/earnings/transactions", response_model=List[TransactionResponse])
def get_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all transactions for coach"""
    if current_user.role != "COACH":
        raise HTTPException(status_code=403, detail="Only coaches can access earnings")
    
    transactions = db.query(Transaction).filter(
        Transaction.coach_id == current_user.id
    ).order_by(Transaction.created_at.desc()).all()
    
    result = []
    for t in transactions:
        player = db.query(User).filter(User.id == t.player_id).first()
        result.append({
            "id": t.id,
            "player_name": player.name if player else "Unknown",
            "player_email": player.email if player else "",
            "transaction_type": t.transaction_type.value,
            "amount": t.amount,
            "status": t.status.value,
            "description": t.description,
            "created_at": t.created_at,
            "paid_at": t.paid_at
        })
    
    return result
