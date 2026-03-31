-- Cricket Highlight Platform - Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============ Users ============
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    role VARCHAR(20) NOT NULL CHECK (role IN ('PLAYER', 'COACH', 'ADMIN')),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    profile_bio TEXT,
    jersey_number INTEGER,
    team VARCHAR(100),
    stripe_customer_id VARCHAR(255),
    
    -- Authentication
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verified_at TIMESTAMPTZ,
    
    -- Password reset
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMPTZ,
    
    -- Security
    last_login TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============ User Sessions ============
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(512) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON user_sessions(refresh_token);

-- ============ Videos ============
CREATE TABLE IF NOT EXISTS videos (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    
    -- Metadata
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500),
    duration_seconds INTEGER,
    file_size_bytes INTEGER,
    
    -- Match info
    match_date DATE,
    teams VARCHAR(200),
    venue VARCHAR(200),
    
    -- Visibility & ownership
    visibility VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
    uploaded_by VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Processing
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    processing_error TEXT,
    
    -- Statistics
    total_events INTEGER DEFAULT 0,
    total_fours INTEGER DEFAULT 0,
    total_sixes INTEGER DEFAULT 0,
    total_wickets INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_videos_visibility ON videos(visibility);
CREATE INDEX idx_videos_uploaded_by ON videos(uploaded_by);
CREATE INDEX idx_videos_status ON videos(status);

-- ============ Highlight Events (4s, 6s, Wickets) ============
CREATE TABLE IF NOT EXISTS highlight_events (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    video_id VARCHAR(36) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    
    -- Event data
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('FOUR', 'SIX', 'WICKET')),
    timestamp_seconds FLOAT NOT NULL,
    
    -- Score context
    score_before VARCHAR(20),
    score_after VARCHAR(20),
    overs VARCHAR(10),
    
    -- Generated clip
    clip_path VARCHAR(500),
    clip_duration_seconds FLOAT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_video_id ON highlight_events(video_id);
CREATE INDEX idx_events_type ON highlight_events(event_type);

-- ============ Highlight Jobs (OCR Processing) ============
CREATE TABLE IF NOT EXISTS highlight_jobs (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    video_id VARCHAR(36) UNIQUE NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    progress_percent INTEGER DEFAULT 0,
    
    -- Configuration
    config JSONB,
    
    -- Metrics
    frames_processed INTEGER DEFAULT 0,
    ocr_success_rate FLOAT,
    
    -- Results
    events_detected JSONB,
    supercut_path VARCHAR(500),
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_jobs_video_id ON highlight_jobs(video_id);
CREATE INDEX idx_jobs_status ON highlight_jobs(status);

-- ============ Match Requests (Voting System) ============
CREATE TABLE IF NOT EXISTS match_requests (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    
    -- Match details
    match_title VARCHAR(255) NOT NULL,
    match_date DATE,
    teams VARCHAR(200),
    venue VARCHAR(200),
    description TEXT,
    video_url VARCHAR(500),
    
    -- Voting
    vote_count INTEGER DEFAULT 1,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
    
    -- Tracking
    requested_by VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fulfilled_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    fulfilled_video_id VARCHAR(36) REFERENCES videos(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_requests_status ON match_requests(status);
CREATE INDEX idx_requests_votes ON match_requests(vote_count DESC);

-- ============ User Votes ============
CREATE TABLE IF NOT EXISTS user_votes (
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id VARCHAR(36) NOT NULL REFERENCES match_requests(id) ON DELETE CASCADE,
    voted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, request_id)
);

-- ============ Processing Jobs (Legacy) ============
CREATE TABLE IF NOT EXISTS processing_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(36) UNIQUE NOT NULL,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    match_id VARCHAR(255) NOT NULL,
    data_source VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    
    -- Results
    video_id VARCHAR(255),
    total_clips INTEGER,
    total_events INTEGER,
    result_data JSONB,
    
    -- Error
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_processing_jobs_user ON processing_jobs(user_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);

-- ============ Video Views (Analytics) ============
CREATE TABLE IF NOT EXISTS video_views (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    video_id VARCHAR(36) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    viewed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_views_video ON video_views(video_id);
CREATE INDEX idx_views_date ON video_views(viewed_at);

-- ============ Helper Functions ============
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_match_requests_updated_at
    BEFORE UPDATE ON match_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
