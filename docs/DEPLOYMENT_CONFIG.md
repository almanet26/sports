# GCP Deployment Steps (Detailed)

This guide covers the exact steps taken to deploy the application on Google Cloud Platform. 

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
We use `cloudbuild.yaml` in the root directory to handle containerization and deployment automatically.

**Triggering a Deployment:**
```bash
gcloud builds submit .   --config=cloudbuild.yaml   --project=sports-ai-489110   --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD)
```

**What the pipeline does:**
1.  Authenticates Docker to GCP's Artifact Registry.
2.  Builds the `backend/Dockerfile`, combining the Python API and FFmpeg/MediaPipe system dependencies.
3.  Tags and pushes the container heavily utilizing cache layers to reduce build time.
4.  Deploys logic directly to the `sports-backend` Cloud Run service instance.

## 4. Frontend Deployment (Vercel)
The React/Vite instance relies on Vercel for global Edge delivery.
1. Connect Vercel to the GitHub repository.
2. Select the `frontend` root directory.
3. Add Environment Variable:
   * `VITE_API_URL` = `https://sports-backend-xxxxx-el.a.run.app` (The Cloud Run URL)
4. Trigger a production build.
