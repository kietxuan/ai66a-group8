from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from app.schemas.validation import InputValidation

class CategoryBase(BaseModel):
    name: str = Field(..., max_length=50)
    color: str = Field(..., max_length=7)

class CategoryCreate(CategoryBase, InputValidation):
    pass

class CategoryUpdate(InputValidation):
    name: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=7)

class CategoryResponse(CategoryBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

