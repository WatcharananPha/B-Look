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
    # SQLite at /home/blook_prod.db is the production default.
    # /home is persistent on Azure App Service (WEBSITES_ENABLE_APP_SERVICE_STORAGE=true).
    # For local dev override is not needed — code detects sqlite and runs create_all().
    DATABASE_URL: str = "sqlite:////home/blook_prod.db"
    SECRET_KEY: str = _DEV_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    CORS_ORIGINS: List[str] = ["*"]
    # On Azure App Service, set STATIC_DIR=/home/static via App Settings.
    # For local dev this defaults to <cwd>/static (works out of the box).
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
