from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class CalendarBase(BaseModel):
    name: str = Field(..., max_length=100)
    color: str = Field(default="#4285F4", max_length=7)
    is_visible: bool = True

class CalendarCreate(CalendarBase):
    pass

class CalendarUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=7)
    is_visible: Optional[bool] = None

class CalendarResponse(CalendarBase):
    id: int
    user_id: int
    is_default: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

