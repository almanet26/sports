"""
Database migration script to add missing tables.
Run this script to create the match_requests, user_votes, and other missing tables.
"""
import sqlite3
import os

db_path = 'cricket_analytics.db'

# SQL to create missing tables
CREATE_VIDEOS = """
CREATE TABLE IF NOT EXISTS videos (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_seconds INTEGER,
    match_date DATE,
    teams VARCHAR(200),
    venue VARCHAR(200),
    visibility VARCHAR(20) DEFAULT 'PRIVATE',
    status VARCHAR(20) DEFAULT 'PENDING',
    total_events INTEGER DEFAULT 0,
    total_fours INTEGER DEFAULT 0,
    total_sixes INTEGER DEFAULT 0,
    total_wickets INTEGER DEFAULT 0,
    file_path VARCHAR(500),
    original_filename VARCHAR(255),
    file_size INTEGER,
    uploaded_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
"""

CREATE_HIGHLIGHT_JOBS = """
CREATE TABLE IF NOT EXISTS highlight_jobs (
    id VARCHAR(36) PRIMARY KEY,
    video_id VARCHAR(36) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING',
    total_frames INTEGER,
    processed_frames INTEGER DEFAULT 0,
    progress_pct REAL DEFAULT 0.0,
    roi_coordinates TEXT,
    ocr_engine VARCHAR(50) DEFAULT 'easyocr',
    ocr_config TEXT,
    error_message TEXT,
    supercut_path VARCHAR(500),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

CREATE_HIGHLIGHT_EVENTS = """
CREATE TABLE IF NOT EXISTS highlight_events (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL REFERENCES highlight_jobs(id) ON DELETE CASCADE,
    video_id VARCHAR(36) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL,
    frame_number INTEGER NOT NULL,
    timestamp_seconds REAL NOT NULL,
    runs_before INTEGER,
    runs_after INTEGER,
    wickets_before INTEGER,
    wickets_after INTEGER,
    confidence_score REAL,
    thumbnail_path VARCHAR(500),
    clip_start_time REAL,
    clip_end_time REAL,
    clip_path VARCHAR(500),
    ocr_raw_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

CREATE_MATCH_REQUESTS = """
CREATE TABLE IF NOT EXISTS match_requests (
    id VARCHAR(36) PRIMARY KEY,
    youtube_url VARCHAR(500) NOT NULL,
    match_title VARCHAR(255),
    match_date DATE,
    teams VARCHAR(200),
    venue VARCHAR(200),
    description TEXT,
    vote_count INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending',
    requested_by VARCHAR(36) NOT NULL REFERENCES users(id),
    fulfilled_by VARCHAR(36) REFERENCES users(id),
    fulfilled_video_id VARCHAR(36) REFERENCES videos(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);
"""

CREATE_USER_VOTES = """
CREATE TABLE IF NOT EXISTS user_votes (
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    request_id VARCHAR(36) NOT NULL REFERENCES match_requests(id),
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, request_id)
);
"""

def main():
    print(f"Migrating database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check existing tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing = [t[0] for t in cursor.fetchall()]
    print(f"Existing tables: {existing}")
    
    # Create missing tables
    tables_to_create = [
        ('videos', CREATE_VIDEOS),
        ('highlight_jobs', CREATE_HIGHLIGHT_JOBS),
        ('highlight_events', CREATE_HIGHLIGHT_EVENTS),
        ('match_requests', CREATE_MATCH_REQUESTS),
        ('user_votes', CREATE_USER_VOTES),
    ]
    
    for table_name, sql in tables_to_create:
        if table_name not in existing:
            print(f"Creating table: {table_name}")
            cursor.execute(sql)
        else:
            print(f"Table already exists: {table_name}")
    
    conn.commit()
    
    # Verify creation
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    final_tables = [t[0] for t in cursor.fetchall()]
    print(f"\nFinal tables: {final_tables}")
    
    # Show match_requests schema
    cursor.execute("PRAGMA table_info(match_requests)")
    columns = cursor.fetchall()
    print("\nmatch_requests columns:")
    for col in columns:
        print(f"  {col[1]}: {col[2]} {'NOT NULL' if col[3] else ''}")
    
    conn.close()
    print("\nMigration complete!")

if __name__ == '__main__':
    main()
