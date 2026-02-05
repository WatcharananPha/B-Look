"""add customer_code, graphic_code, design_fee

Revision ID: 20250205_add_fields
Revises: d2c9f7e3a1b4
Create Date: 2026-02-05
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20250205_add_fields"
down_revision = "d2c9f7e3a1b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("customer_code", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("graphic_code", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("product_type", sa.String(), nullable=True))
    op.add_column(
        "orders",
        sa.Column("design_fee", sa.DECIMAL(10, 2), nullable=False, server_default="0"),
    )
    op.add_column("customers", sa.Column("customer_code", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("customers", "customer_code")
    op.drop_column("orders", "design_fee")
    op.drop_column("orders", "product_type")
    op.drop_column("orders", "graphic_code")
    op.drop_column("orders", "customer_code")
