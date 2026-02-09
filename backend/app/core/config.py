from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "B-Look OMS API"
    API_V1_STR: str = "/api/v1"
    
    # กำหนดค่าให้ตรงกับ session.py
    DATABASE_URL: str = "sqlite:////home/blook_prod.db"

    SECRET_KEY: str = "YOUR_SUPER_SECRET_KEY_CHANGE_THIS"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    class Config:
        case_sensitive = True
        # ปิดการอ่านไฟล์ .env เพื่อป้องกันค่าแปลกปลอม
        # env_file = ".env" 

settings = Settings()
