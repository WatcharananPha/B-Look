from typing import Generator, Optional
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

reusable_oauth2 = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/token")
logger = logging.getLogger(__name__)


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> User:
    # NOTE: Removed development convenience token acceptance to avoid
    # accidentally trusting hard-coded tokens in non-dev environments.
    # If a developer needs a local shortcut, re-enable with a guarded
    # environment flag or use a proper test fixture.

    try:
        # เปลี่ยนจาก security.ALGORITHM เป็น settings.ALGORITHM
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = payload.get("sub")
        if token_data is None:
            logger.debug("Token decoded but 'sub' missing in payload")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials: Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except jwt.ExpiredSignatureError:
        logger.info("Expired token presented")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials: Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (JWTError, ValidationError) as e:
        logger.warning("JWT validation error: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ป้องกันปัญหากรณี Token เก็บเป็น ID แต่ Code ไปหา Username
    try:
        user_id = int(token_data)
        user = db.query(User).filter(User.id == user_id).first()
    except (ValueError, TypeError):
        # เผื่อกรณี token_data ไม่ใช่ตัวเลข
        user = None

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
