"""Add selected_add_ons and is_oversize to order_items

Revision ID: f9e8d7c6
Revises: a1b2c3d4
Create Date: 2026-02-06 00:30:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f9e8d7c6"
down_revision = "a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add per-item add-on list and oversize flag
    op.add_column(
        "order_items",
        sa.Column("selected_add_ons", sa.Text(), nullable=True),
    )
    op.add_column(
        "order_items",
        sa.Column(
            "is_oversize", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
    )

    # Optional: store per-item computed totals for audit
    op.add_column(
        "order_items",
        sa.Column(
            "item_addon_total", sa.DECIMAL(10, 2), nullable=False, server_default="0"
        ),
    )
    op.add_column(
        "order_items",
        sa.Column(
            "item_sizing_surcharge",
            sa.DECIMAL(10, 2),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("order_items", "item_sizing_surcharge")
    op.drop_column("order_items", "item_addon_total")
    op.drop_column("order_items", "is_oversize")
    op.drop_column("order_items", "selected_add_ons")
