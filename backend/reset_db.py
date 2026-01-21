import logging
import sys
import os

# เพิ่ม Path ให้ Python มองเห็น Module ใน app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import engine, SessionLocal
from app.db.base import Base

# --- Import Models ---
# Import เฉพาะตัวที่มีอยู่จริง เพื่อให้ SQLAlchemy รู้จัก Table
from app.models.user import User
from app.models.company import Company
# Import models อื่นๆ ผ่าน __init__ เพื่อให้แน่ใจว่าถูก Register เข้า Base
import app.models 

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def reset_database():
    print("------------------------------------------------")
    print("💣 กำลังล้าง Database (Reset DB)...")

    # 1. ล้างข้อมูลเก่า (Drop Schema Public)
    # วิธีนี้จะลบทุกตารางและ Type ที่เกี่ยวข้อง แก้ปัญหา Foreign Key ค้างได้ชะงัด
    with engine.connect() as connection:
        with connection.begin():
            connection.execute(text("DROP SCHEMA public CASCADE;"))
            connection.execute(text("CREATE SCHEMA public;"))
            connection.execute(text("GRANT ALL ON SCHEMA public TO public;"))
    
    print("✅ ลบข้อมูลเก่าเรียบร้อย")

    # 2. สร้างตารางใหม่
    print("🏗️ กำลังสร้างตารางใหม่...")
    Base.metadata.create_all(bind=engine)
    print("✅ สร้างตารางเสร็จสมบูรณ์")

    # 3. สร้างข้อมูลเริ่มต้น (Seed Data)
    db = SessionLocal()
    try:
        from app.core.security import get_password_hash
        
        # 3.1 สร้าง Admin
        admin = User(
            username="admin",
            password_hash=get_password_hash("1234"),
            full_name="System Admin",
            role="owner",
            is_active=True
        )
        db.add(admin)
        
        # 3.2 สร้าง Company Config (สำคัญ! ถ้าไม่มี หน้า Dashboard อาจ error)
        # เช็คก่อนว่า Company import มาได้จริงไหม ถ้าไม่ได้ให้ข้ามหรือใช้ค่า default
        try:
            company = Company(
                vat_rate=0.07,
                default_shipping_cost=0.0
            )
            db.add(company)
        except NameError:
            print("⚠️ Warning: Company model not found, skipping company config.")

        db.commit()
        print("✅ สร้าง User 'admin' (Pass: 1234) เรียบร้อย")
        print("✅ สร้าง Company Config เรียบร้อย")
        
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาดในการสร้างข้อมูลเริ่มต้น: {e}")
        db.rollback()
    finally:
        db.close()
    
    print("------------------------------------------------")
    print("🎉 พร้อมใช้งาน! ให้ Start Server ใหม่ได้เลย")

if __name__ == "__main__":
    reset_database()