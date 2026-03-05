"""restore_neck_types

Revision ID: f1d407d87638
Revises: c3e5f1a9b2d3
Create Date: 2026-03-06 03:58:39.164200

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1d407d87638"
down_revision: Union[str, Sequence[str], None] = "c3e5f1a9b2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Restore neck types data."""
    # Clear existing data
    op.execute("DELETE FROM neck_types")

    # Insert neck types data
    op.execute(
        """
    INSERT INTO neck_types 
    (name, price_adjustment, quantity, cost_price, additional_cost, force_slope, is_active)
    VALUES 
    ('คอกลม', 0, 0, 0, 0, 0, 1),
    ('คอวีชน', 0, 0, 0, 0, 0, 1),
    ('คอวีไขว้', 0, 0, 0, 0, 0, 1),
    ('คอวีตัด', 0, 0, 0, 0, 0, 1),
    ('คอวีปก', 0, 0, 0, 0, 0, 1),
    ('คอห้าเหลี่ยม', 0, 0, 0, 0, 0, 1),
    ('คอปกคางหมู (มีลิ้น) (บังคับไหล่สโลป+40 บาท/ตัว)', 0, 0, 0, 40, 1, 1),
    ('คอหยดนํ้า (บังคับไหล่สโลป+40 บาท/ตัว)', 0, 0, 0, 40, 1, 1),
    ('คอห้าเหลี่ยมคางหมู (มีลิ้น) (บังคับไหล่สโลป+40 บาท/ตัว)', 0, 0, 0, 40, 1, 1),
    ('คอห้าเหลี่ยมคางหมู (ไม่มีลื่น) (บังคับไหล่สโลป+40 บาท/ตัว)', 0, 0, 0, 40, 1, 1),
    ('คอจีน', 0, 0, 0, 0, 0, 1),
    ('คอวีปก (มีลิ้น)', 0, 0, 0, 0, 0, 1),
    ('คอโปโล', 0, 0, 0, 0, 0, 1),
    ('คอวาย', 0, 0, 0, 0, 0, 1),
    ('คอเชิ้ตฐานตั้ง', 0, 0, 0, 0, 0, 1)
    """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DELETE FROM neck_types")
