# Pending Improvements & Next Phase Recommendations

Based on the completion of the core OCR engine, player-uploaded biomechanics tracking, the coach roster/inbox tooling, the dynamic entitlement engine, and direct-to-GCS uploads, the following features and improvements are recommended for the next development phase in order to increase stability, scale, and feature completeness.

## ✅ Completed

### Pre-Signed URLs for Direct GCS Uploads
Client-side uploads now use real V4 GCS Signed URLs (`generate_signed_url` / `create_resumable_upload_session` in `backend/api/routes/storage.py`). The client requests a signed URL or resumable session from the backend and streams the file straight into GCS, bypassing FastAPI's buffer/RAM. A local resumable-upload fallback (`/local-resumable/{blob_path}`, mimicking GCS's chunked-PUT/308 protocol) was added so the same frontend upload client works in dev environments without a real GCS bucket.

---

## 1. Separate Highlight Reels for Batsmen and Bowlers
*   **Current State:** OCR reads both a `batsman_name` and a `bowler_name` ROI per frame, but only the batsman is attached to detected events (`event['batsman']` in `backend/scripts/ocr_engine.py`) as a raw OCR string. There is no equivalent bowler attribution (no wicket-taker/economy credit), and no mapping from OCR-scraped names to actual roster `User`/`CoachPlayer` records. Clip generation (`calculate_clip_ranges`, `extract_clips_parallel`) produces a single combined supercut per video — it does not distinguish "batting highlights" from "bowling highlights."
*   **Recommendation:**
    *   Capture `event['bowler']` alongside `event['batsman']` for every event (the bowler ROI is already read at OCR time, just not persisted onto events).
    *   Add a name-resolution step that matches OCR-scraped batsman/bowler strings to roster `User` records (via `CoachPlayer` / fuzzy matching), so events can be attributed to real players instead of raw OCR text.
    *   Extend the clip/supercut generation step to optionally produce two separate highlight reels per player: a **batting highlights** reel (boundaries/wickets while on strike) and a **bowling highlights** reel (wickets taken, tight overs), rather than one mixed supercut per video.

## 2. Complete Event-Driven Architecture (Pub/Sub)
*   **Current State:** Cloud Tasks are used to spawn operations, pushing back to the same Cloud Run service's worker endpoint. If a massive 12hr video triggers processing, the worker stays alive linearly.
*   **Recommendation:** Migrate heavy processing states entirely into **Google Cloud Pub/Sub**. The moment an upload completes, it drops a message onto a topic. A dedicated headless pool of background workers pulls off the queue, processes it rapidly, and commits back. This decouples the REST API totally from the video processing constraints.

## 3. Real-Time Processing Signals (WebSockets)
*   **Current State:** Users are given a "Processing" status and must refresh the UI to see if their highlight reel generates.
*   **Recommendation:** Integrate an asynchronous WebSocket connection (e.g., via FastAPI WebSockets or a third-party like Pusher) to relay real-time status. As the AI worker analyzes Video Chunk 1/20, the frontend dynamically fills a progress bar.

## 4. Advanced Biomechanics Features
*   **Current State:** MediaPipe provides structural layout rendering (Batting stance logic and bowling). No speed/velocity, frame-delta, or release-point/pitch-coordinate logic exists yet in `bowling_engine.py` / `batting_engine.py`.
*   **Recommendation:**
    *   Implement **Speed Tracking:** Use frame deltas to estimate bowler release speed.
    *   Implement **Release Point & Pitch Coordinates:** Projecting physics models based on standard cricket pitch dimensions using the tracked arm/elbow angles at the point of release.

## 5. Caching Layer (Redis)
*   **Recommendation:** Implement Memorystore (Redis). Instead of hitting the Postgres DB repeatedly for heavily accessed public match leaderboards or User Profiles, short-lived states and vote tracking can sit in cache to reduce database I/O costs.

## 6. Cloud Deployment of Highlight Generation Architecture
*   **Current State:** A standalone `backend/Dockerfile.worker` exists but is not wired into `cloudbuild.yaml` or `render.yaml` — both deploy a single web service, and `WORKER_SERVICE_URL` points back at that same service. The intensive highlight generation pipeline (`easyocr`, `opencv`, `ffmpeg`) still runs in-process on the main API container instead of being deployed separately.
*   **Recommendation:** Package the highlight engine into dedicated compute instances using **Google Cloud Run Jobs** or **GCP Batch**, actually deploying `Dockerfile.worker` as its own service. This ensures that heavy, prolonged video rendering and OCR tasks have dedicated CPU/Memory allocations (and potentially GPU acceleration) without bottlenecking the main FastAPI web server.

## 7. Automated Testing & Continuous Integration (CI/CD)
*   **Current State:** A solid unit test suite already exists (`backend/tests/test_event_detection.py`, `test_ocr_logic.py`, `test_gates.py`, `test_admin_plans.py`, `test_atomic_increment.py`) covering OCR delta/event detection, quota gates, and admin plan logic. However, there is no CI pipeline wiring these into pull requests (no `.github/workflows/`), no `ffmpeg` stitching integrity tests, and no frontend E2E coverage.
*   **Recommendation:** Add a **GitHub Actions** (or Cloud Build) workflow that runs the existing `pytest` suite plus the frontend build (`npm run build`) on every PR. Add integration tests for `ffmpeg` video stitching, and introduce frontend E2E tools (like Cypress or Playwright) to validate the user upload flow seamlessly.

## 8. Dynamic Scoreboard Detection (Auto ROI)
*   **Current State:** The system relies on static/manually-calibrated coordinates (`ScoreboardConfig` in `backend/scripts/ocr_engine.py`, `roi_calibrator.py`) for the Region of Interest (ROI) when reading the scoreboard, which risks failure if the broadcast layout changes.
*   **Recommendation:** Train a lightweight object detection model (e.g., YOLOv8 nano) to automatically locate the scoreboard bounding box in any video frame dynamically. Pass those bounding box coordinates to the OCR engine, making it 100% immune to broadcast graphics changes.
