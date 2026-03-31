# Pending Improvements & Next Phase Recommendations

Based on the completion of the core OCR engine, Player uploaded biomechanics tracking, and the initial GCP infrastructure, the following features and improvements are strongly recommended for the next development phase in order to increase stability, scale, and feature completeness.

## 1. Pre-Signed URLs for Direct GCS Uploads
*   **Current State:** Videos are routed through the FastAPI backend buffer or heavily rely on YouTube URLs for larger files to bypass container timeout constraints.
*   **Recommendation:** Implement purely client-side uploads using GCS Signed URLs (`generate_signed_url` SDK). The client asks the backend for a token, then securely streams the 5GB+ file directly into `sports-ai-storage` without tying up backend server bandwidth or risking timeout exceptions.

## 2. Complete Event-Driven Architecture (Pub/Sub)
*   **Current State:** Cloud Tasks are used to spawn operations. If a massive 12hr video triggers processing, the worker stays alive linearly.
*   **Recommendation:** Migrate heavy processing states entirely into **Google Cloud Pub/Sub**. The moment an upload completes, it drops a message onto a topic. A dedicated headless pool of background workers pulls off the queue, processes it rapidly, and commits back. This decouples the REST API totally from the video processing constraints.

## 3. Real-Time Processing Signals (WebSockets)
*   **Current State:** Users are given a "Processing" status and must refresh the UI to see if their highlight reel generates.
*   **Recommendation:** Integrate an asynchronous WebSocket connection (e.g., via FastAPI WebSockets or a third-party like Pusher) to relay real-time status. As the AI worker analyzes Video Chunk 1/20, the frontend dynamically fills a progress bar.

## 4. Advanced Biomechanics Features
*   **Current State:** MediaPipe provides structural layout rendering (Batting stance logic and bowling).
*   **Recommendation:** 
    *   Implement **Speed Tracking:** Use frame deltas to estimate bowler release speed.
    *   Implement **Release Point & Pitch Coordinates:** Projecting physics models based on standard cricket pitch dimensions using the tracked arm/elbow angles at the point of release.

## 5. Caching Layer (Redis)
*   **Recommendation:** Implement Memorystore (Redis). Instead of hitting the Postgres DB repeatedly for heavily accessed public match leaderboards or User Profiles, short-lived states and vote tracking can sit in cache to reduce database I/O costs.

## 6. Cloud Deployment of Highlight Generation Architecture
*   **Current State:** The intensive highlight generation computational pipeline (running `easyocr`, `opencv`, and `ffmpeg`) is not fully deployed or scaled on the cloud.
*   **Recommendation:** Package the highlight engine into dedicated compute instances using **Google Cloud Run Jobs** or **GCP Batch**. This ensures that heavy, prolonged video rendering and OCR tasks have dedicated CPU/Memory allocations (and potentially GPU acceleration) without bottlenecking the main FastAPI web server.

## 7. Automated Testing & Continuous Integration (CI/CD)
*   **Current State:** Testing and deployment pipelines rely on manual execution and basic build scripts.
*   **Recommendation:** Implement complete end-to-end automated testing via **GitHub Actions** or **Cloud Build**. Introduce strict unit tests for the OCR Delta matching, `ffmpeg` video stitching integrity logic, and frontend E2E tools (like Cypress or Playwright) to validate the user upload flow seamlessly on every PR.

## 8. Dynamic Scoreboard Detection (Auto ROI)
*   **Current State:** The system relies on static coordinates or manual calibration for the Region of Interest (ROI) when reading the scoreboard, which risks failure if the broadcast layout changes.
*   **Recommendation:** Train a lightweight object detection model (e.g., YOLOv8 nano) to automatically locate the scoreboard bounding box in any video frame dynamically. Pass those bounding box coordinates to the OCR engine, making it 100% immune to broadcast graphics changes.