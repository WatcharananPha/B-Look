import logging
import sys
import os

# เพิ่ม path ให้ Python มองเห็น folder 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
# [FIX] Import Base จาก app.db.base เพื่อโหลด Models ทั้งหมด (User, Product, Supplier, etc.) เข้า Memory
# ป้องกัน Error: expression 'Supplier' failed to locate a name
from app.db.base import Base 
from app.models.user import User
from app.models.product import FabricType, NeckType, SleeveType
from app.core.security import get_password_hash

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db():
    """
    Initialize Database with ONLY the Root Admin user.
    No mock data (Orders, Products, Customers) will be created.
    This serves as a Blank Template for production delivery.
    """
    db = SessionLocal()
    try:
        # --- 1. Create Initial Superuser (Root Admin) ---
        # ลูกค้าจะใช้ Account นี้ในการ Login ครั้งแรก แล้วไปสร้าง User อื่นๆ เอง
        user = db.query(User).filter(User.username == "admin").first()
        if not user:
            logger.info("✨ Creating initial superuser 'admin'...")
            user = User(
                username="admin",
                password_hash=get_password_hash("1234"), # Default Password (แจ้งลูกค้าให้เปลี่ยน)
                role="owner", # สิทธิ์สูงสุด
                is_active=True
            )
            db.add(user)
            db.commit()
            logger.info("✅ Superuser created successfully.")
            logger.info("   Username: admin")
            logger.info("   Password: 1234")
        else:
            logger.info("ℹ️  Superuser 'admin' already exists. Skipping creation.")

        # --- 2. Master Data: Product Items ---
        logger.info("📦 Creating product items...")
        
        # 2.1 Fabrics (ชนิดผ้า)
        fabric_data = [
            {"name": "ผ้าคอตตอน 100%", "cost_price": 120.00},
            {"name": "ผ้าโพลีเอสเตอร์", "cost_price": 80.00},
            {"name": "ผ้าจูติ", "cost_price": 150.00},
            {"name": "ผ้าฝ้าย", "cost_price": 100.00},
            {"name": "ผ้าไลคร่า", "cost_price": 180.00},
            {"name": "ผ้าโปโล", "cost_price": 130.00},
            {"name": "ผ้าเดนิม", "cost_price": 200.00},
            {"name": "ผ้าซาติน", "cost_price": 160.00},
        ]
        
        for item in fabric_data:
            existing = db.query(FabricType).filter(FabricType.name == item["name"]).first()
            if not existing:
                fabric = FabricType(name=item["name"], cost_price=item["cost_price"])
                db.add(fabric)
                logger.info(f"   ✅ Added fabric: {item['name']}")
        
        # 2.2 Necks (รูปแบบคอ)
        neck_data = [
            {"name": "คอกลม", "cost_price": 0.00},
            {"name": "คอวี", "cost_price": 10.00},
            {"name": "คอปก", "cost_price": 30.00},
            {"name": "คอเต่า", "cost_price": 25.00},
            {"name": "คอวาย", "cost_price": 15.00},
            {"name": "คอจีน", "cost_price": 35.00},
            {"name": "คอบัว", "cost_price": 20.00},
            {"name": "คอเชิ้ต", "cost_price": 40.00},
        ]
        
        for item in neck_data:
            existing = db.query(NeckType).filter(NeckType.name == item["name"]).first()
            if not existing:
                neck = NeckType(name=item["name"], cost_price=item["cost_price"])
                db.add(neck)
                logger.info(f"   ✅ Added neck: {item['name']}")
        
        # 2.3 Sleeves (รูปแบบแขน)
        sleeve_data = [
            {"name": "แขนสั้น", "cost_price": 0.00},
            {"name": "แขนยาว", "cost_price": 20.00},
            {"name": "แขน 3/4", "cost_price": 15.00},
            {"name": "แขนกุด", "cost_price": 0.00},
            {"name": "แขนพอง", "cost_price": 30.00},
            {"name": "แขนระบาย", "cost_price": 25.00},
            {"name": "แขนกิโมโน", "cost_price": 35.00},
            {"name": "แขนเสื้อคลุม", "cost_price": 40.00},
        ]
        
        for item in sleeve_data:
            existing = db.query(SleeveType).filter(SleeveType.name == item["name"]).first()
            if not existing:
                sleeve = SleeveType(name=item["name"], cost_price=item["cost_price"])
                db.add(sleeve)
                logger.info(f"   ✅ Added sleeve: {item['name']}")
        
        db.commit()
        logger.info("✅ Product items created successfully.")
        logger.info("🧹 Database is ready with sample products.")

    except Exception as e:
        logger.error(f"❌ Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("🚀 Starting database initialization...")
    init_db()
    logger.info("🏁 Initialization complete.")