from fastapi import APIRouter, Depends
from app.db.session import get_db
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.models.user import User
import logging

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = logging.getLogger(__name__)


@router.get("/reset")
def reset_admin(db: Session = Depends(get_db)):
    try:
        # Create secure password hash for password123
        hashed = pwd_context.hash("password123")

        # Delete old admin user to prevent hash corruption
        db.query(User).filter(User.username == "admin").delete()
        db.commit()

        # Create fresh admin user
        admin_user = User(
            username="admin",
            password_hash=hashed,
            full_name="System Admin",
            role="owner",
            is_active=True,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        return {
            "status": "success",
            "message": "Admin wiped and recreated. Password is now password123",
            "admin_id": admin_user.id,
        }
    except Exception as e:
        logger.error(f"Emergency reset failed: {str(e)}")
        db.rollback()
        return {"status": "error", "message": f"Failed to reset admin: {str(e)}"}
