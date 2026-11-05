"""Store category names on tasks and events."""
from alembic import op
import sqlalchemy as sa


revision = "d3c20261104"
down_revision = "c2b20261103"
branch_labels = depends_on = None


def upgrade():
    op.execute(sa.text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category VARCHAR(50)"))
    op.execute(sa.text("ALTER TABLE events ADD COLUMN IF NOT EXISTS category VARCHAR(50)"))


def downgrade():
    op.execute(sa.text("ALTER TABLE events DROP COLUMN IF EXISTS category"))
    op.execute(sa.text("ALTER TABLE tasks DROP COLUMN IF EXISTS category"))
