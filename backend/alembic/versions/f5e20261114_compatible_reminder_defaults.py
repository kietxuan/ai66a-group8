"""Restore legacy-compatible integers and explicitly track inherited settings.

Do not rewrite e4: it has already been applied to some local databases. env.py
upgrades all pending revisions in one PostgreSQL transaction, so installations
at d3 never expose the intermediate nullable representation to old readers.
"""
from alembic import op
import sqlalchemy as sa

revision = "f5e20261114"
down_revision = "e4d20261114"
branch_labels = depends_on = None


def upgrade():
    op.add_column("event_reminders", sa.Column("use_user_default", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute(sa.text("""
        UPDATE event_reminders r
        SET minutes_before = COALESCE(u.notify_minutes_before, 15), use_user_default = true
        FROM events e JOIN users u ON u.id = e.user_id
        WHERE r.event_id = e.id AND r.minutes_before IS NULL
    """))
    op.alter_column("event_reminders", "minutes_before", existing_type=sa.Integer(), nullable=False)


def downgrade():
    # Return to e4's representation without deleting events, reminders or ACKs.
    op.alter_column("event_reminders", "minutes_before", existing_type=sa.Integer(), nullable=True)
    op.execute(sa.text("UPDATE event_reminders SET minutes_before = NULL WHERE use_user_default = true"))
    op.drop_column("event_reminders", "use_user_default")
