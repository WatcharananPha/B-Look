from logging.config import fileConfig
import os

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# --- Import App Config & Models ---
import sys
import pathlib

# Ensure the `backend` package root is on sys.path so `import app` works
# env.py lives at backend/alembic/env.py; parents[1] -> backend/
proj_root = pathlib.Path(__file__).resolve().parents[1]
if str(proj_root) not in sys.path:
    sys.path.insert(0, str(proj_root))

from app.core.config import settings
from app.db.base import Base

# Import Models ให้ครบ
from app.models.user import User
from app.models.order import Order
from app.models.customer import Customer
from app.models.product import *
from app.models.pricing_rule import PricingRule, ShippingRate
from app.models.audit_log import AuditLog

# this is the Alembic Config object
config = context.config

# --- Override URL Logic (Production Ready) ---
# 1. อ่านค่าจาก Environment Variable (ลำดับความสำคัญสูงสุด)
db_url = os.getenv("DATABASE_URL")
if not db_url:
    db_url = settings.DATABASE_URL

# 2. Escape '%' characters เพื่อป้องกัน configparser ตีความเป็น interpolation
# (สำคัญมากสำหรับ Password ที่มี %)
escaped_db_url = db_url.replace("%", "%%") if isinstance(db_url, str) else db_url

# 3. ยัดกลับใส่ Config ของ Alembic
config.set_main_option("sqlalchemy.url", escaped_db_url)
# ------------------------------------------------

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # ใช้ engine_from_config เพื่อสร้าง Connection จาก URL ที่เราแก้ไว้ข้างบน
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
