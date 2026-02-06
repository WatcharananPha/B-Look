"""add force_slope to neck_types

Revision ID: aa11bb22
Revises: f9e8d7c6
Create Date: 2026-02-06 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "aa11bb22"
down_revision = "f9e8d7c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add column with server default false to avoid locking issues
    op.add_column(
        "neck_types",
        sa.Column(
            "force_slope", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
    )

    # Backfill known neck names that should force slope (substring match)
    op.execute(
        """
        UPDATE neck_types
        SET force_slope = true
        WHERE name ILIKE '%คอปกคางหมู%'
           OR name ILIKE '%คอหยด%'
           OR name ILIKE '%คอห้าเหลี่ยมคางหมู%'
        """
    )


def downgrade() -> None:
    op.drop_column("neck_types", "force_slope")
