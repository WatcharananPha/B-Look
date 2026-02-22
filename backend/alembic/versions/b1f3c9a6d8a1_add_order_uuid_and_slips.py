"""add_order_uuid_and_slips

Revision ID: b1f3c9a6d8a1
Revises: a2dd559b6618
Create Date: 2026-02-22 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b1f3c9a6d8a1"
down_revision: Union[str, Sequence[str], None] = "a2dd559b6618"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add public order UUID and slip URL columns
    op.add_column("orders", sa.Column("order_uuid", sa.String(), nullable=True))
    op.create_index(
        op.f("ix_orders_order_uuid"), "orders", ["order_uuid"], unique=False
    )
    op.add_column("orders", sa.Column("slip_booking_url", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("slip_deposit_url", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("slip_balance_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "slip_balance_url")
    op.drop_column("orders", "slip_deposit_url")
    op.drop_column("orders", "slip_booking_url")
    op.drop_index(op.f("ix_orders_order_uuid"), table_name="orders")
    op.drop_column("orders", "order_uuid")
