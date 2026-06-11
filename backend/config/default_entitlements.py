"""
Canonical baseline catalog for the dynamic entitlement engine.

This is the single source of truth consumed at startup by main._ensure_plans_and_features() (idempotent upsert) and by scripts/seed_entitlements.py.

The Alembic migration a1d2e3f4c5b6_dynamic_entitlement_engine.py inlines an equivalent baseline as raw SQL so it stays self-contained. If you change the baseline here, keep that migration's seed block in sync — but note the startup upsert is authoritative and idempotent, so the two always converge.

Values follow the finalised "Subscription Plans" specification:
  Players (monthly):  Bronze ₹0 · Silver ₹200 · Gold ₹500
  Coaches (annual):   Coach Basic ₹0 · Coach Platinum ₹1200/yr

Entitlement value semantics:
  - boolean feature -> "true" / "false"
  - numeric feature -> integer/float string; "-1" = unlimited, "0" = none.
"""

from __future__ import annotations

# ── Feature catalog ──────────────────────────────────────────────────────────
# (key, display_name, type, description)
DEFAULT_FEATURES: list[dict] = [
    # Numeric / metered
    {"key": "biomechanics_analysis", "display_name": "Biomechanical Analyses", "type": "numeric",
     "description": "AI biomechanical analyses per month"},
    {"key": "player_submission", "display_name": "Coach Submissions", "type": "numeric",
     "description": "Video submissions to coaches per month (and player submissions handled, for coaches)"},
    {"key": "ocr_highlights", "display_name": "OCR Match Hours", "type": "numeric",
     "description": "OCR match-hours of highlight generation per month"},
    {"key": "player_roster", "display_name": "Athlete Roster Size", "type": "numeric",
     "description": "Maximum number of athletes a coach can have in their dashboard"},
    # Boolean / capability
    {"key": "pdf_report", "display_name": "Professional PDF Reports", "type": "boolean",
     "description": "Downloadable professional PDF performance reports"},
    {"key": "ad_free", "display_name": "Ad-Free Experience", "type": "boolean",
     "description": "Removes ads across the platform"},
    {"key": "streak_counters", "display_name": "Streaks & Milestone Badges", "type": "boolean",
     "description": "Streak counters and extended milestone badges"},
    {"key": "ai_chat", "display_name": "AI Coach Chat", "type": "boolean",
     "description": "24/7 virtual AI chat assistant"},
    {"key": "pro_benchmarking", "display_name": "Pro Benchmarking", "type": "boolean",
     "description": "Side-by-side pose comparison against professionals"},
    {"key": "injury_risk_alerts", "display_name": "Injury Risk Alerts", "type": "boolean",
     "description": "Automated injury-risk alerting"},
    {"key": "scouting_visibility", "display_name": "Scouting Visibility", "type": "boolean",
     "description": "Verified scouting profile visible to scouts and franchises"},
    {"key": "scouting_access", "display_name": "Scouting Directory Access", "type": "boolean",
     "description": "Browse and shortlist players in the scouting directory"},
    {"key": "coach_submission_inbox", "display_name": "Submission Inbox", "type": "boolean",
     "description": "Review the player submission inbox and manage earnings"},
    {"key": "video_annotation", "display_name": "Video Annotation Tools", "type": "boolean",
     "description": "Annotate videos for remote feedback"},
    {"key": "player_dashboard", "display_name": "Multi-Player Dashboard", "type": "boolean",
     "description": "Private dashboard to track athlete progress"},
    {"key": "csv_export", "display_name": "CSV Data Export", "type": "boolean",
     "description": "Export tracking data as CSV"},
    {"key": "white_label_reports", "display_name": "White-Label Reporting", "type": "boolean",
     "description": "Academy-branded white-label reports"},
    {"key": "priority_processing", "display_name": "Priority Processing", "type": "boolean",
     "description": "Expedited processing queue for jobs"},
    {"key": "training_plans", "display_name": "Athlete Training Plans", "type": "boolean",
     "description": "Create and manage athlete training plans"},
    {"key": "training_calendar", "display_name": "Training Schedule Calendar", "type": "boolean",
     "description": "Calendar-based training schedule with attendance tracking"},
    {"key": "leaderboard", "display_name": "Leaderboard Access", "type": "boolean",
     "description": "Top-performing and most-improved athlete leaderboards"},
]

# ── Plan catalog ─────────────────────────────────────────────────────────────
DEFAULT_PLANS: list[dict] = [
    # ── Player plans (monthly billing) ──────────────────────────────────────
    {
        "key": "bronze", "display_name": "Bronze", "user_type": "player",
        "price_inr": 0, "billing_period": "monthly", "sort_order": 0,
        "entitlements": {
            "biomechanics_analysis": "3",
            "player_submission": "0",
            "streak_counters": "true",
        },
    },
    {
        "key": "silver", "display_name": "Silver", "user_type": "player",
        "price_inr": 20000, "billing_period": "monthly", "sort_order": 1,
        "entitlements": {
            "biomechanics_analysis": "15",
            "player_submission": "5",
            "streak_counters": "true",
            "ad_free": "true",
            "pdf_report": "true",
            "ai_chat": "true",
        },
    },
    {
        "key": "gold", "display_name": "Gold", "user_type": "player",
        "price_inr": 50000, "billing_period": "monthly", "sort_order": 2,
        "entitlements": {
            "biomechanics_analysis": "50",
            "player_submission": "15",
            "streak_counters": "true",
            "ad_free": "true",
            "pdf_report": "true",
            "ai_chat": "true",
            "pro_benchmarking": "true",
            "injury_risk_alerts": "true",
            "scouting_visibility": "true",
        },
    },
    # ── Coach plans (annual billing) ────────────────────────────────────────
    {
        "key": "coach_basic", "display_name": "Coach Basic", "user_type": "coach",
        "price_inr": 0, "billing_period": "annual", "sort_order": 0,
        "entitlements": {
            "ocr_highlights": "10",
            "player_submission": "5",
            "player_roster": "5",
            "player_dashboard": "true",
            "coach_submission_inbox": "true",
        },
    },
    {
        "key": "coach_platinum", "display_name": "Coach Platinum", "user_type": "coach",
        "price_inr": 120000, "billing_period": "annual", "sort_order": 1,
        "entitlements": {
            "ocr_highlights": "50",
            "player_submission": "100",
            "player_roster": "25",
            "player_dashboard": "true",
            "coach_submission_inbox": "true",
            "video_annotation": "true",
            "ai_chat": "true",
            "csv_export": "true",
            "priority_processing": "true",
            "white_label_reports": "true",
            "scouting_access": "true",
            "training_plans": "true",
            "training_calendar": "true",
            "leaderboard": "true",
        },
    },
]

# Free plan per account type — used at registration to seed the initial subscription.
FREE_PLAN_BY_ACCOUNT_TYPE: dict[str, str] = {
    "PLAYER": "bronze",
    "COACH": "coach_basic",
    "ADMIN": "bronze",
}

# Legacy monthly_usage column → feature key (for the increment_* compat shims).
LEGACY_FIELD_TO_FEATURE: dict[str, str] = {
    "biomech_count": "biomechanics_analysis",
    "ocr_hours_used": "ocr_highlights",
    "submission_count": "player_submission",
}
