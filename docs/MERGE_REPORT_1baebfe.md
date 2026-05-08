# Merge Report — Commit `1baebfe` into `kunal-backup-work`

**Date:** Cherry-picked and merged successfully  
**Build status:** ✅ 0 errors — `npm run build` passes  
**Pushed to:** `origin/kunal-backup-work`

---

## 1. What's NEW (added by the incoming commit)

### Backend — New Route Files

| File | Endpoints Added |
|---|---|
| `backend/api/routes/usage.py` | `POST /billing/create-order`, `GET /billing/usage`, `POST /internal/usage/report` |
| `backend/api/routes/chat.py` | `POST /chat/message`, `GET /chat/sessions`, `DELETE /chat/sessions/{id}` |
| `backend/api/routes/benchmarks.py` | `GET /benchmarks`, `POST /batting/{id}/compare`, `POST /bowling/{id}/compare` |
| `backend/api/routes/profile.py` | `POST /profile/setup`, `PATCH /profile/scouting`, `GET /profile/{id}/public` |
| `backend/api/routes/scouting.py` | `GET /scouting/players`, `GET /scouting/players/{id}`, `POST /scouting/shortlist`, `GET /scouting/shortlist`, `PATCH /scouting/shortlist/{id}`, `DELETE /scouting/shortlist/{id}` |
| `backend/api/routes/report.py` | `GET /batting/{id}/report`, `GET /bowling/{id}/report` |
| `backend/api/routes/annotations.py` | `POST /annotations`, `GET /annotations/{video_id}`, `PUT /annotations/{id}`, `DELETE /annotations/{id}` |
| `backend/api/routes/dashboard.py` | `GET /dashboard/players`, `POST /dashboard/players/invite`, `DELETE /dashboard/players/{id}`, `GET /dashboard/export` |
| `backend/api/routes/coach_inbox.py` | `POST /coach/submissions`, `GET /coach/submissions/inbox`, `PATCH /coach/submissions/{id}/status` |
| `backend/api/routes/academy.py` | `POST /academy/branding`, `GET /academy/branding` |

### Backend — New Dependency Files

| File | Purpose |
|---|---|
| `backend/dependencies/feature_gate.py` | Blocks access to features if user's subscription tier is too low |
| `backend/dependencies/quota_gate.py` | Enforces hard monthly quotas (biomech analyses, OCR hours, submissions) |
| `backend/config/feature_map.py` | Maps each feature name to the minimum required subscription tier |

### Backend — New Services

| File | Purpose |
|---|---|
| `backend/services/subscription_expiry.py` | Cron endpoint `POST /internal/cron/expire-subscriptions` — marks expired subscriptions |
| `backend/services/usage_service.py` | Increments and reads monthly usage counters per user |

### Backend — New Database Models

| Model File | Table | Purpose |
|---|---|---|
| `database/models/monthly_usage.py` | `monthly_usage` | Per-user monthly quota consumption (biomech, OCR hours, submissions) |
| `database/models/plan_config.py` | `plan_config` | Plan limits and pricing (replaces old `Plan` model) |
| `database/models/chat_history.py` | `chat_history` | AI chat message history per user |
| `database/models/player_profile.py` | `player_profiles` | Scouting profile (city, bat style, experience level, scouting visibility) |
| `database/models/player_submission.py` | `player_submissions` | Lightweight player → coach submission link |
| `database/models/pro_benchmark.py` | `pro_benchmarks` | Pro player benchmark data for comparison |
| `database/models/video_annotation.py` | `video_annotations` | Coach annotations on videos (coordinates, color, label) |
| `database/models/coach_player.py` | `coach_players` | Coach–player relationship tracking |
| `database/models/coach_shortlist.py` | `coach_shortlist` | Academy coach shortlisted players with notes |
| `database/models/academy_branding.py` | `academy_branding` | Academy logo, colors, name |
| `database/models/admin_audit_log.py` | `admin_audit_log` | Every admin action logged with before/after values |
| `database/models/enums.py` | — | Centralised enum values (`USER_ROLE_VALUES`) |

### Backend — New Alembic Migrations (7 new)

| Migration File | What it creates |
|---|---|
| `a1b2c3d4e5f6_add_coach_features.py` | Coach profile fields, coach_player table |
| `a4c8d1e2f903_add_coach_free_and_free_forever.py` | coach_free tier, free-forever plan |
| `b3b6af7782b4_add_roles_subscriptions_and_quota_tables.py` | subscriptions, monthly_usage, plan_config tables |
| `d7e9c3f1a842_add_player_features.py` | player_profiles, pro_benchmarks, chat_history tables |
| `e9f1a2b3c4d5_schema_cleanup_v2.py` | Schema cleanup, index additions |
| `f2a3b4c5d6e7_add_admin_audit_log.py` | admin_audit_log table |
| `h1i2j3k4l5m6_add_scouting_feature.py` | coach_shortlist, scouting visibility flag |

### Backend — New Scripts & Tests

| File | Purpose |
|---|---|
| `scripts/seed_roles.py` | Seeds test accounts for all 8 subscription tiers with fresh JWTs |
| `tests/conftest.py` | Pytest fixtures for quota/feature gate tests |
| `tests/test_gates.py` | Tests for quota enforcement and feature gating |

### Frontend — New Pages

| Page | Route | Purpose |
|---|---|---|
| `BillingPage.tsx` | `/billing` | Shows subscription plans, Razorpay payment, monthly quota usage |
| `ChatPage.tsx` | `/chat` | AI chat interface with session history |
| `ScoutingPage.tsx` | `/coach/scouting` | Academy coach player browser with filters |
| `PlayerProfilePage.tsx` | `/player/profile` | Player's own scouting profile editor |
| `CoachProfilePage.tsx` | `/coach/profile` | Coach public profile page |
| `AdminAuditLogPage.tsx` | `/admin/audit-log` | Admin audit log viewer with pagination |

### Frontend — New Components

| Component | Purpose |
|---|---|
| `gates/FeatureGate.tsx` | Wraps any UI element — hides/shows based on subscription tier |
| `gates/QuotaGate.tsx` | Shows quota warning or hard block when monthly limit is reached |
| `gates/SubscriptionExpiredPrompt.tsx` | Full-screen prompt shown when subscription has expired |
| `gates/UpgradePrompt.tsx` | Upgrade CTA shown to users on lower tiers |
| `scouting/PlayerCard.tsx` | Player card for the scouting list grid |
| `scouting/PlayerDetailPanel.tsx` | Detailed player scouting panel with stats and shortlist button |

### Frontend — New Types

| File | Purpose |
|---|---|
| `types/subscriptionPlans.ts` | All tier definitions (`Tier`, `SubscriptionStatus`, `QuotaUsage`) |
| `types/plans.ts` | `PlanConfig` type matching the backend `plan_config` table |

### Monetization Tiers (now active)

| Tier | Role | Limits |
|---|---|---|
| `free` | PLAYER | 3 biomech analyses, no OCR, no submissions |
| `basic` | PLAYER | 15 biomech/month, 5 submissions |
| `platinum` | PLAYER | 50 biomech/month, 15 submissions |
| `coach_free` | COACH | Can receive submissions, no analysis |
| `coach_starter` | COACH | 150 submissions/month, 50 OCR hours |
| `coach_pro` | COACH | 600 submissions/month, 150 OCR hours |
| `academy` | COACH | 1500 submissions/month, 500 OCR hours, full scouting |

---

## 2. What was CHANGED in the INCOMING code (things I modified to fix the build)

These are places where the incoming commit's code had issues that I had to fix to make the build pass.

### `frontend/src/lib/api.ts`

| Change | Reason |
|---|---|
| Added `CoachAthlete` interface | `CoachInbox.tsx` imports it but incoming commit removed it |
| Added `PlayerProgress` interface | `CoachPlayerPerformance.tsx`, `PlayerDashboard.tsx`, `PlayerProfile.tsx` import it |
| Added `NotificationItem` interface | `CoachDashboard.tsx` imports it |
| Added `EarningsData` interface with `total_earned`, `pending`, `chart_data`, `transactions.player/type/status` | `CoachEarningsPage.tsx` uses all these fields |
| Added `ReviewItem` interface | `CoachReviewsPage.tsx` imports it |
| Added `MyCoach` interface with `existing_review` field | `PlayerMyCoachesPage.tsx` uses `existing_review` |
| Added `TrainingSession` interface with `topic`, `session_date`, `session_time`, `session_type`, `duration_minutes` as string | `CoachSessionsPage.tsx` uses these exact field names |
| Added `TrainingPlanData` interface with `analysis_type`, `plan_type`, `is_public` | `CoachTrainingPlansPage.tsx` uses these fields |
| Added `TrainingPlanCreate` interface with `analysis_type`, `plan_type`, `is_public` | `CoachTrainingPlansPage.tsx` uses these fields |
| Added `GamificationBadge` interface with `rarity`, `earned`, `label`, `color`, `icon`, `progress_current`, `progress_target`, `progress_pct` | `PlayerGamification.tsx` uses all these fields |
| Added `GamificationData` interface with `level` object, `streak` object, `badges` object | `PlayerGamification.tsx` destructures this exact shape |
| Added `PerformanceEntry` interface with `match_date`, `opponent`, `match_type`, `runs`, `fours`, `sixes`, `wickets`, `catches`, `result`, `balls_faced` etc. | `PlayerPerformance.tsx` uses these fields |
| Added `PerformanceStats` interface with `total_matches`, `total_runs`, `total_fours`, `total_sixes`, `highest_score`, `batting_average`, `total_wickets`, `bowling_average`, `total_catches`, `total_run_outs`, `wins`, `losses` | `PlayerPerformance.tsx` uses all these |
| Added `notificationsApi` with `getAll` method | `CoachDashboard.tsx` calls `notificationsApi.getAll()` |
| Added `earningsApi` with `getMyEarnings` method | `CoachEarningsPage.tsx` calls `earningsApi.getMyEarnings()` |
| Added `reviewsApi` with `getMyCoaches`, `getCoachReviews` methods | Pages call these method names |
| Added `sessionsApi`, `trainingPlansApi`, `gamificationApi`, `performanceApi` with all required methods | Pages import and use these |
| Added `coachAthletes`, `playerProgress`, `myProgress` directly into `submissionsApi` object | `CoachInbox`, `CoachPlayerPerformance`, `PlayerDashboard`, `PlayerProfile` call these on `submissionsApi` |
| Added `'ACCEPTED'` to `SubmissionSummary.status` union type | `CoachInbox.tsx` compares status to `'ACCEPTED'` |
| Made `TrainingSession.status` optional | `CoachSessionsPage.tsx` doesn't pass status when creating |
| Added `balls_faced`, `overs_bowled`, `runs_conceded`, `run_outs` to `PerformanceEntry` | `PlayerPerformance.tsx` submits these fields |

### `frontend/src/store/authStore.ts`

| Change | Reason |
|---|---|
| Added `coach_status?: string` to `User` interface | `CoachSettingsPage.tsx` and `LoginPage.tsx` access `user.coach_status` |

### `frontend/src/pages/CoachReviewsPage.tsx`

| Change | Reason |
|---|---|
| Changed `reviewsApi.getCoachReviews(user.id)` → `reviewsApi.getCoachReviews()` | Method takes 0 arguments |

### `frontend/src/pages/PlayerMyCoachesPage.tsx`

| Change | Reason |
|---|---|
| Changed `reviewsApi.submitReview({ coach_id, rating, comment })` → `reviewsApi.submitReview(id, rating, comment)` | Method signature is positional, not object |

### `frontend/src/pages/CoachPlayerPerformance.tsx`

| Change | Reason |
|---|---|
| Added type cast on `TREND_CONFIG[summary.improvement_trend]` | TypeScript doesn't allow string indexing on a literal object type |

### `backend/schemas/auth.py`

| Change | Reason |
|---|---|
| Added `IntroVideoResponse` class back | `auth.py` imports it but incoming commit removed it |

---

## 3. What was CHANGED in YOUR features

### ✅ Fully Preserved (no changes)

| Your Feature | Status |
|---|---|
| `utils/gcs_upload.py` — centralised GCS helper | ✅ Intact |
| Profile image upload — 1 MB limit → GCS | ✅ Intact |
| Coach intro video upload — 10 MB limit → GCS | ✅ Intact |
| Submission video upload — 10 MB limit → GCS | ✅ Intact |
| Annotated videos → GCS after analysis | ✅ Intact |
| Key frames → GCS after extraction | ✅ Intact |
| PDF reports → GCS on publish | ✅ Intact |
| Coach content files + thumbnails → GCS | ✅ Intact |
| GCS download before MediaPipe analysis | ✅ Intact |

### ⚠️ Changed by the Incoming Commit (not by me)

| Your Feature | What Changed | Who Changed It |
|---|---|---|
| `POST /auth/coach-profile` endpoint | **Removed** — document upload merged into `POST /auth/register` directly. Coaches now upload their document at registration, not after first login | Incoming commit |
| `coach_status = 'incomplete'` on register | Changed to `'pending'` — coaches now start as `pending` instead of `incomplete` | Incoming commit |
| Coach document upload in `/register` | Now uses your `upload_file_to_gcs()` helper (I updated this during conflict resolution) | I updated to use GCS |
| `subscription_plan` column on `User` model | **Removed** — replaced by the new `subscriptions` table with `role` column | Incoming commit |
| Old `Plan` model (`database/models/plan.py`) | **Deleted** — replaced by `PlanConfig` model | Incoming commit |
| Old `plan.py` route (`api/routes/plan.py`) | **Deleted** — replaced by `subscription.py` and `admin.py` plan endpoints | Incoming commit |
| `ProfilePage.tsx` | **Deleted** — replaced by `PlayerProfilePage.tsx` and `CoachProfilePage.tsx` | Incoming commit |

---

## 4. Files Deleted by the Incoming Commit

### Backend
- `backend/api/routes/plan.py` — replaced by `subscription.py` + admin plan endpoints
- `backend/api/routes/players.py` — functionality moved into other routes
- `backend/database/models/plan.py` — replaced by `plan_config.py`
- `backend/database/models/player.py` — replaced by `player_profile.py`
- `backend/schemas/plan_schema.py` — replaced by `types/plans.ts` on frontend
- `backend/check_coaches.py`, `check_db.py`, `check_status.py` — dev utility scripts removed
- `backend/create_admin.py`, `create_admin_user.py` — replaced by `seed_roles.py`
- `backend/migrate_db.py`, `migrate_db_columns.py`, `migrate_postgres.py`, `migrate_subscription_coach.py` — old one-off migration scripts removed
- `backend/export_youtube_cookies.py` — removed
- `backend/test_multi_attempt.py` — removed

### Frontend
- `frontend/src/pages/ProfilePage.tsx` — replaced by `PlayerProfilePage.tsx` + `CoachProfilePage.tsx`
- `frontend/src/components/AdminCoachVerification.tsx` — merged into `AdminUsersPage.tsx`
- `frontend/src/components/CoachDocumentUpload.tsx` — upload now in register flow
- `frontend/src/components/PasswordEyeToggle.tsx`, `PasswordToggle.tsx` — removed (duplicates)
- `frontend/src/components/VideoUpload.tsx` (both locations) — removed
- `frontend/src/types/heavy-video-uploader.d.ts` — removed

---

## 5. Temporary Files Created During Merge (can be deleted)

These Python scripts were created to fix the build and are no longer needed:

```
fix_api.py
patch_api.py
patch2.py
patch3.py
```

You can delete them with:
```bash
cd sports
del fix_api.py patch_api.py patch2.py patch3.py
git add -A && git commit -m "chore: remove temp merge patch scripts" && git push origin kunal-backup-work
```
