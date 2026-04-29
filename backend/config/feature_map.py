"""
Feature gate configuration: tier ordering and feature → minimum tier mapping.
"""

TIER_HIERARCHY: dict[str, int] = {
    "free": 0,
    "coach_free": 0,
    "basic": 1,
    "platinum": 2,
    "coach_starter": 3,
    "coach_pro": 4,
    "academy": 5,
}

# Maps each feature key to the minimum role required to access it.
FEATURE_MAP: dict[str, str] = {
    "biomechanics_analysis": "free",
    "pdf_report":            "platinum",
    "ai_chat":               "basic",
    "pro_benchmarking":      "platinum",
    "injury_risk_alerts":    "platinum",
    "ocr_highlights":        "coach_starter",
    "video_annotation":      "coach_starter",
    "player_dashboard":      "coach_starter",
    "player_submission":     "basic",
    "coach_submission_inbox": "coach_starter",
    "csv_export":            "coach_pro",
    "priority_processing":   "coach_pro",
    "white_label_reports":   "academy",
    "multi_seat_roles":      "academy",
    "recruitment_desk":      "academy",
}
