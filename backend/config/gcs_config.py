"""
GCS Configuration and Storage Manager
Handles all Google Cloud Storage operations for the sports AI application.
"""

import os
import time
import logging
from typing import Optional, Dict, Any
from pathlib import Path
from google.cloud import storage
from google.cloud.exceptions import NotFound

logger = logging.getLogger(__name__)

class GCSConfig:
    """GCS Configuration Manager"""
    
    def __init__(self):
        # GCP Project Configuration
        self.project_id = os.getenv("GCP_PROJECT", "sports-ai-489110")
        self.location = os.getenv("GCP_LOCATION", "asia-south1")
        self.bucket_name = os.getenv("GCS_BUCKET_NAME", "sports-ai-storage")
        
        # Storage paths within the bucket
        self.storage_paths = {
            "videos": {
                "raw": "videos/raw",
                "processed": "videos/processed", 
                "highlights": "videos/highlights",
                "uploads": "uploads/videos"
            },
            "analysis": {
                "batting": "analysis/batting",
                "bowling": "analysis/bowling",
                "reports": "analysis/reports",
                "results": "analysis/results"
            },
            "profiles": {
                "images": "profiles/images",
                "documents": "profiles/documents",
                "videos": "profiles/videos"
            },
            "submissions": {
                "uploads": "submissions/uploads",
                "processed": "submissions/processed",
                "reports": "submissions/reports"
            },
            "temp": "temp"
        }
        
        # Initialize GCS client
        self.client = None
        self.bucket = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize GCS client and bucket"""
        try:
            self.client = storage.Client(project=self.project_id)
            self.bucket = self.client.bucket(self.bucket_name)
            logger.info(f"GCS initialized: gs://{self.bucket_name}")
        except Exception as e:
            logger.error(f"Failed to initialize GCS client: {e}")
            raise
    
    def get_storage_path(self, category: str, subcategory: str = None) -> str:
        """Get storage path for a category"""
        if subcategory:
            return self.storage_paths.get(category, {}).get(subcategory, f"{category}/{subcategory}")
        return self.storage_paths.get(category, category)
    
    def get_full_path(self, category: str, subcategory: str = None, filename: str = None) -> str:
        """Get full GCS path"""
        path = self.get_storage_path(category, subcategory)
        if filename:
            path = f"{path}/{filename}"
        return path
    
    def upload_file(self, local_path: str, gcs_path: str, content_type: str = None) -> str:
        """Upload file to GCS"""
        try:
            blob = self.bucket.blob(gcs_path)
            if content_type:
                blob.content_type = content_type
            
            blob.upload_from_filename(local_path)
            gcs_uri = f"gs://{self.bucket_name}/{gcs_path}"
            logger.info(f"Uploaded: {local_path} -> {gcs_uri}")
            return gcs_uri
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            raise
    
    def download_file(self, gcs_path: str, local_path: str) -> str:
        """Download file from GCS"""
        try:
            blob = self.bucket.blob(gcs_path)
            blob.download_to_filename(local_path)
            logger.info(f"Downloaded: gs://{self.bucket_name}/{gcs_path} -> {local_path}")
            return local_path
        except Exception as e:
            logger.error(f"Download failed: {e}")
            raise
    
    def delete_file(self, gcs_path: str) -> bool:
        """Delete file from GCS"""
        try:
            blob = self.bucket.blob(gcs_path)
            blob.delete()
            logger.info(f"Deleted: gs://{self.bucket_name}/{gcs_path}")
            return True
        except NotFound:
            logger.warning(f"File not found: gs://{self.bucket_name}/{gcs_path}")
            return False
        except Exception as e:
            logger.error(f"Delete failed: {e}")
            raise
    
    def file_exists(self, gcs_path: str) -> bool:
        """Check if file exists in GCS"""
        try:
            blob = self.bucket.blob(gcs_path)
            return blob.exists()
        except Exception as e:
            logger.error(f"Error checking file existence: {e}")
            return False
    
    def get_signed_url(self, gcs_path: str, expiration_minutes: int = 60, method: str = "GET") -> str:
        """Generate signed URL for file access"""
        try:
            blob = self.bucket.blob(gcs_path)
            url = blob.generate_signed_url(
                version="v4",
                expiration=expiration_minutes * 60,
                method=method
            )
            return url
        except Exception as e:
            logger.error(f"Failed to generate signed URL: {e}")
            raise
    
    def get_upload_url(self, gcs_path: str, content_type: str = "application/octet-stream") -> Dict[str, str]:
        """Generate signed URL for direct upload"""
        try:
            blob = self.bucket.blob(gcs_path)
            blob.content_type = content_type
            
            url = blob.generate_signed_url(
                version="v4",
                expiration=3600,  # 1 hour
                method="PUT",
                content_type=content_type
            )
            
            return {
                "signed_url": url,
                "gcs_path": gcs_path,
                "bucket": self.bucket_name,
                "content_type": content_type
            }
        except Exception as e:
            logger.error(f"Failed to generate upload URL: {e}")
            raise
    
    def list_files(self, prefix: str = "", max_results: int = 1000) -> list:
        """List files in GCS bucket with optional prefix"""
        try:
            blobs = self.client.list_blobs(
                self.bucket_name, 
                prefix=prefix, 
                max_results=max_results
            )
            return [blob.name for blob in blobs]
        except Exception as e:
            logger.error(f"Failed to list files: {e}")
            raise

# Global GCS configuration instance
gcs_config = GCSConfig()

# Convenience functions for common operations
def upload_video(local_path: str, video_id: str, category: str = "raw") -> str:
    """Upload video file to GCS"""
    ext = Path(local_path).suffix
    gcs_path = gcs_config.get_full_path("videos", category, f"{video_id}{ext}")
    return gcs_config.upload_file(local_path, gcs_path, "video/mp4")

def upload_analysis_result(local_path: str, analysis_id: str, analysis_type: str = "batting") -> str:
    """Upload analysis result to GCS"""
    ext = Path(local_path).suffix
    gcs_path = gcs_config.get_full_path("analysis", analysis_type, f"{analysis_id}{ext}")
    return gcs_config.upload_file(local_path, gcs_path)

def upload_profile_image(local_path: str, user_id: str) -> str:
    """Upload profile image to GCS"""
    ext = Path(local_path).suffix
    gcs_path = gcs_config.get_full_path("profiles", "images", f"{user_id}{ext}")
    return gcs_config.upload_file(local_path, gcs_path, "image/jpeg")

def upload_submission(local_path: str, submission_id: str) -> str:
    """Upload submission file to GCS"""
    ext = Path(local_path).suffix
    gcs_path = gcs_config.get_full_path("submissions", "uploads", f"{submission_id}{ext}")
    return gcs_config.upload_file(local_path, gcs_path)

def get_video_url(video_id: str, category: str = "highlights") -> str:
    """Get signed URL for video access"""
    gcs_path = gcs_config.get_full_path("videos", category, f"{video_id}.mp4")
    return gcs_config.get_signed_url(gcs_path, expiration_minutes=120)

def get_analysis_url(analysis_id: str, analysis_type: str = "batting") -> str:
    """Get signed URL for analysis result access"""
    gcs_path = gcs_config.get_full_path("analysis", analysis_type, f"{analysis_id}.json")
    return gcs_config.get_signed_url(gcs_path, expiration_minutes=60)

def cleanup_temp_files(prefix: str = "temp/"):
    """Clean up temporary files older than 24 hours"""
    try:
        blobs = gcs_config.client.list_blobs(gcs_config.bucket_name, prefix=prefix)
        deleted_count = 0
        
        for blob in blobs:
            # Delete files older than 24 hours
            if blob.time_created and (blob.time_created.timestamp() < (time.time() - 86400)):
                blob.delete()
                deleted_count += 1
        
        logger.info(f"Cleaned up {deleted_count} temporary files")
        return deleted_count
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        return 0