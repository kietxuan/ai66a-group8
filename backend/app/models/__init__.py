from datetime import date, datetime, time, timezone

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Identity, Index, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_categories_user_name"),)
    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


TIME_CHECK = """(start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time
     AND start_time < TIME '24:00' AND end_time < TIME '24:00'
     AND EXTRACT(SECOND FROM start_time) = 0 AND EXTRACT(SECOND FROM end_time) = 0)"""


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("char_length(trim(title)) BETWEEN 1 AND 200", name="ck_task_title"),
        CheckConstraint("description IS NULL OR char_length(description) <= 2000", name="ck_task_description"),
        CheckConstraint("priority IN ('low','medium','high')", name="ck_task_priority"),
        CheckConstraint("status IN ('pending','completed')", name="ck_task_status"),
        CheckConstraint(TIME_CHECK, name="ck_task_time"),
        Index("ix_tasks_user_date", "user_id", "task_date"),
        Index("ix_tasks_category", "category_id"),
    )
    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    task_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    priority: Mapped[str] = mapped_column(String(10), default="medium", server_default="medium")
    status: Mapped[str] = mapped_column(String(10), default="pending", server_default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
