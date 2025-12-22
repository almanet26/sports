"""
Application configuration management.
"""

import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str = ""

    # JWT
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # API Keys
    CRICKETDATA_API_KEY: str = ""
    PLAYCRICKET_API_KEY: str = ""

    # Application
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Storage
    STORAGE_RAW_PATH: str = "storage/raw"
    STORAGE_TRIMMED_PATH: str = "storage/trimmed"
    LOGS_PATH: str = "logs"

    # Video Processing
    MAX_VIDEO_SIZE_MB: int = 50000000
    SUPPORTED_VIDEO_FORMATS: str = "mp4,mkv,webm"
    DEFAULT_MERGE_THRESHOLD: float = 10.0

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse ALLOWED_ORIGINS as a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def supported_formats_list(self) -> List[str]:
        """Parse SUPPORTED_VIDEO_FORMATS as a list."""
        return [fmt.strip() for fmt in self.SUPPORTED_VIDEO_FORMATS.split(",")]

    def ensure_directories(self):
        """Create necessary directories if they don't exist."""
        Path(self.STORAGE_RAW_PATH).mkdir(parents=True, exist_ok=True)
        Path(self.STORAGE_TRIMMED_PATH).mkdir(parents=True, exist_ok=True)
        Path(self.LOGS_PATH).mkdir(parents=True, exist_ok=True)


# Global settings instance
settings = Settings()
