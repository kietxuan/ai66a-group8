from typing import List, Optional
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.crud.base import CRUDBase
from app.models.ai_model import AIConversation, AIMessage

class CRUDAI(CRUDBase[AIConversation]):
    async def get_conversations(self, db: AsyncSession, user_id: int) -> List[AIConversation]:
        stmt = (
            select(AIConversation)
            .options(selectinload(AIConversation.messages))
            .where(AIConversation.user_id == user_id)
            .order_by(AIConversation.updated_at.desc().nullslast(), AIConversation.id.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_conversation_with_messages(self, db: AsyncSession, conversation_id: int) -> Optional[AIConversation]:
        stmt = (
            select(AIConversation)
            .options(selectinload(AIConversation.messages))
            .where(AIConversation.id == conversation_id)
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    async def create_conversation(self, db: AsyncSession, user_id: int, title: str = "Cuộc trò chuyện mới") -> AIConversation:
        conv = AIConversation(user_id=user_id, title=title)
        db.add(conv)
        await db.commit()
        await db.refresh(conv)
        return await self.get_conversation_with_messages(db, conv.id)

    async def delete_conversation(self, db: AsyncSession, conv_obj: AIConversation) -> None:
        await db.delete(conv_obj)
        await db.commit()

    async def add_message(
        self,
        db: AsyncSession,
        conversation_id: int,
        role: str,
        content: Optional[str] = None,
        tool_calls: Optional[any] = None,
        tool_results: Optional[any] = None
    ) -> AIMessage:
        msg = AIMessage(
            conversation_id=conversation_id,
            role=role,
            content=content,
            tool_calls=json.dumps(tool_calls, ensure_ascii=False) if tool_calls else None,
            tool_results=json.dumps(tool_results, ensure_ascii=False) if tool_results else None
        )
        db.add(msg)
        await db.commit()
        await db.refresh(msg)
        return msg

ai_crud = CRUDAI(AIConversation)

