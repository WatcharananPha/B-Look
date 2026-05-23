from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def reset_password():
    db = SessionLocal()
    user = db.query(User).filter(User.username == "admin").first()
    
    if not user:
        print("❌ ไม่พบชื่อผู้ใช้ 'admin' ในระบบ")
        return

    user.hashed_password = get_password_hash("123456")
    user.is_active = True
    db.commit()
    print("✅ รีเซ็ตรหัสผ่านของ 'admin' เป็น 123456 สำเร็จแล้ว!")

if __name__ == "__main__":
    reset_password()