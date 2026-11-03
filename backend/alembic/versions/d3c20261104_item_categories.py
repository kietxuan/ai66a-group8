"""Store category names on tasks and events."""
from alembic import op
import sqlalchemy as sa


revision = "d3c20261104"
down_revision = "c2b20261103"
branch_labels = depends_on = None


def upgrade():
    op.add_column("tasks", sa.Column("category", sa.String(length=50), nullable=True))
    op.add_column("events", sa.Column("category", sa.String(length=50), nullable=True))


def downgrade():
    op.drop_column("events", "category")
    op.drop_column("tasks", "category")
