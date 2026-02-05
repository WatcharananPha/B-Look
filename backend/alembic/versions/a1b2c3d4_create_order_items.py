"""create order_items table

Revision ID: a1b2c3d4
Revises: 20250205_add_fields
Create Date: 2026-02-06 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1b2c3d4"
down_revision = "20250205_add_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("order_items"):
        op.create_table(
            "order_items",
            sa.Column("id", sa.Integer, primary_key=True, nullable=False),
            sa.Column(
                "order_id", sa.Integer, sa.ForeignKey("orders.id"), nullable=False
            ),
            sa.Column("product_name", sa.String(), nullable=True),
            sa.Column("fabric_type", sa.String(), nullable=True),
            sa.Column("neck_type", sa.String(), nullable=True),
            sa.Column("sleeve_type", sa.String(), nullable=True),
            sa.Column("quantity_matrix", sa.Text(), nullable=True),
            sa.Column("total_qty", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "price_per_unit", sa.DECIMAL(10, 2), nullable=False, server_default="0"
            ),
            sa.Column(
                "total_price", sa.DECIMAL(10, 2), nullable=False, server_default="0"
            ),
            sa.Column(
                "cost_per_unit", sa.DECIMAL(10, 2), nullable=False, server_default="0"
            ),
            sa.Column(
                "total_cost", sa.DECIMAL(10, 2), nullable=False, server_default="0"
            ),
        )


def downgrade() -> None:
    op.drop_table("order_items")
