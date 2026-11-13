from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime, date, time
from app.schemas.validation import InputValidation

# --- Task Step Schemas ---
class TaskStepBase(BaseModel):
    title: str = Field(..., max_length=500)

class TaskStepCreate(TaskStepBase, InputValidation):
    position: Optional[int] = 0

class TaskStepUpdate(InputValidation):
    title: Optional[str] = Field(None, max_length=500)
    is_completed: Optional[bool] = None
    position: Optional[int] = None

class TaskStepResponse(TaskStepBase):
    id: int
    task_id: int
    is_completed: bool
    position: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Task List Schemas ---
class TaskListBase(BaseModel):
    name: str = Field(..., max_length=100)
    color: str = Field(default="#4285F4", max_length=7)
    icon: Optional[str] = Field(None, max_length=10)

class TaskListCreate(TaskListBase, InputValidation):
    position: Optional[int] = 0

class TaskListUpdate(InputValidation):
    name: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=7)
    icon: Optional[str] = Field(None, max_length=10)
    position: Optional[int] = None

class TaskListResponse(TaskListBase):
    id: int
    user_id: int
    position: int
    is_default: bool
    task_count: Optional[int] = 0
    completed_count: Optional[int] = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Task Schemas ---
class TaskBase(BaseModel):
    title: str = Field(..., max_length=500)
    note: Optional[str] = None
    location: Optional[str] = None
    list_id: Optional[int] = None
    is_important: bool = False
    is_in_my_day: bool = False
    auto_complete: Optional[bool] = False
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    duration_minutes: Optional[int] = 60
    is_all_day: Optional[bool] = True
    color: Optional[str] = None
    category: Optional[str] = Field(None, max_length=50)
    reminder_at: Optional[datetime] = None
    reminder_minutes: Optional[int] = 15
    recurrence_rule: Optional[str] = Field(None, max_length=500)

    @field_validator('auto_complete')
    @classmethod
    def manual_completion_only(cls, value):
        # Accept older clients while disabling the retired Task behavior.
        return False

class TaskCreate(TaskBase, InputValidation):
    note: Optional[str] = Field(None, max_length=5000)
    steps: Optional[List[TaskStepCreate]] = None
    allow_overlap: bool = False
    client_request_id: Optional[str] = Field(None, max_length=36)

class TaskUpdate(InputValidation):
    allow_overlap: bool = False
    title: Optional[str] = Field(None, max_length=500)
    note: Optional[str] = Field(None, max_length=5000)
    location: Optional[str] = Field(None, max_length=300)
    list_id: Optional[int] = None
    is_completed: Optional[bool] = None
    is_important: Optional[bool] = None
    is_in_my_day: Optional[bool] = None
    auto_complete: Optional[bool] = None

    due_date: Optional[date] = None
    due_time: Optional[time] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    duration_minutes: Optional[int] = None
    is_all_day: Optional[bool] = None
    color: Optional[str] = None
    category: Optional[str] = Field(None, max_length=50)
    reminder_at: Optional[datetime] = None
    reminder_minutes: Optional[int] = None
    reminder_sent: Optional[bool] = None
    recurrence_rule: Optional[str] = Field(None, max_length=500)
    position: Optional[int] = None

    @field_validator('auto_complete')
    @classmethod
    def manual_completion_only(cls, value):
        return False

class TaskResponse(TaskBase):
    id: int
    user_id: int
    list_id: int
    is_completed: bool
    reminder_sent: Optional[bool] = False
    my_day_date: Optional[date] = None
    position: int
    steps: List[TaskStepResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ItemReorder(BaseModel):
    id: int
    position: int

class ReorderRequest(BaseModel):
    items: List[ItemReorder]
