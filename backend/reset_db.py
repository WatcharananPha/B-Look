import sys
import os

# Add path to project root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import engine
from app.db.base import Base

# Import models เพื่อให้ Base.metadata รู้จักตารางทั้งหมด
# (จำเป็นต้อง Import โมดูลที่มีการประกาศ Class Base ทั้งหมด)
from app.models import user, customer, order, product, supplier, company, pricing_rule

def reset_database():
    print("WARNING: This will delete all data in the database!")
    
    print("💣 Dropping all tables...")
    try:
        # ลบตารางทั้งหมด
        Base.metadata.drop_all(bind=engine)
        print("✅ All tables dropped.")
    except Exception as e:
        print(f"❌ Error dropping tables: {e}")

    print("🏗️ Creating all tables...")
    try:
        # สร้างตารางใหม่ทั้งหมดตาม Schema ล่าสุด
        Base.metadata.create_all(bind=engine)
        print("✅ All tables created successfully.")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")

if __name__ == "__main__":
    reset_database()