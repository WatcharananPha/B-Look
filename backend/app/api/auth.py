from typing import Any, Optional
from datetime import timedelta

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

# 1. Login แบบปกติ
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
        
    # [FIXED] ส่ง Dictionary แทน Integer
    return {
        "access_token": security.create_access_token({"sub": str(user.id)}),
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
    try:
        # Verify Google Token
        id_info = id_token.verify_oauth2_token(
            payload.token, 
            google_requests.Request()
        )
        email = id_info.get("email")
        name = id_info.get("name", "")
        
        if not email:
            raise HTTPException(status_code=400, detail="Invalid Google Token")

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google Error: {str(e)}")

    # Check/Create User
    user = db.query(User).filter(User.username == email).first()
    
    if not user:
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

    # [FIXED] ส่ง Dictionary แทน Integer (จุดที่ทำให้เกิด Error 500 เดิม)
    return {
        "access_token": security.create_access_token({"sub": str(user.id)}),
        "token_type": "bearer",
        "role": user.role,
        "username": user.full_name or user.username
    }