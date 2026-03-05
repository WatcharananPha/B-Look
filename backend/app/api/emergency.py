from fastapi import APIRouter, Depends
from sqlalchemy import text
from app.db.session import get_db
from sqlalchemy.orm import Session
from passlib.context import CryptContext

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.get("/reset")
def reset_admin(db: Session = Depends(get_db)):
    # สร้าง Hash แบบปลอดภัยสำหรับ password123
    hashed = pwd_context.hash("password123")
    
    # ลบ admin ตัวเดิมทิ้งให้หมด เพื่อป้องกัน Hash ผิดเพี้ยน
    db.execute(text("DELETE FROM users WHERE username='admin'"))
    db.commit()
    
    # สร้างใหม่แบบคลีนๆ
    db.execute(
        text("INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES ('admin', :h, 'System Admin', 'owner', true)"), 
        {"h": hashed}
    )
    db.commit()
    return {"status": "success", "message": "Admin wiped and recreated. Password is now password123"}
