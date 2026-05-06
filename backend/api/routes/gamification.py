from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta

from database.config import get_db
from database.models.player_performance import PlayerPerformanceEntry
from database.models.gamification import PlayerBadge, PlayerStreak
from database.models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/gamification", tags=["gamification"])

# rarity: BRONZE | SILVER | GOLD | PLATINUM
# progress_hint(stats) -> (current_val, target_val) or None
BADGE_DEFS = [
    {
        "key": "first_match",
        "label": "First Match",
        "icon": "fas fa-flag",
        "color": "from-blue-400 to-cyan-400",
        "rarity": "BRONZE",
        "description": "Log your very first match",
        "check": lambda s: s["matches"] >= 1,
        "progress_hint": lambda s: (min(s["matches"], 1), 1),
    },
    {
        "key": "consistent",
        "label": "Consistent",
        "icon": "fas fa-calendar-check",
        "color": "from-indigo-400 to-blue-500",
        "rarity": "BRONZE",
        "description": "Log 5 matches",
        "check": lambda s: s["matches"] >= 5,
        "progress_hint": lambda s: (min(s["matches"], 5), 5),
    },
    {
        "key": "veteran",
        "label": "Veteran",
        "icon": "fas fa-shield-alt",
        "color": "from-slate-400 to-gray-500",
        "rarity": "SILVER",
        "description": "Play 10+ matches",
        "check": lambda s: s["matches"] >= 10,
        "progress_hint": lambda s: (min(s["matches"], 10), 10),
    },
    {
        "key": "match_master",
        "label": "Match Master",
        "icon": "fas fa-chess-king",
        "color": "from-violet-500 to-purple-600",
        "rarity": "GOLD",
        "description": "Play 25+ matches",
        "check": lambda s: s["matches"] >= 25,
        "progress_hint": lambda s: (min(s["matches"], 25), 25),
    },
    {
        "key": "half_centurion",
        "label": "Half-Century",
        "icon": "fas fa-star",
        "color": "from-orange-400 to-yellow-400",
        "rarity": "SILVER",
        "description": "Score 50+ runs in a single match",
        "check": lambda s: s["highest_score"] >= 50,
        "progress_hint": lambda s: (min(s["highest_score"], 50), 50),
    },
    {
        "key": "centurion",
        "label": "Centurion",
        "icon": "fas fa-crown",
        "color": "from-yellow-400 to-amber-500",
        "rarity": "GOLD",
        "description": "Score 100+ runs in a single match",
        "check": lambda s: s["highest_score"] >= 100,
        "progress_hint": lambda s: (min(s["highest_score"], 100), 100),
    },
    {
        "key": "run_machine",
        "label": "Run Machine",
        "icon": "fas fa-chart-line",
        "color": "from-green-400 to-emerald-500",
        "rarity": "SILVER",
        "description": "Score 500+ runs total",
        "check": lambda s: s["total_runs"] >= 500,
        "progress_hint": lambda s: (min(s["total_runs"], 500), 500),
    },
    {
        "key": "run_legend",
        "label": "Run Legend",
        "icon": "fas fa-infinity",
        "color": "from-emerald-400 to-teal-500",
        "rarity": "PLATINUM",
        "description": "Score 2000+ runs total",
        "check": lambda s: s["total_runs"] >= 2000,
        "progress_hint": lambda s: (min(s["total_runs"], 2000), 2000),
    },
    {
        "key": "boundary_king",
        "label": "Boundary King",
        "icon": "fas fa-bolt",
        "color": "from-yellow-500 to-orange-500",
        "rarity": "SILVER",
        "description": "Hit 50+ fours total",
        "check": lambda s: s["total_fours"] >= 50,
        "progress_hint": lambda s: (min(s["total_fours"], 50), 50),
    },
    {
        "key": "six_machine",
        "label": "Six Machine",
        "icon": "fas fa-rocket",
        "color": "from-purple-500 to-pink-500",
        "rarity": "GOLD",
        "description": "Hit 20+ sixes total",
        "check": lambda s: s["total_sixes"] >= 20,
        "progress_hint": lambda s: (min(s["total_sixes"], 20), 20),
    },
    {
        "key": "hat_trick_hero",
        "label": "Hat-Trick Hero",
        "icon": "fas fa-fire",
        "color": "from-red-500 to-orange-500",
        "rarity": "GOLD",
        "description": "Take 3+ wickets in a single match",
        "check": lambda s: s["best_wickets"] >= 3,
        "progress_hint": lambda s: (min(s["best_wickets"], 3), 3),
    },
    {
        "key": "wicket_taker",
        "label": "Wicket Taker",
        "icon": "fas fa-crosshairs",
        "color": "from-red-400 to-rose-500",
        "rarity": "SILVER",
        "description": "Take 10+ wickets total",
        "check": lambda s: s["total_wickets"] >= 10,
        "progress_hint": lambda s: (min(s["total_wickets"], 10), 10),
    },
    {
        "key": "safe_hands",
        "label": "Safe Hands",
        "icon": "fas fa-hands",
        "color": "from-teal-400 to-cyan-500",
        "rarity": "BRONZE",
        "description": "Take 10+ catches total",
        "check": lambda s: s["total_catches"] >= 10,
        "progress_hint": lambda s: (min(s["total_catches"], 10), 10),
    },
    {
        "key": "winner",
        "label": "Winner",
        "icon": "fas fa-trophy",
        "color": "from-emerald-400 to-green-500",
        "rarity": "SILVER",
        "description": "Win 5+ matches",
        "check": lambda s: s["wins"] >= 5,
        "progress_hint": lambda s: (min(s["wins"], 5), 5),
    },
    {
        "key": "champion",
        "label": "Champion",
        "icon": "fas fa-medal",
        "color": "from-amber-400 to-yellow-500",
        "rarity": "PLATINUM",
        "description": "Win 20+ matches",
        "check": lambda s: s["wins"] >= 20,
        "progress_hint": lambda s: (min(s["wins"], 20), 20),
    },
]

RARITY_ORDER = {"BRONZE": 0, "SILVER": 1, "GOLD": 2, "PLATINUM": 3}

# Level thresholds based on total badges earned
LEVELS = [
    (0,  "Rookie",    "fas fa-seedling",   "from-gray-400 to-slate-500"),
    (3,  "Amateur",   "fas fa-user",        "from-blue-400 to-cyan-500"),
    (6,  "Club",      "fas fa-shield-alt",  "from-green-400 to-emerald-500"),
    (9,  "Pro",       "fas fa-star",        "from-yellow-400 to-amber-500"),
    (12, "Elite",     "fas fa-crown",       "from-purple-500 to-pink-500"),
    (15, "Legend",    "fas fa-trophy",      "from-amber-400 to-orange-500"),
]


def _get_level(earned_count: int):
    level = LEVELS[0]
    for threshold, name, icon, color in LEVELS:
        if earned_count >= threshold:
            level = (threshold, name, icon, color)
    idx = LEVELS.index(level)
    next_threshold = LEVELS[idx + 1][0] if idx + 1 < len(LEVELS) else level[0]
    prev_threshold = level[0]
    span = max(next_threshold - prev_threshold, 1)
    xp_in_level = earned_count - prev_threshold
    xp_pct = min(round((xp_in_level / span) * 100), 100)
    return {
        "name": level[1],
        "icon": level[2],
        "color": level[3],
        "xp_pct": xp_pct,
        "next_level": LEVELS[idx + 1][1] if idx + 1 < len(LEVELS) else None,
        "badges_to_next": max(next_threshold - earned_count, 0),
    }


def _compute_stats(entries):
    if not entries:
        return None
    return {
        "matches": len(entries),
        "total_runs": sum(e.runs for e in entries),
        "total_fours": sum(e.fours for e in entries),
        "total_sixes": sum(e.sixes for e in entries),
        "total_wickets": sum(e.wickets for e in entries),
        "total_catches": sum(e.catches for e in entries),
        "highest_score": max(e.runs for e in entries),
        "best_wickets": max(e.wickets for e in entries),
        "wins": sum(1 for e in entries if e.result == "Won"),
    }


def _compute_streak(entries):
    if not entries:
        return 0, 0, []
    dates = sorted({date.fromisoformat(e.match_date) for e in entries if e.match_date}, reverse=True)
    if not dates:
        return 0, 0, []

    today = date.today()
    current = 0
    if dates[0] >= today - timedelta(days=1):
        current = 1
        for i in range(1, len(dates)):
            if (dates[i - 1] - dates[i]).days == 1:
                current += 1
            else:
                break

    longest = 1
    run = 1
    for i in range(1, len(dates)):
        if (dates[i - 1] - dates[i]).days == 1:
            run += 1
            longest = max(longest, run)
        else:
            run = 1

    # Last 7 days activity map
    date_set = set(dates)
    week_activity = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        week_activity.append({"date": str(d), "active": d in date_set})

    return current, longest, week_activity


@router.get("/me")
def get_my_gamification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entries = (
        db.query(PlayerPerformanceEntry)
        .filter(PlayerPerformanceEntry.player_id == current_user.id)
        .all()
    )

    stats = _compute_stats(entries)
    current_streak, longest_streak, week_activity = _compute_streak(entries)

    stored = {
        b.badge_key: b.earned_at
        for b in db.query(PlayerBadge).filter(PlayerBadge.player_id == current_user.id).all()
    }

    earned_badges = []
    locked_badges = []
    next_badge = None
    best_locked_progress = -1.0

    for defn in BADGE_DEFS:
        earned = stats is not None and defn["check"](stats)
        hint = defn["progress_hint"](stats) if stats else (0, defn["progress_hint"]({"matches":0,"total_runs":0,"total_fours":0,"total_sixes":0,"total_wickets":0,"total_catches":0,"highest_score":0,"best_wickets":0,"wins":0}))
        cur_val, target_val = hint
        progress_pct = round((cur_val / target_val) * 100) if target_val else 0

        badge = {
            "key": defn["key"],
            "label": defn["label"],
            "icon": defn["icon"],
            "color": defn["color"],
            "rarity": defn["rarity"],
            "description": defn["description"],
            "earned": earned,
            "progress_current": cur_val,
            "progress_target": target_val,
            "progress_pct": progress_pct,
            "earned_at": str(stored[defn["key"]]) if defn["key"] in stored else None,
        }

        if earned:
            if defn["key"] not in stored:
                db.add(PlayerBadge(player_id=current_user.id, badge_key=defn["key"]))
            earned_badges.append(badge)
        else:
            locked_badges.append(badge)
            if progress_pct > best_locked_progress:
                best_locked_progress = progress_pct
                next_badge = badge

    db.commit()

    # Sort earned by rarity desc
    earned_badges.sort(key=lambda b: RARITY_ORDER.get(b["rarity"], 0), reverse=True)
    locked_badges.sort(key=lambda b: -b["progress_pct"])

    # Upsert streak
    last_date = str(max((date.fromisoformat(e.match_date) for e in entries if e.match_date), default=date.today())) if entries else None
    streak_row = db.query(PlayerStreak).filter(PlayerStreak.player_id == current_user.id).first()
    if streak_row:
        streak_row.current_streak = str(current_streak)
        streak_row.longest_streak = str(max(int(streak_row.longest_streak or 0), longest_streak))
        streak_row.last_activity_date = last_date
    else:
        streak_row = PlayerStreak(
            player_id=current_user.id,
            current_streak=str(current_streak),
            longest_streak=str(longest_streak),
            last_activity_date=last_date,
        )
        db.add(streak_row)
    db.commit()

    level = _get_level(len(earned_badges))

    return {
        "level": level,
        "streak": {
            "current": current_streak,
            "longest": int(streak_row.longest_streak or 0),
            "last_activity": last_date,
            "week_activity": week_activity,
        },
        "badges": {
            "earned": earned_badges,
            "locked": locked_badges,
            "total_earned": len(earned_badges),
            "total": len(BADGE_DEFS),
            "next_badge": next_badge,
        },
    }
