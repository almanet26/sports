# Database Schema Documentation

Complete reference for PostgreSQL database structure and relationships.

---

## 📋 Tables Overview

```
Entitlements (Dynamic)
  ├─ Plan (bronze, silver, gold, coach_basic, coach_platinum)
  ├─ Feature (biomechanics_analysis, ocr_highlights, etc.)
  └─ PlanEntitlement (links plan → feature with value)

Users
  ├─ UserSession
  ├─ Subscription (links user → plan with expiry)
  ├─ FeatureUsage (tracks monthly consumption)
  ├─ Video
  │   ├─ HighlightEvent
  │   ├─ HighlightJob
  │   └─ MatchRequest
  ├─ BattingAnalysis
  ├─ BowlingAnalysis
  ├─ VideoSubmission
  ├─ VideoAnnotation
  └─ UserVote
```

---

## Table: `users`

Stores user accounts with authentication and profile info. Subscription is tracked in separate `Subscription` table.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('PLAYER', 'COACH', 'ADMIN')),
    phone VARCHAR(20),
    team VARCHAR(100),
    
    -- Coach-specific fields (only if role='COACH')
    coach_status VARCHAR(20) DEFAULT 'pending' CHECK (coach_status IN ('pending', 'approved', 'rejected')),
    coach_document_url TEXT,  -- Path to KYC/coaching credentials
    
    -- Payment (Razorpay, not Stripe)
    razorpay_customer_id VARCHAR(255),
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_email CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_coach_status ON users(coach_status);
```

**Relationships:**
- `1:N` with UserSession (one user, many sessions)
- `1:N` with Video (one user, multiple uploads)
- `1:N` with BattingAnalysis
- `1:N` with BowlingAnalysis
- `1:N` with VideoSubmission (as player_id or coach_id)

---

## Table: `user_session`

Tracks JWT refresh tokens for session management.

```sql
CREATE TABLE user_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT refresh_token_unique UNIQUE (refresh_token_hash)
);

CREATE INDEX idx_user_session_user_id ON user_session(user_id);
CREATE INDEX idx_user_session_expires_at ON user_session(expires_at);
```

---

## Table: `plan` (Dynamic Entitlements)

Defines subscription plans (Bronze, Silver, Gold, Coach Basic, Coach Platinum).

```sql
CREATE TABLE plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,  -- 'bronze', 'silver', 'gold', 'coach_basic', 'coach_platinum'
    display_name VARCHAR(100) NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('player', 'coach')),
    
    -- Pricing
    price_inr INT DEFAULT 0,
    billing_period VARCHAR(20) NOT NULL CHECK (billing_period IN ('monthly', 'annual')),
    
    -- Ordering
    sort_order INT DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_plan_key ON plan(key);
CREATE INDEX idx_plan_user_type ON plan(user_type);

-- Example data:
-- ('bronze', 'Bronze', 'player', 0, 'monthly', 0)
-- ('silver', 'Silver', 'player', 20000, 'monthly', 1)
-- ('gold', 'Gold', 'player', 50000, 'monthly', 2)
-- ('coach_basic', 'Coach Basic', 'coach', 0, 'annual', 0)
-- ('coach_platinum', 'Coach Platinum', 'coach', 120000, 'annual', 1)
```

---

## Table: `feature` (Dynamic Entitlements)

Defines features/capabilities that plans grant to users.

```sql
CREATE TABLE feature (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,  -- 'biomechanics_analysis', 'ocr_highlights', 'pdf_report', etc.
    display_name VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('boolean', 'numeric')),
    description TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_feature_key ON feature(key);

-- Example data:
-- ('biomechanics_analysis', 'Biomechanical Analyses', 'numeric', 'AI biomechanical analyses per month')
-- ('ocr_highlights', 'OCR Match Hours', 'numeric', 'OCR match-hours of highlight generation per month')
-- ('pdf_report', 'Professional PDF Reports', 'boolean', 'Downloadable professional PDF performance reports')
-- ('ai_chat', 'AI Coach Chat', 'boolean', '24/7 virtual AI chat assistant')
```

---

## Table: `plan_entitlement` (Dynamic Entitlements)

Maps plans to features with assigned values.

```sql
CREATE TABLE plan_entitlement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plan(id) ON DELETE CASCADE,
    feature_id UUID NOT NULL REFERENCES feature(id) ON DELETE CASCADE,
    
    -- Value representation depends on feature.type:
    -- boolean feature: 'true' or 'false'
    -- numeric feature: integer/float as string, '-1' = unlimited, '0' = none
    value VARCHAR(255) NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_plan_feature UNIQUE (plan_id, feature_id)
);

CREATE INDEX idx_plan_entitlement_plan_id ON plan_entitlement(plan_id);
CREATE INDEX idx_plan_entitlement_feature_id ON plan_entitlement(feature_id);

-- Example data:
-- bronze + biomechanics_analysis = '3'
-- silver + biomechanics_analysis = '15'
-- silver + pdf_report = 'true'
-- gold + pdf_report = 'true'
-- gold + ai_chat = 'true'
-- coach_platinum + ocr_highlights = '50'
```

---

## Table: `subscription`

Links users to their active plans with expiry dates.

```sql
CREATE TABLE subscription (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plan(id) ON DELETE CASCADE,
    
    -- Dates (fixed-duration, not recurring)
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT future_expiry CHECK (expires_at > started_at)
);

CREATE INDEX idx_subscription_user_id ON subscription(user_id);
CREATE INDEX idx_subscription_plan_id ON subscription(plan_id);
CREATE INDEX idx_subscription_expires_at ON subscription(expires_at);
```

---

## Table: `feature_usage`

Tracks real-time feature consumption per user per month.

```sql
CREATE TABLE feature_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_id UUID NOT NULL REFERENCES feature(id) ON DELETE CASCADE,
    
    -- Year-month (e.g., '2026-07')
    billing_month VARCHAR(7) NOT NULL,
    
    -- Current usage (compared against entitlement limit)
    used INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_user_feature_month UNIQUE (user_id, feature_id, billing_month),
    CONSTRAINT non_negative_usage CHECK (used >= 0)
);

CREATE INDEX idx_feature_usage_user_id ON feature_usage(user_id);
CREATE INDEX idx_feature_usage_billing_month ON feature_usage(billing_month);
CREATE INDEX idx_feature_usage_user_month ON feature_usage(user_id, billing_month);
```

---

## Table: `video`

Stores uploaded cricket match videos and their processing status.

```sql
CREATE TABLE video (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_path VARCHAR(500) NOT NULL,  -- GCS path or local path
    
    -- Video metadata
    match_date DATE,
    teams TEXT,  -- JSON or comma-separated
    venue VARCHAR(255),
    duration_seconds INT,
    resolution VARCHAR(50),  -- "1920x1080"
    
    -- Status tracking
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'processing', 'failed', 'completed')),
    visibility VARCHAR(50) NOT NULL CHECK (visibility IN ('public', 'private')),
    
    -- Event counts
    total_fours INT DEFAULT 0,
    total_sixes INT DEFAULT 0,
    total_wickets INT DEFAULT 0,
    
    -- Relationships
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT title_not_empty CHECK (title != '')
);

CREATE INDEX idx_video_status ON video(status);
CREATE INDEX idx_video_visibility ON video(visibility);
CREATE INDEX idx_video_uploaded_by ON video(uploaded_by);
CREATE INDEX idx_video_created_at ON video(created_at DESC);
```

---

## Table: `highlight_event`

Individual detected events (4s, 6s, Wickets) from OCR analysis.

```sql
CREATE TABLE highlight_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES video(id) ON DELETE CASCADE,
    
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('FOUR', 'SIX', 'WICKET')),
    timestamp_seconds FLOAT NOT NULL,
    
    -- Score context
    score_before INT,
    score_after INT,
    batsman_name VARCHAR(100),
    
    -- Clip information
    clip_path VARCHAR(500),  -- Path to extracted clip
    clip_duration_seconds FLOAT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_timestamp CHECK (timestamp_seconds >= 0)
);

CREATE INDEX idx_highlight_event_video_id ON highlight_event(video_id);
CREATE INDEX idx_highlight_event_type ON highlight_event(event_type);
CREATE INDEX idx_highlight_event_timestamp ON highlight_event(video_id, timestamp_seconds);
```

---

## Table: `highlight_job`

Tracks OCR processing jobs and their progress.

```sql
CREATE TABLE highlight_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES video(id) ON DELETE CASCADE,
    
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    progress_percent INT DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    
    -- Processing details
    current_phase VARCHAR(255),  -- "Extracting frames", "Detecting events", etc.
    events_detected INT DEFAULT 0,
    supercut_path VARCHAR(500),
    
    -- Error tracking
    error_message TEXT,
    retry_count INT DEFAULT 0,
    
    -- Metadata
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_progress CHECK (progress_percent >= 0 AND progress_percent <= 100)
);

CREATE INDEX idx_highlight_job_video_id ON highlight_job(video_id);
CREATE INDEX idx_highlight_job_status ON highlight_job(status);
CREATE INDEX idx_highlight_job_created_at ON highlight_job(created_at DESC);
```

---

## Table: `match_request`

Community requests for specific cricket matches.

```sql
CREATE TABLE match_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    match_title VARCHAR(255) NOT NULL,
    match_date DATE,
    teams TEXT,  -- JSON: {"team1": "India", "team2": "Pakistan"}
    description TEXT,
    
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'rejected')),
    vote_count INT DEFAULT 1,
    
    -- Links
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fulfilled_video_id UUID REFERENCES video(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_match_request_status ON match_request(status);
CREATE INDEX idx_match_request_vote_count ON match_request(vote_count DESC);
CREATE INDEX idx_match_request_created_at ON match_request(created_at DESC);
```

---

## Table: `user_vote`

Tracks votes on match requests (one vote per user per request).

```sql
CREATE TABLE user_vote (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES match_request(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_vote UNIQUE (user_id, request_id)
);

CREATE INDEX idx_user_vote_request_id ON user_vote(request_id);
CREATE INDEX idx_user_vote_user_id ON user_vote(user_id);
```

---

## Table: `batting_analysis`

Stores batting biomechanics analysis results.

```sql
CREATE TABLE batting_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    video_path VARCHAR(500) NOT NULL,
    video_duration_seconds FLOAT,
    
    -- Results (stored as JSON)
    biometrics JSONB,  -- {stance_angle, bat_lift_height, ...}
    detected_flaws JSONB,  -- [{flaw, severity, frames, correction}, ...]
    drill_recommendations TEXT[],
    
    -- Outputs
    analyzed_video_path VARCHAR(500),  -- With skeleton overlay
    pdf_report_url VARCHAR(500),
    
    -- Status
    status VARCHAR(50) DEFAULT 'completed',
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_batting_analysis_user_id ON batting_analysis(user_id);
CREATE INDEX idx_batting_analysis_created_at ON batting_analysis(created_at DESC);
```

---

## Table: `bowling_analysis`

Stores bowling biomechanics analysis results.

```sql
CREATE TABLE bowling_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    video_path VARCHAR(500) NOT NULL,
    video_duration_seconds FLOAT,
    
    -- Results (stored as JSON)
    biometrics JSONB,  -- {run_up_speed, release_height, ball_speed, ...}
    detected_flaws JSONB,  -- [{flaw, severity, frames, correction}, ...]
    drill_recommendations TEXT[],
    
    -- Outputs
    analyzed_video_path VARCHAR(500),  -- With skeleton overlay
    pdf_report_url VARCHAR(500),
    
    -- Status
    status VARCHAR(50) DEFAULT 'completed',
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bowling_analysis_user_id ON bowling_analysis(user_id);
CREATE INDEX idx_bowling_analysis_created_at ON bowling_analysis(created_at DESC);
```

---

## Table: `video_submission`

Stores player submissions for coach review.

```sql
CREATE TABLE video_submission (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    video_path VARCHAR(500) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN 
        ('PENDING', 'PROCESSING', 'DRAFT_REVIEW', 'PUBLISHED', 'REJECTED')),
    
    -- Coach feedback
    feedback_text TEXT,
    ai_analysis JSONB,  -- From MediaPipe analysis
    
    -- Generated reports
    pdf_report_url VARCHAR(500),
    is_public BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_video_submission_player_id ON video_submission(player_id);
CREATE INDEX idx_video_submission_coach_id ON video_submission(coach_id);
CREATE INDEX idx_video_submission_status ON video_submission(status);
CREATE INDEX idx_video_submission_created_at ON video_submission(created_at DESC);
```

---

## Table: `processing_job`

Generic job queue for background tasks.

```sql
CREATE TABLE processing_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    job_type VARCHAR(50) NOT NULL,  -- 'OCR', 'BATTING', 'BOWLING', 'SUBMISSION'
    status VARCHAR(50) DEFAULT 'pending',
    
    -- References
    video_id UUID REFERENCES video(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Payload & results
    task_data JSONB,
    result_data JSONB,
    error_message TEXT,
    
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_processing_job_status ON processing_job(status);
CREATE INDEX idx_processing_job_video_id ON processing_job(video_id);
CREATE INDEX idx_processing_job_created_at ON processing_job(created_at DESC);
```

---

## Relationships Diagram

```
users (1) ────────────────── (N) video
  │         uploaded_by              │
  │                                  ├─ (1:N) highlight_event
  │                                  ├─ (1:N) highlight_job
  │                                  └─ (1:N) match_request
  │
  ├── (1:N) user_session
  ├── (1:N) batting_analysis
  ├── (1:N) bowling_analysis
  ├── (1:N) video_submission (as player_id)
  ├── (1:N) video_submission (as coach_id)
  └── (1:N) user_vote

match_request (1) ────────── (N) user_vote
                                    │
                                    └─ (user_id) users

video_submission (1) ───────── (1) users (player_id)
                       ───────── (1) users (coach_id)
```

---

## Views (Helpful Queries)

```sql
-- Active users per role
CREATE VIEW active_users_by_role AS
SELECT role, COUNT(*) as count
FROM users
WHERE is_active = true
GROUP BY role;

-- OCR jobs by status (today)
CREATE VIEW ocr_jobs_today AS
SELECT status, COUNT(*) as count
FROM highlight_job
WHERE created_at::DATE = CURRENT_DATE
GROUP BY status;

-- Most popular match requests
CREATE VIEW top_match_requests AS
SELECT * FROM match_request
WHERE status = 'pending'
ORDER BY vote_count DESC
LIMIT 10;
```

---

## Migrations & Schema Changes

### Adding a New Column
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_field VARCHAR(255);
```

### Creating an Index
```sql
CREATE INDEX idx_name ON table_name(column_name);
```

### Backing Up Data
```bash
pg_dump -U postgres sports_dev > backup.sql
```

### Restoring from Backup
```bash
psql -U postgres sports_dev < backup.sql
```

---

**Last Updated:** March 16, 2026
