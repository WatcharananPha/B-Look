import os
from pydantic_settings import BaseSettings
from typing import List
from sqlalchemy.engine.url import URL


class Settings(BaseSettings):
    PROJECT_NAME: str = "B-Look OMS API"
    API_V1_STR: str = "/api/v1"

    # --- Database Settings ---
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "blook_db"
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")

    @property
    def DATABASE_URL(self) -> str:
        # สร้าง URL เชื่อมต่อ Database โดยใช้ SQLAlchemy URL.create
        ssl_mode = os.getenv("POSTGRES_SSLMODE", "prefer")
        port = int(os.getenv("POSTGRES_PORT", 5432))

        db_url = URL.create(
            drivername="postgresql+psycopg2",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=port,
            database=self.POSTGRES_DB,
            query={"sslmode": ssl_mode},
        )

        return db_url.render_as_string(hide_password=False)

    # --- Security Settings ---
    SECRET_KEY: str = "YOUR_SUPER_SECRET_KEY_CHANGE_THIS"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 วัน

    class Config:
        case_sensitive = True
        # อนุญาตให้อ่านไฟล์ .env ได้ (ถ้ามี)
        env_file = ".env"

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:8000",
        "http://localhost:5173",
        "https://blook8238663284.z23.web.core.windows.net",
    ]


settings = Settings()
