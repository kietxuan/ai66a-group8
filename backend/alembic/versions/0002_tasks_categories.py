"""Week 3: categories, tasks and existing-user default category backfill."""
from alembic import op
import sqlalchemy as sa

revision = "0002_tasks_categories"
down_revision = "0001_users"
branch_labels = depends_on = None


def upgrade():
    op.create_table("categories",
        sa.Column("id", sa.Integer(), sa.Identity(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_categories_user_name"))
    op.execute("""INSERT INTO categories (user_id, name)
        SELECT u.id, n.name FROM users u CROSS JOIN
        (VALUES ('Học tập'), ('Công việc'), ('Cá nhân')) AS n(name)
        ON CONFLICT (user_id, name) DO NOTHING""")
    op.create_table("tasks",
        sa.Column("id", sa.Integer(), sa.Identity(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id", ondelete="SET NULL")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("task_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time()), sa.Column("end_time", sa.Time()),
        sa.Column("priority", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(10), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("char_length(trim(title)) BETWEEN 1 AND 200", name="ck_task_title"),
        sa.CheckConstraint("description IS NULL OR char_length(description) <= 2000", name="ck_task_description"),
        sa.CheckConstraint("priority IN ('low','medium','high')", name="ck_task_priority"),
        sa.CheckConstraint("status IN ('pending','completed')", name="ck_task_status"),
        sa.CheckConstraint("""(start_time IS NULL AND end_time IS NULL) OR
            (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time
             AND start_time < TIME '24:00' AND end_time < TIME '24:00'
             AND EXTRACT(SECOND FROM start_time) = 0 AND EXTRACT(SECOND FROM end_time) = 0)""", name="ck_task_time"))
    op.create_index("ix_tasks_user_date", "tasks", ["user_id", "task_date"])
    op.create_index("ix_tasks_category", "tasks", ["category_id"])


def downgrade():
    op.drop_table("tasks")
    op.drop_table("categories")
