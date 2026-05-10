from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database.config import get_db
from utils.auth import get_current_user
from database.models import User
from pydantic import BaseModel

router = APIRouter()

class CreateOrderRequest(BaseModel):
    plan_key: str

@router.post("/billing/create-order")
def create_order(
    request: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a billing order for a subscription plan"""
    # For now, return a mock response
    # TODO: Integrate with actual payment gateway (Razorpay/Stripe)
    return {
        "order_id": f"order_{request.plan_key}_{current_user.id}",
        "amount": 0,
        "currency": "INR",
        "plan_key": request.plan_key
    }

@router.get("/billing/usage")
def get_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get monthly usage for the current user"""
    # Return mock usage data
    # TODO: Implement actual usage tracking from monthly_usage table
    return {
        "user_id": current_user.id,
        "plan": current_user.subscription_plan or "BASIC",
        "usage": {
            "biomech_analyses": 0,
            "ocr_hours": 0,
            "submissions": 0,
            "players_in_dashboard": 0
        },
        "limits": {
            "biomech_analyses": 10,
            "ocr_hours": 5,
            "submissions": 20,
            "players_in_dashboard": 50
        }
    }
