from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user_model import User
from app.schemas.ai_schema import (
    AIConversationCreate, AIConversationResponse, AIMessageSend, AIMessageResponse
)
from app.services.ai_service import ai_service
from app.core.rate_limit import check_ai_rate_limit

router = APIRouter()

@router.get("/conversations", response_model=List[AIConversationResponse])
async def get_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách các cuộc trò chuyện với AI"""
    return await ai_service.get_conversations(db, user_id=current_user.id)

@router.post("/conversations", response_model=AIConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    conv_in: AIConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tạo cuộc trò chuyện mới với AI"""
    return await ai_service.create_conversation(db, user_id=current_user.id, title=conv_in.title)

@router.get("/conversations/{conversation_id}", response_model=AIConversationResponse)
async def get_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy chi tiết cuộc trò chuyện kèm tin nhắn"""
    return await ai_service.get_conversation(db, conversation_id=conversation_id, user_id=current_user.id)

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xóa cuộc trò chuyện"""
    await ai_service.delete_conversation(db, conversation_id=conversation_id, user_id=current_user.id)

@router.post("/conversations/{conversation_id}/messages", response_model=AIMessageResponse, dependencies=[Depends(check_ai_rate_limit)])
async def send_message(
    conversation_id: int,
    msg_in: AIMessageSend,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Gửi tin nhắn vào cuộc hội thoại -> AI suy luận, gọi tool và phản hồi"""
    return await ai_service.send_message(
        db, user=current_user, conversation_id=conversation_id, content=msg_in.content
    )

@router.post("/chat", response_model=AIMessageResponse, dependencies=[Depends(check_ai_rate_limit)])
async def quick_chat(
    msg_in: AIMessageSend,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Chat nhanh (tự động tạo cuộc trò chuyện mới nếu chưa có)"""
    return await ai_service.send_message(
        db, user=current_user, conversation_id=None, content=msg_in.content
    )

