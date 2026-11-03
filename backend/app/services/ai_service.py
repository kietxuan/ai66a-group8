from typing import List, Optional
import json
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.crud.ai_crud import ai_crud
from app.models.ai_model import AIConversation, AIMessage
from app.models.user_model import User
from app.ai.agent import planify_agent

class AIService:
    async def get_conversations(self, db: AsyncSession, user_id: int) -> List[AIConversation]:
        return await ai_crud.get_conversations(db, user_id=user_id)

    async def get_conversation(self, db: AsyncSession, conversation_id: int, user_id: int) -> AIConversation:
        conv = await ai_crud.get_conversation_with_messages(db, conversation_id=conversation_id)
        if not conv or conv.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy cuộc trò chuyện này.")
        return conv

    async def create_conversation(self, db: AsyncSession, user_id: int, title: str = "Cuộc trò chuyện mới") -> AIConversation:
        return await ai_crud.create_conversation(db, user_id=user_id, title=title)

    async def delete_conversation(self, db: AsyncSession, conversation_id: int, user_id: int) -> None:
        conv = await self.get_conversation(db, conversation_id=conversation_id, user_id=user_id)
        await ai_crud.delete_conversation(db, conv_obj=conv)

    async def send_message(
        self,
        db: AsyncSession,
        user: User,
        conversation_id: Optional[int],
        content: str
    ) -> AIMessage:
        # If no conversation_id, create a new one
        if not conversation_id:
            title = content[:30] + ("..." if len(content) > 30 else "")
            conv = await self.create_conversation(db, user_id=user.id, title=title)
            conversation_id = conv.id
        else:
            conv = await self.get_conversation(db, conversation_id=conversation_id, user_id=user.id)

        # 1. Save user message to database
        await ai_crud.add_message(
            db, conversation_id=conversation_id, role="user", content=content
        )

        # 2. Build history for Agent
        history_msgs = []
        for m in conv.messages:
            history_msgs.append({"role": m.role, "content": m.content or "", "_tool_calls": m.tool_calls})
        # Add current user message
        history_msgs.append({"role": "user", "content": content})

        # 3. Call Agent reasoning & tool loop
        agent_result = await planify_agent.chat(
            user_id=user.id,
            messages=history_msgs,
            db=db,
            user_timezone=user.timezone or "Asia/Ho_Chi_Minh",
            conversation_id=conversation_id
        )

        # 4. Save assistant reply to database
        assistant_msg = await ai_crud.add_message(
            db,
            conversation_id=conversation_id,
            role="assistant",
            content=agent_result["content"],
            tool_calls=agent_result["tool_calls"],
            tool_results=agent_result["tool_results"]
        )

        return assistant_msg

ai_service = AIService()

