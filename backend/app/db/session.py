from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ✅ HARDCODE: บังคับใช้ SQLite บนพื้นที่ถาวรของ Azure (/home)
# เพื่อป้องกัน Environment Variable ของ Azure (Postgres) มาแทรกแซง
SQLALCHEMY_DATABASE_URL = "sqlite:////home/blook_prod.db"

# สร้าง Engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    # check_same_thread ต้องใช้กับ SQLite เท่านั้น (ใส่ตรงนี้ปลอดภัย เพราะ URL บรรทัดบนคือ SQLite ชัวร์)
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
