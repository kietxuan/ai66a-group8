"""Make the migration chain cover every runtime column, including existing installations."""
from alembic import op
import sqlalchemy as sa

revision = "b1a20261103"
down_revision = "fe8fe70309cc"
branch_labels = depends_on = None

def upgrade():
    # The previous release added these with startup DDL. IF NOT EXISTS supports both histories.
    for table, definition in [
        ("users", "notify_enabled BOOLEAN NOT NULL DEFAULT TRUE"),
        ("users", "notify_minutes_before INTEGER NOT NULL DEFAULT 15"),
        ("users", "token_version INTEGER NOT NULL DEFAULT 0"),
        ("tasks", "location VARCHAR(300)"),
        ("tasks", "auto_complete BOOLEAN NOT NULL DEFAULT FALSE"),
        ("tasks", "reminder_minutes INTEGER DEFAULT 15"),
        ("tasks", "reminder_sent BOOLEAN NOT NULL DEFAULT FALSE"),
        ("tasks", "recurrence_source_id INTEGER UNIQUE REFERENCES tasks(id) ON DELETE SET NULL"),
    ]:
        op.execute(sa.text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {definition}"))

def downgrade():
    op.drop_column("tasks", "recurrence_source_id")
    op.drop_column("users", "token_version")
    # Retain pre-existing compatibility columns; never remove user data on downgrade.
