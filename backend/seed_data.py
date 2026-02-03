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
                password_hash=get_password_hash(
                    "1234"
                ),  # Default Password (แจ้งลูกค้าให้เปลี่ยน)
                role="owner",  # สิทธิ์สูงสุด
                is_active=True,
            )
            db.add(user)
            db.commit()
            logger.info("✅ Superuser created successfully.")
            logger.info("   Username: admin")
            logger.info("   Password: 1234")
        else:
            logger.info("ℹ️  Superuser 'admin' already exists. Skipping creation.")

        # --- 2. Master Data & Business Data ---
        # ส่วนนี้ปล่อยว่าง (Commented Out) เพื่อให้เป็น Template เปล่า
        # ลูกค้าจะทำการเพิ่ม Product, Supplier, Customer ผ่านหน้าบ้านเอง

        logger.info("🧹 Database is ready as a Blank Template.")

    except Exception as e:
        logger.error(f"❌ Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("🚀 Starting database initialization...")
    init_db()
    logger.info("🏁 Initialization complete.")
