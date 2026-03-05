from fastapi import APIRouter, Depends
from sqlalchemy import text
from app.db.session import get_db
from sqlalchemy.orm import Session
from passlib.context import CryptContext

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.get("/reset")
def reset_admin(db: Session = Depends(get_db)):
    hashed = pwd_context.hash("password123")
    res = db.execute(text("SELECT id FROM users WHERE username='admin'")).first()
    if not res:
        db.execute(text("INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES ('admin', :h, 'System Admin', 'owner', true)"), {"h": hashed})
    else:
        db.execute(text("UPDATE users SET password_hash = :h WHERE username = 'admin'"), {"h": hashed})
    db.commit()
    return {"status": "success", "message": "Admin password is now password123"}
