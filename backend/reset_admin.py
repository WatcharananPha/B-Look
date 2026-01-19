import sys
import os
# เพิ่ม path ให้ Python มองเห็น folder 'app'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def fix_admin_user():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "admin").first()
        
        if not user:
            print("⚠️ ไม่พบ User 'admin' ในระบบ... กำลังสร้างใหม่")
            user = User(
                username="admin",
                full_name="System Administrator",
                password_hash=get_password_hash("1234"), # รหัสผ่าน: 1234
                role="owner", # สิทธิ์สูงสุด
                is_active=True
            )
            db.add(user)
            print("✅ สร้าง User 'admin' เรียบร้อย (Password: 1234)")
        else:
            print("ℹ️ พบ User 'admin' แล้ว... กำลังรีเซ็ตรหัสผ่าน")
            user.password_hash = get_password_hash("1234")
            user.role = "owner"
            user.is_active = True
            print("✅ รีเซ็ตรหัสผ่าน 'admin' เป็น '1234' เรียบร้อย")
            
        db.commit()
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_admin_user()