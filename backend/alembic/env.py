from logging.config import fileConfig
import os # <--- 1. เพิ่ม import os

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# --- Import App Config & Models ---
from app.core.config import settings
from app.db.base import Base
# Import Models ให้ครบเพื่อให้ Autogenerate ทำงาน
from app.models.user import User
from app.models.order import Order
from app.models.customer import Customer
from app.models.product import *
from app.models.pricing_rule import PricingRule, ShippingRate
from app.models.audit_log import AuditLog

# this is the Alembic Config object
config = context.config

# --- 2. Override URL Logic (แก้ไขใหม่) ---
# อ่านค่าจาก Environment Variable โดยตรง (ซึ่ง Docker Compose ส่งมาให้แล้วว่าเป็น postgresql://...@db/...)
# ถ้าไม่มีใน Env ให้ใช้จาก settings หรือ alembic.ini ตามลำดับ
db_url = os.getenv("DATABASE_URL")
if not db_url:
    db_url = settings.DATABASE_URL

config.set_main_option("sqlalchemy.url", db_url)
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
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()