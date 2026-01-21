import logging
import sys
import os

# เพิ่ม Path ให้ Python มองเห็น Module ใน app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import engine, SessionLocal
# --- จุดที่แก้ไข: Import Base จาก base_class แทน ---
from app.db.base_class import Base 

# Import Models เพื่อให้ Base รู้จักตารางทั้งหมด
from app.models.user import User
from app.models.company import Company
# Import models อื่นๆ (ถ้ามี __init__.py รวมไว้แล้วก็ใช้ได้ หรือ import แยกเพื่อให้ชัวร์)
import app.models 

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def reset_database():
    print("------------------------------------------------")
    print("💣 กำลังล้าง Database (Reset DB)...")

    # 1. ล้างข้อมูลเก่า (Drop Schema Public)
    with engine.connect() as connection:
        with connection.begin():
            connection.execute(text("DROP SCHEMA public CASCADE;"))
            connection.execute(text("CREATE SCHEMA public;"))
            connection.execute(text("GRANT ALL ON SCHEMA public TO public;"))
    
    print("✅ ลบข้อมูลเก่าเรียบร้อย")

    # 2. สร้างตารางใหม่
    print("🏗️ กำลังสร้างตารางใหม่...")
    # ตอนนี้ Base จะรู้จักตาราง Company และ User แล้ว
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
        
        # 3.2 สร้าง Company Config
        company = Company(
            vat_rate=0.07,
            default_shipping_cost=50.0
        )
        db.add(company)

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