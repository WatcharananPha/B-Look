from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Temporarily override DB URL to use SQLite to "trick" Alembic in environments
# where PostgreSQL is not desired. Comment out the Postgres engine creation.
# Original line:
# engine = create_engine(settings.DATABASE_URL)
# Temporary SQLite URL (for local/testing only)
SQLALCHEMY_DATABASE_URL = "sqlite:///./definitely_empty.db"
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
