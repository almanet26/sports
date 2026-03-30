"""
Enqueues an HTTP request that targets the internal worker endpoint (/internal/worker/process-video) on the same Cloud Run service.

Environment Variables:
  GCP_PROJECT          — Google Cloud project ID
  GCP_LOCATION         — Cloud Tasks queue region  (e.g. "us-central1")
  GCP_TASK_QUEUE       — Queue name               (e.g. "video-processing")
  WORKER_SERVICE_URL   — Full base URL of this service (e.g. "https://cricket-api-xyz-uc.a.run.app")
  WORKER_SERVICE_ACCOUNT_EMAIL — SA email for OIDC token (e.g. "cloud-run-invoker@project.iam.gserviceaccount.com")
"""

import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Config
GCP_PROJECT: str = os.getenv("GCP_PROJECT", "")
GCP_LOCATION: str = os.getenv("GCP_LOCATION", "us-central1")
GCP_TASK_QUEUE: str = os.getenv("GCP_TASK_QUEUE", "video-processing")
WORKER_SERVICE_URL: str = os.getenv("WORKER_SERVICE_URL", "")
WORKER_SA_EMAIL: str = os.getenv("WORKER_SERVICE_ACCOUNT_EMAIL", "")

# Cloud Tasks client (lazy init)
_tasks_client = None
CLOUD_TASKS_AVAILABLE: bool = False

try:
    from google.cloud import tasks_v2

    _tasks_client = tasks_v2.CloudTasksClient()
    CLOUD_TASKS_AVAILABLE = bool(GCP_PROJECT and GCP_TASK_QUEUE and WORKER_SERVICE_URL)
    if CLOUD_TASKS_AVAILABLE:
        logger.info(
            "Cloud Tasks client ready — project=%s queue=%s",
            GCP_PROJECT,
            GCP_TASK_QUEUE,
        )
    else:
        logger.warning(
            "Cloud Tasks client imported but env vars incomplete "
            "(need GCP_PROJECT, GCP_TASK_QUEUE, WORKER_SERVICE_URL)"
        )
except ImportError:
    logger.warning("google-cloud-tasks not installed — task queuing disabled")
except Exception as exc:
    logger.error("Cloud Tasks client init error: %s", exc)


# Public API
def queue_processing_task(
    submission_id: str,
    blob_name: str,
    *,
    pipeline: str = "submission_analysis",
    deadline_seconds: int = 600,
) -> Optional[str]:
    """
    Create a Cloud Task that POSTs to the worker endpoint.

    Args:
        submission_id: DB primary key of the VideoSubmission row.
        blob_name:     GCS object path (e.g. "raw_videos/abc123_clip.mp4").
        deadline_seconds: Max time Cloud Tasks waits for a response (default 10 min).

    Returns:
        The full task name string on success, or None if queuing is disabled.
    """
    if not CLOUD_TASKS_AVAILABLE or _tasks_client is None:
        logger.warning(
            "Cloud Tasks unavailable — submission %s will NOT be auto-processed",
            submission_id,
        )
        return None

    parent = _tasks_client.queue_path(GCP_PROJECT, GCP_LOCATION, GCP_TASK_QUEUE)
    worker_url = f"{WORKER_SERVICE_URL.rstrip('/')}/internal/worker/process-video"

    payload = json.dumps(
        {
            "submission_id": submission_id,
            "blob_name": blob_name,
            "pipeline": pipeline,
        }
    ).encode("utf-8")

    # Build the HTTP request inside the task
    http_request: dict = {
        "http_method": tasks_v2.HttpMethod.POST,
        "url": worker_url,
        "headers": {"Content-Type": "application/json"},
        "body": payload,
    }

    # Add OIDC token so Cloud Run accepts the request
    if WORKER_SA_EMAIL:
        http_request["oidc_token"] = {
            "service_account_email": WORKER_SA_EMAIL,
            "audience": WORKER_SERVICE_URL,
        }

    task: dict = {
        "http_request": http_request,
        "dispatch_deadline": {"seconds": deadline_seconds},
    }

    try:
        response = _tasks_client.create_task(
            request={"parent": parent, "task": task}
        )
        logger.info(
            "Enqueued Cloud Task — name=%s submission=%s",
            response.name,
            submission_id,
        )
        return response.name
    except Exception as exc:
        logger.exception("Failed to enqueue Cloud Task for submission %s: %s", submission_id, exc)
        return None
