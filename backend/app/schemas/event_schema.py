from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.schemas.validation import InputValidation

class EventReminderBase(BaseModel):
    minutes_before: int = Field(default=15, ge=0)

class EventReminderCreate(EventReminderBase):
    pass

class EventReminderResponse(EventReminderBase):
    id: int
    is_sent: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EventBase(BaseModel):
    calendar_id: Optional[int] = None
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    location: Optional[str] = Field(None, max_length=300)
    start_at: datetime
    end_at: datetime
    is_all_day: bool = False
    color: Optional[str] = Field(None, max_length=7)
    category: Optional[str] = Field(None, max_length=50)
    recurrence_rule: Optional[str] = Field(None, max_length=500)
    recurrence_end: Optional[datetime] = None

class EventCreate(EventBase, InputValidation):
    description: Optional[str] = Field(None, max_length=5000)
    reminders: Optional[List[EventReminderCreate]] = None
    allow_overlap: bool = False
    client_request_id: Optional[str] = Field(None, max_length=36)

class EventUpdate(InputValidation):
    allow_overlap: bool = False
    calendar_id: Optional[int] = None
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    location: Optional[str] = Field(None, max_length=300)
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    is_all_day: Optional[bool] = None
    color: Optional[str] = Field(None, max_length=7)
    category: Optional[str] = Field(None, max_length=50)
    recurrence_rule: Optional[str] = Field(None, max_length=500)
    recurrence_end: Optional[datetime] = None
    is_cancelled: Optional[bool] = None
    original_start: Optional[datetime] = None
    scope: Optional[str] = Field("this", pattern="^(this|following|all)$")
    reminders: Optional[List[EventReminderCreate]] = None

class EventResponse(EventBase):
    id: int
    user_id: int
    calendar_id: int
    parent_event_id: Optional[int] = None
    is_exception: bool = False
    is_cancelled: bool = False
    original_start: Optional[datetime] = None
    reminders: List[EventReminderResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

