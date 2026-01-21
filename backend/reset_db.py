import logging
import sys
import os
from sqlalchemy import text, inspect

# ตั้งค่า Path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine, SessionLocal
from app.db.base_class import Base

# Import Models
from app.models.user import User
from app.models.company import Company
from app.models.customer import Customer
# Import Product เพื่อเช็ค
from app.models.product import FabricType, NeckType, SleeveType
# ... imports อื่นๆ
from app.models.order import Order, OrderItem
from app.models.supplier import Supplier
from app.models.pricing_rule import PricingRule
from app.models.audit_log import AuditLog

logging.basicConfig(level=logging.INFO)

def reset_database():
    print("------------------------------------------------")
    print("🔍 กำลังตรวจสอบ Model ก่อน Reset...")
    
    # Check FabricType columns in Python
    fabric_cols = [c.name for c in FabricType.__table__.columns]
    print(f"   Python Model 'FabricType' columns: {fabric_cols}")
    
    if 'quantity' not in fabric_cols or 'cost_price' not in fabric_cols:
        print("❌ ERROR: ไม่พบคอลัมน์ 'quantity' หรือ 'cost_price' ในไฟล์ models/product.py")
        print("   กรุณาบันทึกไฟล์ models/product.py ให้เรียบร้อยก่อน!")
        return

    print("✅ Model ถูกต้อง เริ่มทำการ Reset DB...")
    
    try:
        # 1. Drop Schema
        with engine.connect() as connection:
            with connection.begin():
                connection.execute(text("DROP SCHEMA public CASCADE;"))
                connection.execute(text("CREATE SCHEMA public;"))
                connection.execute(text("GRANT ALL ON SCHEMA public TO public;"))
        print("   -> ลบข้อมูลเก่าเรียบร้อย")

        # 2. Create Tables
        Base.metadata.create_all(bind=engine)
        print("   -> สร้างตารางใหม่เรียบร้อย")
        
        # 3. Double Check Database Columns
        inspector = inspect(engine)
        db_cols = [c['name'] for c in inspector.get_columns("fabric_types")]
        print(f"   DB Table 'fabric_types' columns: {db_cols}")
        
        if 'quantity' in db_cols:
            print("✅ ยืนยัน: ตารางใน Database มีคอลัมน์ quantity แล้ว!")
        else:
            print("❌ ERROR: สร้างตารางแล้วแต่ไม่มี quantity (แปลกมาก!)")

        # 4. Seed Data
        db = SessionLocal()
        from app.core.security import get_password_hash
        
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                username="admin", 
                password_hash=get_password_hash("1234"), 
                full_name="System Admin", 
                role="owner", 
                is_active=True
            )
            db.add(admin)
        
        if not db.query(Company).first():
            db.add(Company(vat_rate=0.07, default_shipping_cost=50.0))

        db.commit()
        db.close()
        
        print("------------------------------------------------")
        print("🎉 Reset เสร็จสมบูรณ์ พร้อมใช้งาน!")
        print("------------------------------------------------")

    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {e}")

if __name__ == "__main__":
    reset_database()