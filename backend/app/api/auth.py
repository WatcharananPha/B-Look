from datetime import timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

# --- Google Libraries ---
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import secrets
# ------------------------

from app.db.session import get_db
from app.core import security
from app.core.config import settings
from app.models.user import User

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
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    # แก้ไข: ค้นหาจาก field 'username' ตาม Model
    user = db.query(User).filter(User.username == form_data.username).first()
    
    # แก้ไข: เช็ค password จาก field 'password_hash'
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
        "role": user.role,
        "username": user.full_name or user.username
    }

# 2. Login ผ่าน Google
@router.post("/login/google", response_model=TokenResponse)
def google_login(
    payload: GoogleLoginSchema,
    db: Session = Depends(get_db)
) -> Any:
    """
    Login using Google ID Token. 
    Uses Google Email as 'username' in our system.
    """
    try:
        # A. Verify Google Token
        id_info = id_token.verify_oauth2_token(
            payload.token, 
            google_requests.Request()
        )

        email = id_info.get("email")
        name = id_info.get("name", "")
        
        if not email:
            raise HTTPException(status_code=400, detail="Invalid Google Token: Email not found")

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Google Token")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google Token Verification Failed: {str(e)}")

    # B. Check if user exists (ค้นหาโดยใช้ email ไปเทียบกับ username)
    user = db.query(User).filter(User.username == email).first()
    
    # C. If user not exists, Create new user (Auto Register)
    if not user:
        # สร้างรหัสผ่านสุ่ม
        random_password = secrets.token_urlsafe(16)
        hashed_pw = security.get_password_hash(random_password)
        
        # แก้ไข: Map ข้อมูลให้ตรงกับ Model
        # เราใช้ email ของ Google มาเป็น username
        user = User(
            username=email,           # <--- ใช้ Email เป็น Username
            full_name=name,
            password_hash=hashed_pw,  # <--- Field ชื่อ password_hash
            is_active=True,
            role="owner"              # <--- Default Role (แก้เป็น admin หรือ owner ตามต้องการ)
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # D. Generate JWT Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
        "role": user.role,
        "username": user.full_name or user.username
    }