from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from app.core.database import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    calendar_id = Column(Integer, ForeignKey("calendars.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(300), nullable=True)

    start_at = Column(DateTime(timezone=True), nullable=False, index=True)
    end_at = Column(DateTime(timezone=True), nullable=False)
    is_all_day = Column(Boolean, default=False, nullable=False)
    color = Column(String(7), nullable=True)

    # Recurrence rules (RFC 5545)
    recurrence_rule = Column(String(500), nullable=True)
    recurrence_end = Column(DateTime(timezone=True), nullable=True)

    # Exception handling for recurring instances
    parent_event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=True)
    is_exception = Column(Boolean, default=False, nullable=False)
    is_cancelled = Column(Boolean, default=False, nullable=False)
    original_start = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="events")
    calendar = relationship("Calendar", back_populates="events")
    reminders = relationship("EventReminder", back_populates="event", cascade="all, delete-orphan")
    parent_event = relationship("Event", remote_side=[id], back_populates="exceptions")
    exceptions = relationship("Event", back_populates="parent_event", cascade="all, delete-orphan", passive_deletes=True)


class EventReminder(Base):
    __tablename__ = "event_reminders"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    minutes_before = Column(Integer, default=15, nullable=False)
    is_sent = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    event = relationship("Event", back_populates="reminders")

