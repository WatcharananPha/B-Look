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
    DATABASE_URL: str = "sqlite:///./blook_dev.db"
    SECRET_KEY: str = _DEV_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    CORS_ORIGINS: List[str] = ["*"]
    STATIC_DIR: str = os.path.join(os.getcwd(), "static")

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()

if settings.SECRET_KEY == _DEV_SECRET:
    logger.warning(
        "⚠️  SECRET_KEY is using the insecure development default. "
        "Set the SECRET_KEY environment variable before deploying to production."
    )
