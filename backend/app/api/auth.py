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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

class GoogleLoginSchema(BaseModel):
    token: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: Optional[str] = None

# 1. Login ปกติ
@router.post("/login/access-token", response_model=TokenResponse)
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # --- เพิ่ม: เช็คสถานะ Pending ---
    if user.role == "pending":
        raise HTTPException(status_code=403, detail="Account is pending approval. Please contact admin.")
    # -----------------------------
        
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
        id_info = id_token.verify_oauth2_token(
            payload.token, 
            google_requests.Request(),
            clock_skew_in_seconds=10 
        )
        email = id_info.get("email")
        name = id_info.get("name", "")
        
        if not email:
            raise HTTPException(status_code=400, detail="Invalid Google Token: Email missing")

    except Exception as e:
        logger.error(f"Google Auth Error: {e}")
        raise HTTPException(status_code=400, detail="Google authentication failed")

    try:
        user = db.query(User).filter(User.username == email).first()
        
        if not user:
            # --- สร้าง User ใหม่ให้เป็น 'pending' ---
            logger.info(f"Creating new pending user: {email}")
            random_password = secrets.token_urlsafe(16)
            hashed_pw = security.get_password_hash(random_password)
            
            user = User(
                username=email,
                full_name=name,
                password_hash=hashed_pw,
                is_active=True,   # ให้ Active ไว้ แต่ติดที่ Role Pending
                role="pending"    # <--- บังคับเป็น Pending
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")

        # --- เพิ่ม: ถ้าเป็น Pending ห้าม Login ---
        if user.role == "pending":
             raise HTTPException(status_code=403, detail="Account is pending approval. Please contact admin.")

        return {
            "access_token": security.create_access_token({"sub": str(user.id)}),
            "token_type": "bearer",
            "role": user.role,
            "username": user.full_name or user.username
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Database Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"System Error: {str(e)}")