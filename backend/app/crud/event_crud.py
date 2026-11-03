from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.crud.base import CRUDBase
from app.models.event_model import Event, EventReminder
from app.schemas.event_schema import EventCreate, EventUpdate

class CRUDEvent(CRUDBase[Event]):
    async def get_with_reminders(self, db: AsyncSession, event_id: int) -> Optional[Event]:
        stmt = (
            select(Event)
            .options(selectinload(Event.reminders))
            .where(Event.id == event_id)
            .execution_options(populate_existing=True)
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_by_range(
        self,
        db: AsyncSession,
        user_id: int,
        start_at: datetime,
        end_at: datetime,
        calendar_id: Optional[int] = None
    ) -> List[Event]:
        stmt = (
            select(Event)
            .options(selectinload(Event.reminders))
            .where(
                Event.user_id == user_id,
                (
                    (Event.is_cancelled == False) |
                    ((Event.is_cancelled == True) & (Event.is_exception == True) & (Event.parent_event_id.isnot(None)))
                ),
                # Normal events overlapping the window OR recurring events that start before window end
                (
                    ((Event.start_at <= end_at) & (Event.end_at >= start_at)) |
                    ((Event.original_start.isnot(None)) & (Event.original_start <= end_at) & (Event.original_start >= start_at)) |
                    (Event.recurrence_rule.isnot(None) & (Event.start_at <= end_at))
                )
            )
        )
        if calendar_id:
            stmt = stmt.where(Event.calendar_id == calendar_id)

        stmt = stmt.order_by(Event.start_at.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, user_id: int, obj_in: EventCreate) -> Event:
        db_obj = Event(
            user_id=user_id,
            client_request_id=obj_in.client_request_id,
            calendar_id=obj_in.calendar_id,
            title=obj_in.title,
            description=obj_in.description,
            location=obj_in.location,
            start_at=obj_in.start_at,
            end_at=obj_in.end_at,
            is_all_day=obj_in.is_all_day,
            color=obj_in.color,
            category=obj_in.category,
            recurrence_rule=obj_in.recurrence_rule,
            recurrence_end=obj_in.recurrence_end
        )
        db.add(db_obj)
        await db.flush()

        if obj_in.reminders:
            for rem in obj_in.reminders:
                reminder_obj = EventReminder(
                    event_id=db_obj.id,
                    minutes_before=rem.minutes_before
                )
                db.add(reminder_obj)

        await db.commit()
        return await self.get_with_reminders(db, db_obj.id)

    async def update(self, db: AsyncSession, db_obj: Event, obj_in: EventUpdate) -> Event:
        update_data = obj_in.model_dump(exclude_unset=True, exclude={"scope", "reminders", "original_start", "allow_overlap"})
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        if obj_in.reminders is not None:
            # Delete old reminders and insert new
            stmt = select(EventReminder).where(EventReminder.event_id == db_obj.id)
            old_rems = (await db.execute(stmt)).scalars().all()
            for r in old_rems:
                await db.delete(r)

            for rem in obj_in.reminders:
                new_rem = EventReminder(event_id=db_obj.id, minutes_before=rem.minutes_before)
                db.add(new_rem)

        db_obj.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return await self.get_with_reminders(db, db_obj.id)

    async def delete(self, db: AsyncSession, db_obj: Event) -> None:
        await db.delete(db_obj)
        await db.commit()

event_crud = CRUDEvent(Event)

