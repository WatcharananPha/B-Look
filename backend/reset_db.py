import logging
import sys
import os
from sqlalchemy import text

# ตั้งค่า Path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine, SessionLocal
from app.db.base_class import Base

# --- IMPORT MODELS ให้ครบ (สำคัญมาก เพื่อให้สร้างตารางครบทุกคอลัมน์) ---
from app.models.user import User
from app.models.company import Company
from app.models.customer import Customer
# ✅ เน้น: Import Product ให้ครบเพื่อดึง quantity/cost_price มาสร้าง
from app.models.product import FabricType, NeckType, SleeveType 
from app.models.order import Order, OrderItem
from app.models.supplier import Supplier
from app.models.pricing_rule import PricingRule
from app.models.audit_log import AuditLog

logging.basicConfig(level=logging.INFO)

def reset_database():
    print("------------------------------------------------")
    print("🔄 กำลังล้างและสร้างฐานข้อมูลใหม่ (Full Reset)...")
    
    try:
        # 1. ล้างข้อมูลเก่า (Drop Tables)
        with engine.connect() as connection:
            with connection.begin():
                connection.execute(text("DROP SCHEMA public CASCADE;"))
                connection.execute(text("CREATE SCHEMA public;"))
                connection.execute(text("GRANT ALL ON SCHEMA public TO public;"))
        print("   -> 🗑️ ลบตารางเก่าเรียบร้อย")

        # 2. สร้างตารางใหม่ (Create Tables)
        # จังหวะนี้มันจะอ่าน Code จาก models/product.py ที่คุณแก้ไว้
        Base.metadata.create_all(bind=engine)
        print("   -> ✨ สร้างตารางใหม่ (พร้อมคอลัมน์ quantity/cost_price) เรียบร้อย")

        # 3. สร้างข้อมูลเริ่มต้น (Seed Data)
        db = SessionLocal()
        from app.core.security import get_password_hash
        
        # Admin
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                username="admin", 
                password_hash=get_password_hash("1234"), 
                full_name="System Admin", 
                role="owner", 
                is_active=True
            )
            db.add(admin)
            
        # Company Config
        if not db.query(Company).first():
            db.add(Company(vat_rate=0.07, default_shipping_cost=50.0))

        db.commit()
        db.close()
        
        print("------------------------------------------------")
        print("✅ อัปเดต Database สำเร็จ! (คอลัมน์ใหม่มาแล้ว)")
        print("🔐 Login: admin / 1234")
        print("------------------------------------------------")

    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {e}")

if __name__ == "__main__":
    reset_database()