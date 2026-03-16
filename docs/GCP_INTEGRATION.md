# GCP Integration Guide

Complete reference for Google Cloud Platform services integration.

---

## 📋 Table of Contents

1. Cloud Storage (GCS)
2. Supabase PostgreSQL
3. Cloud Run
4. Cloud Build
5. Secret Manager
6. Cloud Tasks
7. Cloud Logging

---

## 1. Cloud Storage (GCS)

### Overview

Stores all video files, reports, and temporary data.

**Buckets Created:**
- `sports-ai-storage-raw`: Raw uploaded videos
- `sports-ai-storage-processed`: Processed videos & highlights
- `sports-ai-storage-reports`: Generated PDF reports

### Upload Video

**Direct Upload (Frontend):**
```tsx
const uploadToGCS = async (file: File, videoId: string) => {
  try {
    // 1. Get signed URL from backend
    const urlResponse = await api.post('/storage/signed-url', {
      video_id: videoId,
      action: 'upload',
    });
    const signedUrl = urlResponse.data.signed_url;
    
    // 2. Upload directly to GCS
    await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': 'video/mp4' },
    });
    
    // 3. Notify backend upload complete
    await api.post(`/videos/${videoId}/confirm-upload`);
    
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

**Backend Upload (Python):**
```python
from google.cloud import storage

def upload_video_to_gcs(file_path: str, video_id: str) -> str:
    """Upload video to GCS and return GCS path."""
    
    client = storage.Client()
    bucket = client.bucket('sports-ai-storage-raw')
    blob = bucket.blob(f'videos/{video_id}.mp4')
    
    blob.upload_from_filename(file_path)
    
    # Return public/signed URL
    return f"gs://sports-ai-storage-raw/videos/{video_id}.mp4"
```

### Download/Stream Video

**Signed URL Download:**
```python
from google.cloud import storage
from datetime import timedelta

def get_download_url(video_path: str, expiration_hours: int = 24) -> str:
    """Generate signed download URL."""
    
    client = storage.Client()
    bucket = client.bucket('sports-ai-storage-processed')
    blob = bucket.blob(video_path)
    
    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(hours=expiration_hours),
        method="GET"
    )
    
    return url
```

**API Endpoint:**
```bash
GET /api/v1/storage/download/{video_id}
# Returns: { "download_url": "https://storage.googleapis.com/..." }
```

### List Objects in Bucket

```python
from google.cloud import storage

def list_videos(bucket_name: str) -> list:
    """List all video files."""
    
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    
    blobs = bucket.list_blobs(prefix='videos/')
    
    return [
        {
            'name': blob.name,
            'size': blob.size,
            'created': blob.time_created,
        }
        for blob in blobs
    ]
```

### Delete Object

```python
def delete_video(video_id: str) -> bool:
    """Delete video from GCS."""
    
    client = storage.Client()
    bucket = client.bucket('sports-ai-storage-raw')
    blob = bucket.blob(f'videos/{video_id}.mp4')
    
    blob.delete()
    return True
```

---

## 2. Supabase PostgreSQL

### Connection from Cloud Run

Cloud Run reads `DATABASE_URL` from Secret Manager and connects to Supabase PostgreSQL.

```python
# main.py - Already configured
import os
from sqlalchemy import create_engine

# Connection string comes from Secret Manager env var
DATABASE_URL = os.getenv("DATABASE_URL")
# Example: postgresql://postgres.PROJECT_REF:password@aws-1-ap-south-1.pooler.supabase.com:6543/postgres

engine = create_engine(DATABASE_URL)
```

### Connection from Local Development

Use local PostgreSQL for development OR point to Supabase if needed.

**Option 1: Local PostgreSQL (Recommended for dev)**
```bash
# Update .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/sports_dev
```

**Option 2: Supabase direct connection**
```bash
DATABASE_URL=postgresql://postgres.PROJECT_REF:password@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
```

### Backup & Restore

```bash
# Supabase backups are managed in Supabase dashboard.
# For manual backup from app side:
pg_dump "postgresql://postgres.PROJECT_REF:password@aws-1-ap-south-1.pooler.supabase.com:6543/postgres" > backup.sql

# Restore (manual)
psql "postgresql://postgres.PROJECT_REF:password@aws-1-ap-south-1.pooler.supabase.com:6543/postgres" < backup.sql
```

### Monitor Queries

```bash
# Connect directly to Supabase Postgres
psql "postgresql://postgres.PROJECT_REF:password@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"

# Inside psql, monitor long queries
SELECT * FROM pg_stat_activity WHERE state != 'idle';
```

---

## 3. Cloud Run

### Deploy Backend

```bash
# Prerequisites
# 1. .env configured with secrets from Secret Manager
# 2. Docker image built and pushed to Artifact Registry

# Deploy
gcloud run deploy sports-api \
  --region us-central1 \
  --image us-central1-docker.pkg.dev/PROJECT/sports/backend:latest \
  --platform managed \
  --set-env-vars DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres,\
GEMINI_API_KEY=from-secret \
  --max-instances 10 \
  --memory 1Gi \
  --cpu 1 \
  --allow-unauthenticated
```

### Set Secrets

```bash
# Reference Secret Manager in deployment
gcloud run deploy sports-api \
  ...
  --set-env-vars SECRET_KEY=projects/PROJECT_ID/secrets/SECRET_KEY/versions/latest \
  ...
```

### Monitor Service

```bash
# View logs
gcloud run logs read sports-api --region us-central1

# View metrics
gcloud monitoring metrics-descriptors list

# Check service status
gcloud run services describe sports-api --region us-central1
```

### Scale Service

```bash
# Update Cloud Run service
gcloud run services update sports-api \
  --max-instances 20 \
  --region us-central1
```

---

## 4. Cloud Build

### Setup CI/CD Pipeline

**File: `cloudbuild.yaml`**
```yaml
steps:
  # Step 1: Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/sports/backend:$SHORT_SHA'
      - '-f'
      - 'Dockerfile'
      - './backend'

  # Step 2: Push to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'us-central1-docker.pkg.dev/$PROJECT_ID/sports/backend:$SHORT_SHA'

  # Step 3: Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gke-deploy'
    args:
      - 'run'
      - '--filename=.'
      - '--image=us-central1-docker.pkg.dev/$PROJECT_ID/sports/backend:$SHORT_SHA'
      - '--location=us-central1'

images:
  - 'us-central1-docker.pkg.dev/$PROJECT_ID/sports/backend:$SHORT_SHA'
  - 'us-central1-docker.pkg.dev/$PROJECT_ID/sports/backend:latest'
```

### Trigger Build

```bash
# Manual trigger
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions SHORT_SHA=abc123

# View build status
gcloud builds log abc123 --stream

# List recent builds
gcloud builds list --limit 10
```

---

## 5. Secret Manager

### Store Secrets

```bash
# Create secret
echo -n "super-secret-key" | gcloud secrets create SECRET_KEY \
  --replication-policy="automatic" \
  --data-file=-

# List secrets
gcloud secrets list

# Update secret
echo -n "new-value" | gcloud secrets versions add SECRET_KEY --data-file=-
```

### Retrieve Secrets in Code

**Python:**
```python
from google.cloud import secretmanager

def get_secret(secret_id: str, version: str = "latest") -> str:
    """Retrieve secret from Secret Manager."""
    
    client = secretmanager.SecretManagerServiceClient()
    
    name = f"projects/PROJECT_ID/secrets/{secret_id}/versions/{version}"
    response = client.access_secret_version(request={"name": name})
    
    return response.payload.data.decode("UTF-8")

# Usage
api_key = get_secret("GEMINI_API_KEY")
```

**Grant Cloud Run Access:**
```bash
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member=serviceAccount:sports-api@PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

---

## 6. Cloud Tasks

### Create Task Queue

```bash
gcloud tasks queues create ocr-processing \
  --location us-central1
```

### Enqueue Task

**Python:**
```python
from google.cloud import tasks_v2
from datetime import datetime, timedelta
import json

def enqueue_ocr_job(video_id: str, delay_seconds: int = 0):
    """Add OCR job to task queue."""
    
    client = tasks_v2.CloudTasksClient()
    project = "PROJECT_ID"
    queue = "ocr-processing"
    location = "us-central1"
    url = "https://sports-api.run.app/api/v1/worker/process-ocr"
    
    parent = client.queue_path(project, location, queue)
    
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": url,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"video_id": video_id}).encode(),
        }
    }
    
    # Schedule for later if needed
    if delay_seconds > 0:
        task["schedule_time"] = {
            "seconds": int((datetime.now() + timedelta(seconds=delay_seconds)).timestamp())
        }
    
    response = client.create_task(request={"parent": parent, "task": task})
    
    return response.name
```

### Handle Task Webhook

**FastAPI Endpoint:**
```python
from fastapi import APIRouter, Request, HTTPException
import json

router = APIRouter(prefix="/worker")

@router.post("/process-ocr")
async def process_ocr_job(request: Request):
    """Handler for Cloud Tasks webhook."""
    
    # Verify Auth header (Cloud Tasks token)
    auth_header = request.headers.get("Authorization", "")
    
    body = await request.json()
    video_id = body.get("video_id")
    
    # Process OCR job
    job = await ocr_engine.process_video(video_id)
    
    return {"status": "completed", "job_id": job.id}
```

### Monitor Queue

```bash
# List tasks in queue
gcloud tasks list --queue=ocr-processing --location=us-central1

# View task details
gcloud tasks describe TASK_NAME --queue=ocr-processing --location=us-central1

# Watch queue
watch 'gcloud tasks list --queue=ocr-processing --location=us-central1 | tail -20'
```

---

## 7. Cloud Logging

### Configure Logger

```python
import logging
from google.cloud import logging as cloud_logging

# Setup Cloud Logging
cloud_logging_client = cloud_logging.Client()
cloud_logging_client.setup_logging()

logger = logging.getLogger(__name__)

# Now logs go to Cloud Logging console
logger.info("Processing video", extra={"video_id": video_id})
logger.error("OCR failed", exc_info=True)
```

### Query Logs

**Command Line:**
```bash
# View recent logs
gcloud logging read "resource.type=cloud_run_revision" \
  --limit 50 \
  --format json

# Filter by service
gcloud logging read \
  "resource.labels.service_name=sports-api AND severity=ERROR" \
  --limit 10 \
  --format "table(timestamp,severity,jsonPayload.message)"
```

**Using Cloud Logging UI:**
1. Go to Cloud Console → Logging → Logs Viewer
2. Filter: `resource.type="cloud_run_revision" AND resource.labels.service_name="sports-api"`
3. Search by log level, timestamp, custom fields

### Set Up Alerts

```bash
# Create alert policy for errors
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Sports API Errors" \
  --condition-display-name="High error rate" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=300s
```

---

## 🔗 Useful Links

- [GCS Documentation](https://cloud.google.com/storage/docs)
- [Supabase Postgres Docs](https://supabase.com/docs/guides/database)
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Cloud Build Docs](https://cloud.google.com/build/docs)
- [Secret Manager Docs](https://cloud.google.com/secret-manager/docs)
- [Cloud Logging Docs](https://cloud.google.com/logging/docs)

---

**Last Updated:** March 16, 2026
