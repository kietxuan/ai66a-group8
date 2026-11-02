from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Time, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from app.core.database import Base

class TaskList(Base):
    __tablename__ = "task_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(100), nullable=False)
    color = Column(String(7), default="#4285F4", nullable=False)
    icon = Column(String(10), nullable=True)
    position = Column(Integer, default=0, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="task_lists")
    tasks = relationship("Task", back_populates="task_list", cascade="all, delete-orphan", order_by="Task.position")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    list_id = Column(Integer, ForeignKey("task_lists.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(500), nullable=False)
    note = Column(Text, nullable=True)
    location = Column(String(300), nullable=True)

    is_completed = Column(Boolean, default=False, nullable=False, index=True)
    is_important = Column(Boolean, default=False, nullable=False, index=True)
    is_in_my_day = Column(Boolean, default=False, nullable=False, index=True)
    my_day_date = Column(Date, nullable=True)

    # auto_complete=True means "Sự kiện (Tự động chuyển sang Hoàn thành khi hết thời gian)"
    # auto_complete=False (default) means "Phải tích mới hoàn thành"
    auto_complete = Column(Boolean, default=False, nullable=False)

    due_date = Column(Date, nullable=True, index=True)
    due_time = Column(Time, nullable=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    duration_minutes = Column(Integer, default=60, nullable=False)
    is_all_day = Column(Boolean, default=True, nullable=False)
    color = Column(String(7), nullable=True)
    reminder_at = Column(DateTime(timezone=True), nullable=True)
    reminder_minutes = Column(Integer, default=15, nullable=True)
    reminder_sent = Column(Boolean, default=False, nullable=False)

    recurrence_rule = Column(String(500), nullable=True)
    recurrence_source_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), unique=True, nullable=True)
    position = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="tasks")
    task_list = relationship("TaskList", back_populates="tasks")
    steps = relationship("TaskStep", back_populates="task", cascade="all, delete-orphan", order_by="TaskStep.position")


class TaskStep(Base):
    __tablename__ = "task_steps"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(500), nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    position = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    task = relationship("Task", back_populates="steps")
