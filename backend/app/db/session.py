from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Prefer DATABASE_URL from environment (production). Fall back to a local
# sqlite file in the workspace for developer convenience.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///./blook_dev.db"

_is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    # SQLite: single-file dev database — requires check_same_thread=False
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    # PostgreSQL (or other RDBMS): production connection pool settings
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,  # test connections before checkout to handle stale TCP
        pool_size=10,  # number of connections kept open in pool
        max_overflow=20,  # extra connections allowed beyond pool_size under load
        pool_recycle=1800,  # recycle connections after 30 min to avoid server-side timeouts
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
