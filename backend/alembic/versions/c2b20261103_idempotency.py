"""Deduplicate repeated create requests per account."""
from alembic import op
import sqlalchemy as sa

revision = "c2b20261103"
down_revision = "b1a20261103"
branch_labels = depends_on = None


def upgrade():
    for table in ("tasks", "events"):
        op.add_column(table, sa.Column("client_request_id", sa.String(36), nullable=True))
        op.create_index(f"uq_{table}_user_request", table, ["user_id", "client_request_id"], unique=True)


def downgrade():
    for table in ("events", "tasks"):
        op.drop_index(f"uq_{table}_user_request", table_name=table)
        op.drop_column(table, "client_request_id")
