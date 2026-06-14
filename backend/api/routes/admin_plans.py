"""
Admin control panel API for the dynamic entitlement engine.

Lets an ADMIN create/edit/delete plans and features and assign entitlements at runtime.  Every mutation invalidates the entitlement cache so changes take effect live (within the TTL) with no redeploy.

All routes require an ADMIN account.  Mounted under the /admin prefix alongside api/routes/admin.py.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.feature import FEATURE_TYPE_VALUES, Feature
from database.models.plan import BILLING_PERIOD_VALUES, USER_TYPE_VALUES, Plan
from database.models.plan_entitlement import PlanEntitlement
from database.models.subscription import Subscription
from database.models.user import User
from services import entitlement_service
from utils.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin-plans"])
logger = logging.getLogger(__name__)


# ── Admin guard ──────────────────────────────────────────────────────────────

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


# ── Schemas ──────────────────────────────────────────────────────────────────

class FeatureOut(BaseModel):
    id: int
    key: str
    display_name: str
    description: Optional[str] = None
    type: str
    model_config = ConfigDict(from_attributes=True)


class FeatureCreate(BaseModel):
    key: str
    display_name: str
    type: str
    description: Optional[str] = None

    @field_validator("key")
    @classmethod
    def _key_slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not v or " " in v:
            raise ValueError("key must be a non-empty slug with no spaces")
        return v

    @field_validator("type")
    @classmethod
    def _type_valid(cls, v: str) -> str:
        if v not in FEATURE_TYPE_VALUES:
            raise ValueError(f"type must be one of {FEATURE_TYPE_VALUES}")
        return v


class FeatureUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None

    @field_validator("type")
    @classmethod
    def _type_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in FEATURE_TYPE_VALUES:
            raise ValueError(f"type must be one of {FEATURE_TYPE_VALUES}")
        return v


class EntitlementIn(BaseModel):
    feature_id: int
    value: str


class EntitlementOut(BaseModel):
    feature_id: int
    feature_key: str
    feature_type: str
    value: str


class PlanCreate(BaseModel):
    key: str
    display_name: str
    user_type: str
    price_inr: int = 0
    billing_period: str = "monthly"
    sort_order: int = 0
    is_active: bool = True
    razorpay_plan_id: Optional[str] = None
    entitlements: List[EntitlementIn] = []

    @field_validator("key")
    @classmethod
    def _key_slug(cls, v: str) -> str:
        v = v.strip().lower()
        if not v or " " in v:
            raise ValueError("key must be a non-empty slug with no spaces")
        return v

    @field_validator("user_type")
    @classmethod
    def _user_type_valid(cls, v: str) -> str:
        if v not in USER_TYPE_VALUES:
            raise ValueError(f"user_type must be one of {USER_TYPE_VALUES}")
        return v

    @field_validator("billing_period")
    @classmethod
    def _period_valid(cls, v: str) -> str:
        if v not in BILLING_PERIOD_VALUES:
            raise ValueError(f"billing_period must be one of {BILLING_PERIOD_VALUES}")
        return v

    @field_validator("price_inr")
    @classmethod
    def _price_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("price_inr cannot be negative")
        return v


class PlanUpdate(BaseModel):
    display_name: Optional[str] = None
    price_inr: Optional[int] = None
    billing_period: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    razorpay_plan_id: Optional[str] = None

    @field_validator("billing_period")
    @classmethod
    def _period_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in BILLING_PERIOD_VALUES:
            raise ValueError(f"billing_period must be one of {BILLING_PERIOD_VALUES}")
        return v

    @field_validator("price_inr")
    @classmethod
    def _price_non_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("price_inr cannot be negative")
        return v


class PlanOut(BaseModel):
    id: int
    key: str
    display_name: str
    user_type: str
    price_inr: int
    billing_period: str
    razorpay_plan_id: Optional[str] = None
    is_active: bool
    sort_order: int
    subscriber_count: int
    entitlements: List[EntitlementOut]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _active_subscriber_count(plan_id: int, db: Session) -> int:
    return (
        db.query(func.count(Subscription.id))
        .filter(Subscription.plan_id == plan_id, Subscription.status == "active")
        .scalar()
        or 0
    )


def _coerce_entitlement_value(feature: Feature, raw: str) -> str:
    """Normalize a stored entitlement value against its feature type."""
    if feature.type == "boolean":
        return "true" if str(raw).strip().lower() in ("true", "1", "yes") else "false"
    # numeric
    try:
        num = float(raw)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=422,
            detail=f"Feature '{feature.key}' is numeric; value '{raw}' is not a number",
        )
    # store ints without trailing .0 for readability
    return str(int(num)) if num.is_integer() else str(num)


def _serialize_plan(plan: Plan, db: Session) -> PlanOut:
    rows = (
        db.query(PlanEntitlement, Feature)
        .join(Feature, PlanEntitlement.feature_id == Feature.id)
        .filter(PlanEntitlement.plan_id == plan.id)
        .all()
    )
    entitlements = [
        EntitlementOut(
            feature_id=feature.id,
            feature_key=feature.key,
            feature_type=feature.type,
            value=ent.value,
        )
        for ent, feature in rows
    ]
    return PlanOut(
        id=plan.id,
        key=plan.key,
        display_name=plan.display_name,
        user_type=plan.user_type,
        price_inr=plan.price_inr,
        billing_period=plan.billing_period,
        razorpay_plan_id=plan.razorpay_plan_id,
        is_active=plan.is_active,
        sort_order=plan.sort_order,
        subscriber_count=_active_subscriber_count(plan.id, db),
        entitlements=entitlements,
    )


def _apply_entitlements(plan: Plan, items: List[EntitlementIn], db: Session) -> None:
    """Replace-all: clear the plan's entitlements, then insert the provided set."""
    feature_ids = [i.feature_id for i in items]
    features = {f.id: f for f in db.query(Feature).filter(Feature.id.in_(feature_ids)).all()} if feature_ids else {}

    missing = [fid for fid in feature_ids if fid not in features]
    if missing:
        raise HTTPException(status_code=404, detail=f"Unknown feature id(s): {missing}")

    db.query(PlanEntitlement).filter(PlanEntitlement.plan_id == plan.id).delete()
    seen: set[int] = set()
    for item in items:
        if item.feature_id in seen:
            raise HTTPException(status_code=422, detail=f"Duplicate feature id {item.feature_id}")
        seen.add(item.feature_id)
        feature = features[item.feature_id]
        db.add(PlanEntitlement(
            plan_id=plan.id,
            feature_id=feature.id,
            value=_coerce_entitlement_value(feature, item.value),
        ))


# ── Feature endpoints ────────────────────────────────────────────────────────

@router.get("/features", response_model=List[FeatureOut])
def list_features(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(Feature).order_by(Feature.type, Feature.key).all()


@router.post("/features", response_model=FeatureOut, status_code=201)
def create_feature(body: FeatureCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(Feature).filter(Feature.key == body.key).first():
        raise HTTPException(status_code=409, detail=f"Feature '{body.key}' already exists")
    feature = Feature(key=body.key, display_name=body.display_name, type=body.type, description=body.description)
    db.add(feature)
    db.commit()
    db.refresh(feature)
    entitlement_service.invalidate_all()
    logger.info("Feature '%s' created by admin %s", feature.key, admin.email)
    return feature


@router.patch("/features/{feature_id}", response_model=FeatureOut)
def update_feature(feature_id: int, body: FeatureUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    feature = db.query(Feature).filter(Feature.id == feature_id).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(feature, field, value)
    db.commit()
    db.refresh(feature)
    entitlement_service.invalidate_all()
    return feature


@router.delete("/features/{feature_id}", status_code=204)
def delete_feature(feature_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    feature = db.query(Feature).filter(Feature.id == feature_id).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    db.delete(feature)  # plan_entitlements cascade-delete via FK
    db.commit()
    entitlement_service.invalidate_all()
    logger.info("Feature '%s' deleted by admin %s", feature.key, admin.email)


# ── Plan endpoints ───────────────────────────────────────────────────────────

@router.get("/plans", response_model=List[PlanOut])
def list_plans(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    plans = db.query(Plan).order_by(Plan.user_type, Plan.sort_order, Plan.price_inr).all()
    return [_serialize_plan(p, db) for p in plans]


@router.post("/plans", response_model=PlanOut, status_code=201)
def create_plan(body: PlanCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(Plan).filter(Plan.key == body.key).first():
        raise HTTPException(status_code=409, detail=f"Plan '{body.key}' already exists")
    plan = Plan(
        key=body.key,
        display_name=body.display_name,
        user_type=body.user_type,
        price_inr=body.price_inr,
        billing_period=body.billing_period,
        sort_order=body.sort_order,
        is_active=body.is_active,
        razorpay_plan_id=body.razorpay_plan_id,
    )
    db.add(plan)
    db.flush()  # assign plan.id before entitlements
    _apply_entitlements(plan, body.entitlements, db)
    db.commit()
    db.refresh(plan)
    entitlement_service.invalidate_all()
    logger.info("Plan '%s' created by admin %s", plan.key, admin.email)
    return _serialize_plan(plan, db)


@router.patch("/plans/{plan_id}", response_model=PlanOut)
def update_plan(plan_id: int, body: PlanUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    entitlement_service.invalidate_all()
    logger.info("Plan '%s' updated by admin %s", plan.key, admin.email)
    return _serialize_plan(plan, db)


@router.put("/plans/{plan_id}/entitlements", response_model=PlanOut)
def set_entitlements(plan_id: int, items: List[EntitlementIn], admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    _apply_entitlements(plan, items, db)
    db.commit()
    db.refresh(plan)
    entitlement_service.invalidate_all()
    logger.info("Entitlements for plan '%s' updated by admin %s", plan.key, admin.email)
    return _serialize_plan(plan, db)


@router.delete("/plans/{plan_id}", status_code=204)
def delete_plan(
    plan_id: int,
    migrate_to: Optional[int] = Query(None, description="Plan id to reassign active subscribers to before deleting"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    subscriber_count = _active_subscriber_count(plan_id, db)

    if subscriber_count > 0:
        if migrate_to is None:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "plan_has_active_subscribers",
                    "subscriber_count": subscriber_count,
                    "message": "Provide ?migrate_to=<plan_id> to reassign subscribers before deleting.",
                },
            )
        target = db.query(Plan).filter(Plan.id == migrate_to).first()
        if not target:
            raise HTTPException(status_code=404, detail="migrate_to plan not found")
        if target.id == plan.id:
            raise HTTPException(status_code=422, detail="Cannot migrate a plan to itself")
        if target.user_type != plan.user_type:
            raise HTTPException(
                status_code=422,
                detail="migrate_to plan must have the same user_type",
            )
        # Reassign active subscribers, keeping denormalized mirrors in sync.
        db.query(Subscription).filter(
            Subscription.plan_id == plan.id,
            Subscription.status == "active",
        ).update(
            {"plan_id": target.id, "plan_key": target.key, "role": target.key},
            synchronize_session=False,
        )
        db.flush()

    db.delete(plan)  # entitlements cascade
    db.commit()
    entitlement_service.invalidate_all()
    logger.info("Plan '%s' deleted by admin %s (migrate_to=%s)", plan.key, admin.email, migrate_to)
