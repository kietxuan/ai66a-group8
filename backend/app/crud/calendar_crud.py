from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.crud.base import CRUDBase
from app.models.calendar_model import Calendar
from app.schemas.calendar_schema import CalendarCreate, CalendarUpdate

class CRUDCalendar(CRUDBase[Calendar]):
    async def get_by_user(self, db: AsyncSession, user_id: int) -> List[Calendar]:
        stmt = select(Calendar).where(Calendar.user_id == user_id).order_by(Calendar.id.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_default(self, db: AsyncSession, user_id: int) -> Optional[Calendar]:
        stmt = select(Calendar).where(Calendar.user_id == user_id, Calendar.is_default == True)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def create(self, db: AsyncSession, user_id: int, obj_in: CalendarCreate, is_default: bool = False) -> Calendar:
        db_obj = Calendar(
            user_id=user_id,
            name=obj_in.name,
            color=obj_in.color,
            is_visible=obj_in.is_visible,
            is_default=is_default
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(self, db: AsyncSession, db_obj: Calendar, obj_in: CalendarUpdate) -> Calendar:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, db_obj: Calendar) -> None:
        await db.delete(db_obj)
        await db.commit()

calendar_crud = CRUDCalendar(Calendar)

