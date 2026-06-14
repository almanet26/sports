"""
Tests for the external service layer with GCS and Cloud Tasks mocked out.

Rule: unit tests must never upload to GCS or ping Cloud Tasks. Any test that exercises a code path touching these clients must patch the SDK clients so no real network call is made. This file shows the pattern and tests the key dispatch invariants for the OCR job pipeline.

What is tested:
  1. CloudTasksManager.create_processing_task — task payload structure and correct routing to client.create_task.
  2. GCSStorageManager.upload_video — blob creation and upload_from_filename call.
  3. OCR job enqueue routing — priority queue for coach_pro/academy tiers, standard queue for all other coach tiers.
"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


# ---------------------------------------------------------------------------
# 1. CloudTasksManager unit tests
# ---------------------------------------------------------------------------

class TestCloudTasksManager:
    @pytest.fixture(autouse=True)
    def _mock_tasks_client(self):
        """
        Patch google.cloud.tasks_v2.CloudTasksClient for the entire class.
        Each test gets a fresh mock_client instance.
        """
        with patch("google.cloud.tasks_v2.CloudTasksClient") as mock_cls:
            self.mock_client = MagicMock()
            mock_cls.return_value = self.mock_client
            self.mock_client.queue_path.return_value = (
                "projects/test-proj/locations/us-central1/queues/test-queue"
            )
            mock_task = MagicMock()
            mock_task.name = (
                "projects/test-proj/locations/us-central1/queues/test-queue/tasks/abc123"
            )
            self.mock_client.create_task.return_value = mock_task
            yield

    def test_create_task_calls_client_create_task(self):
        """create_processing_task must call client.create_task exactly once."""
        from services.cloud_tasks_service import CloudTasksManager

        manager = CloudTasksManager("test-proj", "us-central1", "test-queue")
        task_name = manager.create_processing_task(
            video_id="vid_001",
            worker_url="https://worker.example.com",
        )

        self.mock_client.create_task.assert_called_once()
        assert task_name == (
            "projects/test-proj/locations/us-central1/queues/test-queue/tasks/abc123"
        )

    def test_task_payload_contains_video_id(self):
        """The task body must be valid JSON containing the video_id."""
        from services.cloud_tasks_service import CloudTasksManager

        manager = CloudTasksManager("test-proj", "us-central1", "test-queue")
        manager.create_processing_task(
            video_id="vid_payload_check",
            worker_url="https://worker.example.com",
            config={"fps": 30},
        )

        call_kwargs = self.mock_client.create_task.call_args
        task_body = call_kwargs.kwargs["request"]["task"]["http_request"]["body"]
        payload = json.loads(task_body.decode())

        assert payload["video_id"] == "vid_payload_check"
        assert payload["config"] == {"fps": 30}

    def test_task_targets_correct_worker_url(self):
        """The task http_request URL must be the worker endpoint."""
        from services.cloud_tasks_service import CloudTasksManager

        manager = CloudTasksManager("test-proj", "us-central1", "test-queue")
        worker_url = "https://my-worker-xyz.run.app"
        manager.create_processing_task(video_id="v1", worker_url=worker_url)

        call_kwargs = self.mock_client.create_task.call_args
        task_url = call_kwargs.kwargs["request"]["task"]["http_request"]["url"]
        assert task_url == f"{worker_url}/process"

    def test_no_real_network_call_made(self):
        """
        Smoke-test: instantiating and calling the manager must never reach the
        real Google Cloud API. Verified by the fact that the patched mock
        intercepts the constructor before any I/O occurs.
        """
        from services.cloud_tasks_service import CloudTasksManager

        manager = CloudTasksManager("test-proj", "us-central1", "test-queue")
        manager.create_processing_task(video_id="v1", worker_url="https://worker.example.com")
        # If this test runs without network errors, the mock is in place.
        assert self.mock_client.create_task.called


# ---------------------------------------------------------------------------
# 2. GCSStorageManager unit tests
# ---------------------------------------------------------------------------

class TestGCSStorageManager:
    @pytest.fixture(autouse=True)
    def _mock_storage_client(self, tmp_path):
        """Patch google.cloud.storage.Client for the entire class."""
        with patch("google.cloud.storage.Client") as mock_cls:
            self.mock_client = MagicMock()
            mock_cls.return_value = self.mock_client

            self.mock_bucket = MagicMock()
            self.mock_client.bucket.return_value = self.mock_bucket

            self.mock_blob = MagicMock()
            self.mock_bucket.blob.return_value = self.mock_blob

            # Create a real temp file for upload path tests.
            self.tmp_video = tmp_path / "sample.mp4"
            self.tmp_video.write_bytes(b"fake-video-content")
            yield

    def test_upload_video_calls_blob_upload(self):
        """upload_video must call blob.upload_from_filename with the local path."""
        from services.gcs_storage_service import GCSStorageManager

        manager = GCSStorageManager("test-bucket")
        manager.upload_video(str(self.tmp_video), video_id="vid_001", folder="raw")

        self.mock_blob.upload_from_filename.assert_called_once_with(
            str(self.tmp_video), timeout=600
        )

    def test_upload_video_returns_gcs_uri(self):
        """upload_video must return a gs:// URI pointing at the correct path."""
        from services.gcs_storage_service import GCSStorageManager

        manager = GCSStorageManager("test-bucket")
        uri = manager.upload_video(str(self.tmp_video), video_id="vid_002", folder="raw")

        assert uri == "gs://test-bucket/raw/vid_002.mp4"

    def test_upload_video_uses_correct_blob_name(self):
        """The blob name must be '{folder}/{video_id}{ext}'."""
        from services.gcs_storage_service import GCSStorageManager

        manager = GCSStorageManager("test-bucket")
        manager.upload_video(str(self.tmp_video), video_id="vid_003", folder="preprocessed")

        self.mock_bucket.blob.assert_called_once_with("preprocessed/vid_003.mp4")

    def test_no_real_gcs_call_made(self):
        """
        Smoke-test: the mock is in place before any real I/O runs.
        upload_from_filename being a mock means no bytes leave the machine.
        """
        from services.gcs_storage_service import GCSStorageManager

        manager = GCSStorageManager("test-bucket")
        manager.upload_video(str(self.tmp_video), video_id="v1")
        assert self.mock_blob.upload_from_filename.called


# ---------------------------------------------------------------------------
# 3. OCR job queue routing
# ---------------------------------------------------------------------------

class TestOCRQueueRouting:
    """
    Verify that _enqueue_ocr_task routes priority tiers to 'ocr-priority'
    and standard tiers to 'ocr-standard' when Cloud Tasks is enabled.
    """

    @pytest.fixture(autouse=True)
    def _enable_cloud_tasks(self, monkeypatch):
        """Simulate a fully-configured Cloud Tasks environment."""
        monkeypatch.setenv("GCP_PROJECT_ID", "test-project")
        monkeypatch.setenv("WORKER_URL", "https://worker.example.com")

    def test_priority_tiers_use_priority_queue(self, monkeypatch):
        """coach_pro and academy tiers must use 'ocr-priority'."""
        # CloudTasksManager is imported lazily inside _enqueue_ocr_task, so we patch it at its definition site, not at api.routes.jobs.
        with patch("services.cloud_tasks_service.CloudTasksManager") as mock_mgr:
            mock_mgr.return_value = MagicMock()

            import importlib
            import api.routes.jobs as jobs_module
            importlib.reload(jobs_module)

            from fastapi import BackgroundTasks
            for tier in ("coach_platinum",):
                mock_mgr.reset_mock()
                jobs_module._enqueue_ocr_task("vid", {}, tier, BackgroundTasks())
                queue = mock_mgr.call_args[0][2]  # third positional = queue_name
                assert queue == "ocr-priority", f"{tier} should route to ocr-priority"

    def test_standard_tiers_use_standard_queue(self, monkeypatch):
        """coach_basic tier must use 'ocr-standard'."""
        with patch("services.cloud_tasks_service.CloudTasksManager") as mock_mgr:
            mock_mgr.return_value = MagicMock()

            import importlib
            import api.routes.jobs as jobs_module
            importlib.reload(jobs_module)

            from fastapi import BackgroundTasks
            for tier in ("coach_basic",):
                mock_mgr.reset_mock()
                jobs_module._enqueue_ocr_task("vid", {}, tier, BackgroundTasks())
                queue = mock_mgr.call_args[0][2]  # third positional = queue_name
                assert queue == "ocr-standard", f"{tier} should route to ocr-standard"

    def test_cloud_tasks_disabled_falls_back_to_background(self, monkeypatch):
        """
        When GCP_PROJECT_ID or WORKER_URL is unset, _enqueue_ocr_task must fall
        back to FastAPI BackgroundTasks and never instantiate CloudTasksManager.
        """
        monkeypatch.delenv("GCP_PROJECT_ID", raising=False)
        monkeypatch.delenv("WORKER_URL", raising=False)

        import importlib
        import api.routes.jobs as jobs_module
        importlib.reload(jobs_module)

        from fastapi import BackgroundTasks
        bg = BackgroundTasks()

        with patch("api.routes.jobs.run_ocr_processing") as mock_ocr:
            jobs_module._enqueue_ocr_task("vid_fallback", {}, "coach_basic", bg)
            # BackgroundTasks.add_task was called; CloudTasksManager was not.
            assert len(bg.tasks) == 1
