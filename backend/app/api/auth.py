from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel # เพิ่ม import BaseModel

# --- เพิ่ม import สำหรับ Google ---
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import secrets
# -----------------------------

from app.db.session import get_db
from app.core import security
from app.core.config import settings
from app.models.user import User
from app.schemas.token import Token

router = APIRouter()

# --- Schema สำหรับรับ Google Token ---
class GoogleLoginSchema(BaseModel):
    token: str

@router.post("/login/access-token", response_model=Token)
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

# --- เพิ่ม Endpoint: Google Login ---
@router.post("/login/google", response_model=Token)
def google_login(
    payload: GoogleLoginSchema,
    db: Session = Depends(get_db)
) -> Any:
    """
    Login using Google ID Token. 
    If user does not exist, create a new one automatically.
    """
    try:
        # 1. Verify Google Token
        # หมายเหตุ: ควรใส่ GOOGLE_CLIENT_ID ใน settings เพื่อความปลอดภัยขั้นสูง (audience=...)
        id_info = id_token.verify_oauth2_token(
            payload.token, 
            google_requests.Request()
        )

        email = id_info.get("email")
        name = id_info.get("name", "")
        
        if not email:
            raise HTTPException(status_code=400, detail="Invalid Google Token: Email not found")

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google Token Verification Failed: {str(e)}")

    # 2. Check if user exists
    user = db.query(User).filter(User.email == email).first()
    
    # 3. If user not exists, Create new user
    if not user:
        # สร้างรหัสผ่านสุ่มเพราะ user นี้ login ผ่าน google (ไม่ได้ใช้ password จริง)
        random_password = secrets.token_urlsafe(16)
        hashed_pw = security.get_password_hash(random_password)
        
        user = User(
            email=email,
            full_name=name,
            hashed_password=hashed_pw,
            is_active=True,
            role="user" # Default role
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # 4. Generate JWT Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }