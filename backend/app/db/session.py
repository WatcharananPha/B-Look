from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ✅ FIX: ใช้ Path ถาวรบน Azure (/home) เพื่อป้องกันข้อมูลหายและ Conflict
SQLALCHEMY_DATABASE_URL = "sqlite:////home/blook_prod.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
