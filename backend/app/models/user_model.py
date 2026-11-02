from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    nickname = Column(String, nullable=False)
    password_hashed = Column(String, nullable=False)
    is_activate = Column(Boolean, default=True)
    is_developer = Column(Boolean, default=False, nullable=False)

    theme_preference = Column(String(20), default="light", nullable=False)
    timezone = Column(String(50), default="Asia/Ho_Chi_Minh", nullable=False)

    notify_enabled = Column(Boolean, default=True, nullable=False)
    notify_minutes_before = Column(Integer, default=15, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    calendars = relationship("Calendar", back_populates="user", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="user", cascade="all, delete-orphan")
    task_lists = relationship("TaskList", back_populates="user", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    ai_conversations = relationship("AIConversation", back_populates="user", cascade="all, delete-orphan")
