"""Week 2: users."""
from alembic import op
import sqlalchemy as sa

revision = "0001_users"
down_revision = None
branch_labels = depends_on = None


def upgrade():
    op.create_table("users",
        sa.Column("id", sa.Integer(), sa.Identity(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("password", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))


def downgrade():
    op.drop_table("users")
