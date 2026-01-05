import sys
import os

# เพิ่ม path ให้ Python มองเห็น folder 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import engine
from app.db.base import Base
# Import Models ให้ครบเพื่อให้ Base รู้จัก
from app.models import order, customer, product, user, supplier, company, pricing_rule

def recreate_database():
    print("🗑️  กำลังลบตารางทั้งหมด (Dropping all tables)...")
    # ลบทุกตารางที่รู้จักใน Base
    Base.metadata.drop_all(bind=engine)
    print("✅ ลบเสร็จสิ้น")

    print("🔨 กำลังสร้างตารางใหม่ทั้งหมด (Creating all tables)...")
    # สร้างใหม่ตาม Model ปัจจุบัน (ซึ่งจะมี column deadline, usage_date ครบแน่นอน)
    Base.metadata.create_all(bind=engine)
    print("🎉 สร้างฐานข้อมูลใหม่เสร็จสมบูรณ์!")

if __name__ == "__main__":
    recreate_database()