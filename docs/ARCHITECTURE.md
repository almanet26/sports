# System Architecture & Design

## 1. High-Level Architecture
The platform follows a decoupled, microservices-oriented architecture suitable for AI-heavy workloads. 
- **Frontend Layer:** A Single Page Application (SPA) built in React and Vite. Hosted on Vercel or Firebase Hosting.
- **API Gateway / Engine:** FastAPI providing RESTful endpoints, JWT Auth, and routing for user requests.
- **Asynchronous Workers:** Processing full match highlights and AI biomechanics is non-blocking. Cloud Tasks dispatches workloads to background Cloud Run worker instances.

---

## 2. Component Design & Interactions

```mermaid
graph TD
    User((User)) -->|Uploads/Clicks| Frontend[React SPA]
    Frontend -->|REST API| Auth[JWT Auth Middleware]
    Auth --> APIServer[FastAPI - Main]
    
    APIServer <-->|Read/Write| SupabaseDB[(Supabase PostgreSQL)]
    APIServer -->|Generate Signed URL| GCS[(Cloud Storage)]
    User -->|Direct Upload via Signed URL| GCS
    
    APIServer -->|Triggers JSON Payload| CloudTasks{GCP Cloud Tasks}
    CloudTasks -->|Webhook/POST| Worker[Cloud Run - Worker Hub]
    
    Worker -->|Fetch Video| GCS
    Worker --> OCREngine[EasyOCR Engine]
    Worker --> PoseEngine[MediaPipe Pose Engine]
    Worker --> FFmpeg[FFmpeg Clipper]
    
    OCREngine -->|Generates Timestamps| FFmpeg
    PoseEngine -->|Generates Tracked Frames| FFmpeg
    
    FFmpeg -->|Saves Result| GCS
    Worker -->|Update DB Status to 'Completed'| SupabaseDB
```

---

## 3. Database Schema Layout Context
**PostgreSQL** acts as the singular source of truth.
*   `Users Table:` Stores profiles, hashed passwords, and account roles (`PLAYER`, `COACH`, `ADMIN`). Subscription tier is tracked separately via the `Subscription` table, not as a column on the user.
*   `Subscription Table:` Links a user to their active plan (e.g. `bronze`, `silver`, `gold`, `coach_basic`, `coach_platinum`) with start/expiry timestamps. Plans are fixed-duration, not recurring.
*   `Plan Table:` Defines each plan with key, display name, user type, price, and billing period (dynamic entitlement engine).
*   `Feature Table:` Defines features/capabilities (biomechanics_analysis, ocr_highlights, pdf_report, etc.) with type (numeric/boolean) and descriptions.
*   `PlanEntitlement Table:` Maps plan→feature with assigned values (e.g., `bronze` → `biomechanics_analysis: 3`, `silver` → `biomechanics_analysis: 15`).
*   `FeatureUsage Table:` Tracks real-time usage counters per user per month; compared against entitlements by the feature gate layer.
*   `Videos Table:` Tracks uploaded file paths, status (`processing`, `failed`, `completed`), and visibility (`public`, `private`).
*   `Highlights/Events Table:` Relational pointers connecting a parent video with specific timestamp clips, tracking whether it's a '4', '6', or 'Wicket'.
*   `Submissions Table:` Enables player-to-coach video review workflows with statuses (`PENDING`, `PROCESSING`, `DRAFT_REVIEW`, `PUBLISHED`, `REJECTED`).

---

## 4. Specific AI Engine Modules
*   **OCR Match Highlights (`src/engine/ocr_engine.py`):** Utilizes `yt-dlp` for YouTube ingestion. Uses `RapidOCR-ONNX` (PyTorch-free, lightweight) for scoreboard text recognition. Applies rolling median history queue to prevent scoreboard flickering from causing false positives. Outputs event timestamps + supercut video.
*   **Biomechanics (`src/engine/batting_engine.py`, `bowling_engine.py`):** Uses MediaPipe Pose (pinned to v0.10.14) for 33-point body landmark detection. Calculates biomechanical metrics (stance angle, bat lift, release height, etc.). Automatically flags technique outliers (e.g., high elbow, inconsistent release). Recommends drills via Google Gemini API.
