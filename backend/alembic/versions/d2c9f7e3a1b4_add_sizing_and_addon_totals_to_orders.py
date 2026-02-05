"""Add sizing surcharge and add-on options totals to orders

Revision ID: d2c9f7e3a1b4
Revises: 03747378eee2
Create Date: 2026-02-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d2c9f7e3a1b4"
down_revision: Union[str, Sequence[str], None] = "03747378eee2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "orders",
        sa.Column(
            "sizing_surcharge",
            sa.DECIMAL(precision=10, scale=2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "orders",
        sa.Column(
            "add_on_options_total",
            sa.DECIMAL(precision=10, scale=2),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("orders", "add_on_options_total")
    op.drop_column("orders", "sizing_surcharge")
