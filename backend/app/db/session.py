from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Prefer DATABASE_URL from environment (production). Fall back to a local
# sqlite file in the workspace for developer convenience.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
if not SQLALCHEMY_DATABASE_URL:
    # Use a relative path inside the project so it's writable in most dev setups
    SQLALCHEMY_DATABASE_URL = "sqlite:///./blook_dev.db"

# If using sqlite, pass the required connect args
connect_args = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
