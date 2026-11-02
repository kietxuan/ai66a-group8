from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any
from datetime import datetime

class AIMessageSend(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

class AIMessageResponse(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: Optional[str] = None
    tool_calls: Optional[Any] = None
    tool_results: Optional[Any] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AIConversationCreate(BaseModel):
    title: Optional[str] = Field("Cuộc trò chuyện mới", max_length=200)

class AIConversationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    messages: List[AIMessageResponse] = []

    model_config = ConfigDict(from_attributes=True)

