from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ✅ ใช้ Path ถาวร /home/blook_prod.db ข้อมูลจะไม่หายเมื่อ Restart
SQLALCHEMY_DATABASE_URL = "sqlite:////home/blook_prod.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
