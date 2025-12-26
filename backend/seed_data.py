from app.db.session import SessionLocal
from app.models.user import User
from app.models.product import FabricType
from app.core.security import get_password_hash

def init_db():
    db = SessionLocal()
    
    # 1. Create Admin User
    admin_user = db.query(User).filter(User.username == "admin").first()
    if not admin_user:
        admin = User(
            username="admin",
            password_hash=get_password_hash("1234"), # Password ง่ายๆ สำหรับเทสต์
            full_name="System Admin",
            role="owner"
        )
        db.add(admin)
        print("✅ Created user: admin / 1234")

    # 2. Create Master Data (Fabrics)
    fabrics = ["Micro Smooth", "Micro Eyelet", "Atom", "Msed"]
    for f_name in fabrics:
        exists = db.query(FabricType).filter(FabricType.name == f_name).first()
        if not exists:
            db.add(FabricType(name=f_name, price_adjustment=0))
            print(f"✅ Added fabric: {f_name}")

    db.commit()
    db.close()

if __name__ == "__main__":
    print("🌱 Seeding data...")
    init_db()
    print("✨ Done!")