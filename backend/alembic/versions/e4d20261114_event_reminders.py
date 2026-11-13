"""Enable inherited Event reminders and durable per-occurrence acknowledgements."""
from alembic import op
import sqlalchemy as sa

revision = "e4d20261114"
down_revision = "d3c20261104"
branch_labels = depends_on = None


def upgrade():
    op.alter_column("event_reminders", "minutes_before", existing_type=sa.Integer(), nullable=True)
    op.create_table(
        "event_reminder_deliveries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reminder_id", sa.Integer(), sa.ForeignKey("event_reminders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("occurrence_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("minutes_before", sa.Integer(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_event_reminder_deliveries_event_id", "event_reminder_deliveries", ["event_id"])
    op.create_index("uq_event_reminder_delivery", "event_reminder_deliveries", ["event_id", "occurrence_start", "scheduled_for"], unique=True)
    # Existing events previously had no functioning reminder sender. Enrol them
    # in shared settings without changing any explicit reminder configuration.
    op.execute(sa.text("""
        INSERT INTO event_reminders (event_id, minutes_before, is_sent, created_at)
        SELECT e.id, NULL, false, now() FROM events e
        WHERE NOT EXISTS (SELECT 1 FROM event_reminders r WHERE r.event_id = e.id)
    """))
    # Preserve a legacy acknowledgement if one was set manually for a one-off.
    op.execute(sa.text("""
        INSERT INTO event_reminder_deliveries
            (event_id, reminder_id, occurrence_start, scheduled_for, minutes_before)
        SELECT DISTINCT ON (e.id, e.start_at, r.minutes_before)
            e.id, r.id, e.start_at,
            (CASE WHEN e.is_all_day THEN
                ((e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + time '08:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'
             ELSE e.start_at END) - make_interval(mins => r.minutes_before),
            r.minutes_before
        FROM event_reminders r JOIN events e ON e.id = r.event_id
        WHERE r.is_sent = true AND e.recurrence_rule IS NULL AND r.minutes_before IS NOT NULL
    """))


def downgrade():
    op.drop_table("event_reminder_deliveries")
    op.execute(sa.text("DELETE FROM event_reminders WHERE minutes_before IS NULL"))
    op.alter_column("event_reminders", "minutes_before", existing_type=sa.Integer(), nullable=False)
