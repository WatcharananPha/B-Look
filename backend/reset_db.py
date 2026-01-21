import logging
from sqlalchemy import text
from app.db.session import engine, SessionLocal
from app.db.base import Base
# Import Models ให้ครบทุกตัว
from app.models import User, Order, Customer, Product, Supplier, PricingRule, AuditLog, Company

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_database_final():
    print("------------------------------------------------")
    logger.info("🔧 เริ่มกระบวนการซ่อมแซม Database...")
    
    # 1. ล้างข้อมูลเก่าทิ้งทั้งหมด (Force Reset)
    with engine.connect() as connection:
        with connection.begin():
            logger.info("   -> ลบ Schema เดิม (Drop All)...")
            connection.execute(text("DROP SCHEMA public CASCADE;"))
            connection.execute(text("CREATE SCHEMA public;"))
            connection.execute(text("GRANT ALL ON SCHEMA public TO public;"))
    
    # 2. สร้างตารางใหม่
    logger.info("   -> สร้างตารางใหม่ (Create Tables)...")
    Base.metadata.create_all(bind=engine)
    
    # 3. สร้าง User Admin
    db = SessionLocal()
    try:
        from app.core.security import get_password_hash
        # เช็คว่ามี admin หรือยัง (จริงๆ ไม่มีเพราะเพิ่ง drop)
        admin = User(
            username="admin",
            password_hash=get_password_hash("1234"),
            full_name="System Admin",
            role="owner",
            is_active=True
        )
        db.add(admin)
        
        # เพิ่มข้อมูลตั้งค่าบริษัทเริ่มต้น (กัน Error)
        company = Company(
            vat_rate=0.07,
            default_shipping_cost=50.0
        )
        db.add(company)
        
        db.commit()
        logger.info("✅ Database พร้อมใช้งานแล้ว!")
        logger.info("🔐 Login: admin / 1234")
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()
    print("------------------------------------------------")

if __name__ == "__main__":
    fix_database_final()