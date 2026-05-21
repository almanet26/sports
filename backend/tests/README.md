# Backend Test Suite

Integration and unit tests for the cricket highlight platform backend.

## Stack

| Tool | Purpose |
|---|---|
| `pytest` | Test runner |
| `pytest-asyncio` | Async test support (`asyncio_mode = auto`) |
| `pytest-mock` | Mock/patch utilities |
| `SQLite (in-memory)` | Isolated DB — never touches production |

Install test dependencies:
```bash
pip install -r requirements-test.txt
```

## Running Tests

```bash
# All tests
pytest tests/

# Specific file
pytest tests/test_gates.py
pytest tests/test_atomic_increment.py
pytest tests/test_mocked_services.py

# Specific test
pytest tests/test_gates.py::TestRequireFeature::test_admin_bypasses_all_gates

# Verbose
pytest tests/ -v

# With coverage
pytest tests/ --cov=. --cov-report=html
```

---

## Test Files

### `test_gates.py` — Access Control (19 tests)

Tests `dependencies/feature_gate.py` and `dependencies/quota_gate.py` by calling the inner `_gate` functions directly with explicit `user` and `db` arguments, bypassing FastAPI DI entirely.

**`TestRequireFeature` — `require_feature(feature_key)`**

| Test | What it asserts |
|---|---|
| `test_free_user_blocked_from_pdf_report` | Free tier → 403 `tier_required`, correct `required`/`current` fields |
| `test_platinum_user_allowed_pdf_report` | Platinum tier → gate passes, user object returned |
| `test_inactive_subscription_raises_402` | Expired subscription → 402 `subscription_inactive` |
| `test_no_subscription_raises_402` | No subscription row at all → 402 |
| `test_lazy_expiry_flips_active_to_expired` | Subscription marked `active` but `expires_at` past → status flipped to `expired` in DB, gate raises 402 |
| `test_platinum_can_access_basic_feature` | Higher tier passes gates for lower-tier features |
| `test_admin_bypasses_all_gates` | `role=ADMIN` with no subscription row passes every gate unconditionally |
| `test_player_blocked_from_coach_only_feature` | `PLAYER` account on `ocr_highlights` → 403 `wrong_account_type` |
| `test_coach_blocked_from_player_only_feature` | `COACH` account on `player_submission` → 403 `wrong_account_type` |
| `test_ai_chat_blocks_free_player` | Free player on `ai_chat` → 403, `required=basic` |
| `test_ai_chat_allows_basic_player` | Basic player on `ai_chat` → passes |
| `test_ai_chat_blocks_coach_free` | `coach_free` coach on `ai_chat` → 403, `required=coach_starter` |
| `test_ai_chat_allows_coach_starter` | `coach_starter` coach on `ai_chat` → passes |

**`TestQuotaCheck` — `quota_check(feature_key)`**

| Test | What it asserts |
|---|---|
| `test_quota_exceeded_raises_429` | `used == limit` → 429 with `error`, `used`, `limit`, `resets` fields |
| `test_quota_under_limit_passes` | `used < limit` → `(user, usage_row)` returned |
| `test_quota_no_usage_row_creates_and_passes` | No usage row → row created with zero counts, request allowed |
| `test_quota_exceeded_over_limit_also_blocked` | `used > limit` (concurrent-write scenario) → still 429 |
| `test_platinum_higher_quota_passes` | Usage of 3 blocks free (limit=3) but passes platinum (limit=50) |
| `test_admin_bypasses_quota` | `role=ADMIN` → dummy usage row returned, nothing written to DB |

---

### `test_atomic_increment.py` — Quota Increment (13 tests)

Tests `dependencies/quota_gate.increment_usage_atomic` and `increment_usage`.

**`TestIncrementUsageAtomic` — dispatch-time race-safe check-and-increment**

Single SQL `UPDATE … WHERE field + amount <= plan_limit` — returns `True` if applied, `False` if blocked.

| Test | What it asserts |
|---|---|
| `test_increment_under_limit_returns_true` | `count=2, +1, limit=3` → `True`, row updated to 3 |
| `test_increment_at_limit_returns_false` | `count=3, +1, limit=3` → `False`, row unchanged |
| `test_increment_would_exceed_limit_returns_false` | `count=2, +2, limit=3` → `False` (partial overshoot rejected atomically) |
| `test_increment_creates_row_if_missing` | No usage row → `INSERT OR IGNORE` creates it, increment applied |
| `test_increment_at_zero_limit_always_fails` | `coach_free` plan (`limit=0`) → always `False` |
| `test_increment_ocr_hours_under_limit` | Float field: `used=2.0, +1.5, limit=5.0` → `True`, result 3.5 |
| `test_increment_ocr_hours_exceeds_limit` | Float field: `used=4.0, +1.5, limit=5.0` → `False` |
| `test_invalid_field_raises_value_error` | Unknown field name → `ValueError` immediately |

**`TestIncrementUsage` — worker reconciliation (unconditional async upsert)**

Called by the Cloud Run worker after job completion. No quota check — records actual consumption regardless of plan limit.

| Test | What it asserts |
|---|---|
| `test_creates_row_and_increments` | No row → created and delta applied |
| `test_increments_existing_row` | Existing row → delta added |
| `test_exceeds_plan_limit_without_blocking` | `count=3, +10, limit=3` → succeeds (13 written), no cap enforced |
| `test_increments_ocr_hours` | Float delta applied correctly to `ocr_hours_used` |
| `test_invalid_field_raises_value_error` | Unknown field name → `ValueError` |

---

### `test_mocked_services.py` — External Service Isolation (11 tests)

Patches Google Cloud SDK clients so no real network call is made. Proves the service layer is wired correctly without requiring GCP credentials.

**`TestCloudTasksManager`**

| Test | What it asserts |
|---|---|
| `test_create_task_calls_client_create_task` | `create_processing_task` calls `client.create_task` exactly once |
| `test_task_payload_contains_video_id` | Task body is valid JSON with correct `video_id` and `config` |
| `test_task_targets_correct_worker_url` | `http_request.url` is `{worker_url}/process` |
| `test_no_real_network_call_made` | Smoke test: mock intercepts constructor, no I/O occurs |

**`TestGCSStorageManager`**

| Test | What it asserts |
|---|---|
| `test_upload_video_calls_blob_upload` | `upload_video` calls `blob.upload_from_filename(path, timeout=600)` |
| `test_upload_video_returns_gcs_uri` | Return value is `gs://bucket/folder/video_id.mp4` |
| `test_upload_video_uses_correct_blob_name` | Blob name is `{folder}/{video_id}{ext}` |
| `test_no_real_gcs_call_made` | Smoke test: mock is in place before any I/O runs |

**`TestOCRQueueRouting`**

| Test | What it asserts |
|---|---|
| `test_priority_tiers_use_priority_queue` | `coach_pro` / `academy` → `CloudTasksManager` instantiated with `ocr-priority` |
| `test_standard_tiers_use_standard_queue` | `coach_starter` / `coach_free` → `CloudTasksManager` instantiated with `ocr-standard` |
| `test_cloud_tasks_disabled_falls_back_to_background` | No `GCP_PROJECT_ID`/`WORKER_URL` → `BackgroundTasks.add_task` called, `CloudTasksManager` never instantiated |

> **Mock target note:** `CloudTasksManager` is imported lazily inside `_enqueue_ocr_task`, so it must be patched at `services.cloud_tasks_service.CloudTasksManager`, not `api.routes.jobs.CloudTasksManager`.

---

### `test_event_detection.py` — OCR Event Detection (14 tests)

Tests the wicket-prioritized event detection system in `scripts/`:

- FOUR detection (exact 4 runs)
- SIX detection with fuzzy matching (5, 6, 7 runs)
- WICKET detection (priority over boundaries)
- Wicket without runs (run outs)
- Huge score jump handling (no false events)
- Median smoothing (anti-flicker)
- Cooldown period (prevents duplicates)
- `ScoreState` dataclass functionality

### `test_ocr_logic.py` — Legacy OCR Logic (5 tests)

Tests legacy event detection logic (unittest-based):

- Jump persistence and recovery
- Normal event sequences
- Cooldown and debouncing
- Outlier rejection
- Edge cases (negative scores, wicket overflow)

### `test_predeploy_audit.py` — Pre-deploy Checks (7 tests)

Sanity checks run before every deployment.

---

## Test Fixtures (conftest.py)

### Plans seeded (session-scoped, persist across all tests)

Values mirror `main.py → _ensure_plan_config()` exactly.

| `plan_key` | `max_biomech` | `max_ocr_hours` | `max_submissions` | `max_players` |
|---|---|---|---|---|
| `free` | 3 | 0 | 0 | 0 |
| `coach_free` | 0 | 0 | 0 | 0 |
| `basic` | 15 | 0 | 5 | 0 |
| `platinum` | 50 | 0 | 15 | 0 |
| `coach_starter` | 999 | 50 | 150 | 10 |
| `coach_pro` | 999 | 150 | 600 | 100 |
| `academy` | 999 | 500 | 1500 | -1 (unlimited) |

### User fixtures (function-scoped, rolled back after each test)

| Fixture | `user.role` | `sub.role` | Primary use |
|---|---|---|---|
| `free_user` | `PLAYER` | `free` | quota limit tests |
| `basic_player_user` | `PLAYER` | `basic` | `ai_chat` player path |
| `platinum_user` | `PLAYER` | `platinum` | tier-pass tests |
| `coach_free_user` | `COACH` | `coach_free` | `ai_chat` coach block |
| `coach_starter_user` | `COACH` | `coach_starter` | OCR quota, coach pass |
| `coach_pro_user` | `COACH` | `coach_pro` | OCR quota, coach pass |
| `coach_academy_user` | `COACH` | `coach_academy` | OCR quota, coach pass |
| `admin_user` | `ADMIN` | *(none)* | bypass tests |

---

## Warnings Reference

| Warning | File | Action |
|---|---|---|
| `MovedIn20Warning: declarative_base()` | `database/config.py` | SQLAlchemy 2.0 migration — prod code |
| `PydanticDeprecatedSince20` | `utils/config.py`, `api/routes/messages.py` | Pydantic v2 migration — prod code |
| Google protobuf `PyType_Spec` metaclass | Google SDK | Nothing to do |

All warnings originate in production code or third-party SDKs. No warnings in test files.

---

## What Is Not Tested Yet

**Razorpay webhook** — `billing.py` is a stub (`TODO`). Add `test_billing_webhook.py` once `POST /billing/webhook` is implemented. The conftest fixtures and in-memory DB are already in place to support it.
