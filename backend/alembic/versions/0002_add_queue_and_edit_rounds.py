"""add_queue_and_edit_rounds

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-23 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("queue_number", sa.Integer(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("queue_status", sa.String(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("edit_round", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "orders",
        sa.Column("cod_amount", sa.Numeric(10, 2), nullable=True, server_default="0"),
    )
    op.add_column(
        "orders",
        sa.Column(
            "cod_collected", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
    )
    op.add_column(
        "orders",
        sa.Column(
            "image_received", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
    )
    op.add_column(
        "orders",
        sa.Column(
            "remaining_balance", sa.Numeric(10, 2), nullable=True, server_default="0"
        ),
    )

def downgrade() -> None:
    op.drop_column("orders", "remaining_balance")
    op.drop_column("orders", "image_received")
    op.drop_column("orders", "cod_collected")
    op.drop_column("orders", "cod_amount")
    op.drop_column("orders", "edit_round")
    op.drop_column("orders", "queue_status")
    op.drop_column("orders", "queue_number")
