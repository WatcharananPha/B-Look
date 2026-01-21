import logging
import sys
import os
from sqlalchemy import text

# ตั้งค่า Path ให้ Python มองเห็น Module ใน app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine, SessionLocal
from app.db.base_class import Base

# --- IMPORT MODELS ให้ครบ (สำคัญมาก ไม่งั้นตารางไม่มา) ---
from app.models.user import User
from app.models.customer import Customer
from app.models.product import FabricType # หรือชื่อ Class อื่นๆ ใน product.py
from app.models.supplier import Supplier
from app.models.pricing_rule import PricingRule
from app.models.audit_log import AuditLog
from app.models.company import Company
from app.models.order import Order, OrderItem # <--- ตัวสำคัญที่เพิ่ม Column ใหม่

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def reset_database():
    print("------------------------------------------------")
    print("🔄 กำลังอัปเดตโครงสร้าง Database (Reset)...")
    
    try:
        # 1. ล้างข้อมูลเก่าทิ้งทั้งหมด (Drop Schema)
        with engine.connect() as connection:
            with connection.begin():
                connection.execute(text("DROP SCHEMA public CASCADE;"))
                connection.execute(text("CREATE SCHEMA public;"))
                connection.execute(text("GRANT ALL ON SCHEMA public TO public;"))
        print("   -> ลบตารางเก่าเรียบร้อย")

        # 2. สร้างตารางใหม่ (ตาม Code ล่าสุดที่มี deposit_1, note ฯลฯ)
        Base.metadata.create_all(bind=engine)
        print("   -> สร้างตารางใหม่พร้อมคอลัมน์ล่าสุดเรียบร้อย")

        # 3. สร้างข้อมูลเริ่มต้น (Seed Data)
        db = SessionLocal()
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
        db.close()
        
        print("------------------------------------------------")
        print("✅ อัปเดต Database สำเร็จ!")
        print("📝 ตาราง orders มีคอลัมน์: deposit_1, deposit_2, note, discount_type แล้ว")
        print("🔐 Login: admin / 1234")
        print("------------------------------------------------")

    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {e}")

if __name__ == "__main__":
    reset_database()