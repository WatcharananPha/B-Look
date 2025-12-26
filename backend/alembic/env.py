from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# --- Import App Config & Models ---
from app.core.config import settings  # <--- เพิ่มบรรทัดนี้
from app.db.base import Base
from app.models.user import User
from app.models.order import Order
from app.models.customer import Customer
from app.models.product import *

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# --- Override sqlalchemy.url with App Settings ---
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL) # <--- เพิ่มบรรทัดนี้สำคัญมาก!

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# ... (ส่วนที่เหลือเหมือนเดิม) ...

def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # แก้ไข connectable ให้ใช้ config ที่เรา Override ไปแล้ว
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