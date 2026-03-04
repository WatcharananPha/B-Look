from __future__ import annotations

import logging
import os
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

_DEV_SECRET = "dev-secret-key-CHANGE-before-deploying-to-production"


class Settings(BaseSettings):
    PROJECT_NAME: str = "B-Look OMS API"
    API_V1_STR: str = "/api/v1"

    # ─── Database ─────────────────────────────────────────────────────────────
    # Set DATABASE_URL env var in production, e.g.:
    #   DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/blook
    DATABASE_URL: str = "sqlite:///./blook_dev.db"

    # ─── Security ─────────────────────────────────────────────────────────────
    # ⚠️  MUST override SECRET_KEY env var in production.
    SECRET_KEY: str = _DEV_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # ─── CORS ─────────────────────────────────────────────────────────────────
    # In production set CORS_ORIGINS to your actual frontend origin(s), e.g.:
    #   CORS_ORIGINS=["https://blook.example.com"]
    CORS_ORIGINS: List[str] = ["*"]

    # ─── Static file storage ──────────────────────────────────────────────────
    # Resolved at import time; override STATIC_DIR env var if needed.
    STATIC_DIR: str = os.path.join(os.getcwd(), "static")

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# ── Startup guard ──────────────────────────────────────────────────────────────
if settings.SECRET_KEY == _DEV_SECRET:
    logger.warning(
        "⚠️  SECRET_KEY is using the insecure development default. "
        "Set the SECRET_KEY environment variable before deploying to production."
    )
