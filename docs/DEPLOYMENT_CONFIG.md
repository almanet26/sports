# GCP Deployment Steps (Detailed)

This guide covers the exact steps taken to deploy the application on Google Cloud Platform.

**See also:** [README.md](../README.md) Deployment section for a quicker reference.
**See also:** [cloudbuild.yaml](../backend/cloudbuild.yaml) for the actual pipeline configuration. 

## 1. Prerequisites Set Up
Before triggering any automated pipelines, the following base infrastructure must be provisioned.
1.  **GCP Project:** `sports-ai-489110`
2.  **Enabled APIs:** 
    *   Compute Engine API
    *   Cloud Build API
    *   Cloud Run Admin API
    *   Artifact Registry API
    *   Cloud Storage API
    *   Secret Manager API
    *   Cloud Tasks API

## 2. Infrastructure Provisioning

### A. Cloud Storage (Video Buckets)
Creates the storage locations for handling heavy raw uploads and final supercuts.
```bash
gcloud storage buckets create gs://sports-ai-storage --location=asia-south1
# Apply CORS for frontend uploading
gcloud storage buckets update gs://sports-ai-storage --cors-file=gcs-cors.json
```

### B. Secret Manager (Environment Variables)
Store sensitive information natively.
```bash
gcloud secrets create DATABASE_URL --replication-policy="automatic"
echo -n "postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres" | gcloud secrets versions add DATABASE_URL --data-file=-
```
*(Repeat for `JWT_SECRET_KEY`, `REFRESH_SECRET_KEY`, etc.)*

### C. Cloud Tasks (For Async Video Processing)
Creates the background queue.
```bash
gcloud tasks queues create video-processing --location=asia-south1
```

## 3. Automated CI/CD (Cloud Build)
`cloudbuild.yaml` and `.gcloudignore` live inside `backend/`. The build context is `backend/` — do **not** submit from the repo root, as the Dockerfile paths and `.gcloudignore` exclusions (venv, __pycache__, tests) are relative to that directory.

**Triggering a Deployment:**
```bash
gcloud builds submit backend/ \
  --config=backend/cloudbuild.yaml \
  --project=sports-ai-489110 \
  --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD)
```

**What the pipeline does:**
1.  Authenticates Docker to GCP's Artifact Registry (`asia-south1-docker.pkg.dev`).
2.  Builds the `Dockerfile` inside `backend/`, combining the Python API, FFmpeg, and MediaPipe dependencies. Uses `--cache-from` to reuse layers from the previous `latest` image.
3.  Pushes both `$COMMIT_SHA` and `latest` tags to Artifact Registry.
4.  Deploys to the `sports-backend` Cloud Run service in `asia-south1`, injecting non-sensitive env vars via `--set-env-vars` and pulling secrets (DATABASE_URL, JWT_SECRET_KEY, API keys) from Secret Manager via `--update-secrets`.

## 4. Frontend Deployment (Vercel)
The React/Vite instance relies on Vercel for global Edge delivery.
1. Connect Vercel to the GitHub repository.
2. Select the `frontend` root directory.
3. Add Environment Variable:
   * `VITE_API_URL` = `https://sports-backend-xxxxx-el.a.run.app` (The Cloud Run URL)
4. Trigger a production build.
