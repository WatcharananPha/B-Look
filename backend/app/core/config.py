import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "B-Look OMS API"
    API_V1_STR: str = "/api/v1"
    
    # --- Database Settings ---
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "blook_db"
    
    # IMPORTANT: 
    # ใช้ os.getenv เพื่อให้ยืดหยุ่น:
    # 1. ถ้ามี Environment Variable (เช่นใน Docker) จะใช้ค่าจาก ENV
    # 2. ถ้าไม่มี (เช่นรันบน Windows/PowerShell) จะใช้ "localhost" อัตโนมัติ
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    
    @property
    def DATABASE_URL(self) -> str:
        # สร้าง URL สำหรับเชื่อมต่อ Database
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"

    # --- Security Settings ---
    # ใน Production ควรเปลี่ยน SECRET_KEY เป็นค่าที่สุ่มขึ้นมายาวๆ และเก็บใน .env
    SECRET_KEY: str = "YOUR_SUPER_SECRET_KEY_CHANGE_THIS" 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 วัน

    class Config:
        case_sensitive = True
        # อนุญาตให้อ่านไฟล์ .env ได้ (ถ้ามี)
        env_file = ".env"

settings = Settings()   