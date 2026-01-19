from typing import Any, Optional
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google.auth.exceptions import GoogleAuthError

from app.db.session import get_db
from app.core import security
from app.models.user import User

# ตั้งค่า Logging เพื่อให้เห็น Error ใน Terminal
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# --- Schemas ---
class GoogleLoginSchema(BaseModel):
    token: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: Optional[str] = None

# 1. Login แบบปกติ (Username/Password)
@router.post("/login/access-token", response_model=TokenResponse)
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return {
        "access_token": security.create_access_token({"sub": str(user.id)}),
        "token_type": "bearer",
        "role": user.role,
        "username": user.full_name or user.username
    }

# 2. Login ผ่าน Google (Robust Version)
@router.post("/login/google", response_model=TokenResponse)
def google_login(
    payload: GoogleLoginSchema,
    db: Session = Depends(get_db)
) -> Any:
    try:
        # Verify Google Token
        # clock_skew_in_seconds=10 ช่วยแก้ปัญหา "Token used too early"
        id_info = id_token.verify_oauth2_token(
            payload.token, 
            google_requests.Request(),
            clock_skew_in_seconds=10 
        )
        
        email = id_info.get("email")
        name = id_info.get("name", "")
        
        # Log ข้อมูลที่ได้จาก Google (ดูใน Terminal เพื่อตรวจสอบความถูกต้อง)
        logger.info(f"✅ Google Login Verified for: {email}")

        if not email:
            raise HTTPException(status_code=400, detail="Invalid Google Token: Email missing")

    except ValueError as e:
        logger.error(f"❌ Google Token Validation Error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Token validation failed: {str(e)}")
    except GoogleAuthError as e:
        logger.error(f"❌ Google Auth Error: {str(e)}")
        raise HTTPException(status_code=400, detail="Google authentication failed")
    except Exception as e:
        logger.error(f"❌ Unexpected Error during token verification: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal authentication error")

    try:
        user = db.query(User).filter(User.username == email).first()
        
        if not user:
            logger.info(f"Creating new user for: {email}")
            random_password = secrets.token_urlsafe(16)
            hashed_pw = security.get_password_hash(random_password)
            
            user = User(
                username=email,
                full_name=name,
                password_hash=hashed_pw,
                is_active=True,
                role="owner"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")

        # สร้าง Access Token ของระบบ ส่งกลับไปให้ Frontend
        return {
            "access_token": security.create_access_token({"sub": str(user.id)}),
            "token_type": "bearer",
            "role": user.role,
            "username": user.full_name or user.username
        }

    except Exception as e:
        logger.error(f"❌ Database Error: {str(e)}")
        # ถ้า DB Error ต้องแจ้ง 500 แต่บอกรายละเอียดใน Log
        raise HTTPException(status_code=500, detail=f"Database operation failed: {str(e)}")