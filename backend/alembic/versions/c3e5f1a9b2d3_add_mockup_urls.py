"""add_mockup_urls

Revision ID: c3e5f1a9b2d3
Revises: b1f3c9a6d8a1
Create Date: 2026-02-23 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3e5f1a9b2d3"
down_revision: Union[str, Sequence[str], None] = "b1f3c9a6d8a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add mockup front/back URL columns to orders."""
    op.add_column("orders", sa.Column("mockup_front_url", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("mockup_back_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "mockup_back_url")
    op.drop_column("orders", "mockup_front_url")
