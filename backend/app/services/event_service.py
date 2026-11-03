from app.services.write_lock import serialized_write, lock_owner
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.crud.event_crud import event_crud
from app.crud.calendar_crud import calendar_crud
from app.models.event_model import Event, EventReminder
from app.schemas.event_schema import EventCreate, EventUpdate, EventReminderCreate
from app.core.time import BUSINESS_TZ
from app.services.recurrence import occurrences, aware
import re

class EventService:
    async def get_events_in_range(
        self,
        db: AsyncSession,
        user_id: int,
        start_at: datetime,
        end_at: datetime,
        calendar_id: Optional[int] = None
    ) -> List[Event]:
        start_at = self._aware(start_at)
        end_at = self._aware(end_at)
        if end_at <= start_at:
            raise HTTPException(422, "Khoảng thời gian không hợp lệ.")
        return await event_crud.get_by_range(
            db,
            user_id=user_id,
            start_at=start_at,
            end_at=end_at,
            calendar_id=calendar_id
        )

    async def get_event_by_id(self, db: AsyncSession, event_id: int, user_id: int) -> Event:
        event = await event_crud.get_with_reminders(db, event_id=event_id)
        if not event or event.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy sự kiện này.")
        return event

    @serialized_write
    async def create_event(self, db: AsyncSession, user_id: int, event_in: EventCreate) -> Event:
        if event_in.client_request_id:
            existing = (await db.execute(select(Event.id).where(Event.user_id == user_id, Event.client_request_id == event_in.client_request_id))).scalar_one_or_none()
            if existing:
                return await event_crud.get_with_reminders(db, existing)
        # If calendar_id not specified, assign default calendar
        if not event_in.calendar_id:
            default_cal = await calendar_crud.get_default(db, user_id)
            if default_cal:
                event_in.calendar_id = default_cal.id
            else:
                cals = await calendar_crud.get_by_user(db, user_id)
                if cals:
                    event_in.calendar_id = cals[0].id
                else:
                    # Create default calendar on the fly
                    from app.schemas.calendar_schema import CalendarCreate
                    new_cal = await calendar_crud.create(
                        db, user_id=user_id,
                        obj_in=CalendarCreate(name="Lịch của tôi", color="#4285F4"),
                        is_default=True
                    )
                    event_in.calendar_id = new_cal.id

        await self._check_calendar(db, event_in.calendar_id, user_id)
        await lock_owner(db, user_id)
        if event_in.client_request_id:
            existing = (await db.execute(select(Event.id).where(Event.user_id == user_id, Event.client_request_id == event_in.client_request_id))).scalar_one_or_none()
            if existing:
                return await event_crud.get_with_reminders(db, existing)
        if event_in.end_at <= event_in.start_at:
            raise HTTPException(422, "Kết thúc phải sau bắt đầu.")
        if not event_in.is_all_day:
            from app.services.schedule_conflict import check_overlap
            await check_overlap(db, user_id, event_in.start_at, event_in.end_at, allowed=event_in.allow_overlap)

        return await event_crud.create(db, user_id=user_id, obj_in=event_in)

    @serialized_write
    async def update_event(
        self,
        db: AsyncSession,
        event_id: int,
        user_id: int,
        event_in: EventUpdate,
        expected_revision: Optional[str] = None
    ) -> Event:
        event = await self.get_event_by_id(db, event_id, user_id)
        from app.services.revision import require_current_revision
        require_current_revision(event, expected_revision)
        scope = event_in.scope or "this"
        if "calendar_id" in event_in.model_fields_set:
            await self._check_calendar(db, event_in.calendar_id, user_id)
        if event.recurrence_rule and not event.is_exception and scope in ("this", "following") and not event_in.original_start:
            raise HTTPException(422, "Cần original_start để chọn đúng lần lặp.")
        if event.is_exception and scope in ("all", "following"):
            anchor = event.original_start
            event = await self.get_event_by_id(db, event.parent_event_id, user_id)
            event_in = event_in.model_copy(update={"original_start": anchor})
        anchor = event_in.original_start
        if event.recurrence_rule and scope in ("this", "following"):
            self._check_anchor(event, anchor)
        if event.recurrence_rule and scope == "all" and anchor and event_in.start_at:
            duration = (event_in.end_at - event_in.start_at) if event_in.end_at else event.end_at - event.start_at
            shifted = event.start_at + (event_in.start_at - anchor)
            event_in = event_in.model_copy(update={"start_at": shifted, "end_at": shifted + duration})
        start = event_in.start_at or event.start_at
        end = event_in.end_at or (start + (event.end_at - event.start_at))
        if end <= start:
            raise HTTPException(422, "Kết thúc phải sau bắt đầu.")
        schedule_changed = bool({"start_at", "end_at", "is_all_day"} & event_in.model_fields_set)
        if schedule_changed and not (event_in.is_all_day if event_in.is_all_day is not None else event.is_all_day):
            from app.services.schedule_conflict import check_overlap
            await check_overlap(db, user_id, start, end, exclude=("event", event.id), allowed=event_in.allow_overlap)
        if event_in.start_at and "end_at" not in event_in.model_fields_set:
            event_in = event_in.model_copy(update={"end_at": end})

        # If it's a recurring master event and scope is 'this', create an exception event
        if event.recurrence_rule and not event.is_exception and scope == "this":
            inst_start = event_in.original_start or event.start_at
            existing = (await db.execute(select(Event).where(Event.parent_event_id == event.id, Event.original_start == inst_start))).scalars().first()
            if existing:
                return await event_crud.update(db, db_obj=existing, obj_in=event_in)
            duration = (event_in.end_at - event_in.start_at) if (event_in.end_at and event_in.start_at) else (event.end_at - event.start_at)
            new_start = event_in.start_at or inst_start
            new_end = event_in.end_at or (new_start + duration)

            exception_event = Event(
                user_id=user_id,
                calendar_id=event_in.calendar_id or event.calendar_id,
                title=event_in.title if event_in.title is not None else event.title,
                description=event_in.description if event_in.description is not None else event.description,
                location=event_in.location if event_in.location is not None else event.location,
                start_at=new_start,
                end_at=new_end,
                is_all_day=event_in.is_all_day if event_in.is_all_day is not None else event.is_all_day,
                color=event_in.color or event.color,
                parent_event_id=event.id,
                is_exception=True,
                is_cancelled=event_in.is_cancelled if event_in.is_cancelled is not None else False,
                original_start=inst_start
            )
            db.add(exception_event)
            await db.flush()

            reminders_to_add = event_in.reminders if event_in.reminders is not None else (
                [EventReminderCreate(minutes_before=r.minutes_before) for r in event.reminders] if event.reminders else []
            )
            for rem in reminders_to_add:
                db.add(EventReminder(event_id=exception_event.id, minutes_before=rem.minutes_before))

            event.updated_at = datetime.now(timezone.utc)
            await db.commit()
            return await event_crud.get_with_reminders(db, exception_event.id)

        # If it's a recurring master event and scope is 'following', split series
        if event.recurrence_rule and not event.is_exception and scope == "following":
            split_dt = event_in.original_start or event_in.start_at or event.start_at
            old_end = event.recurrence_end
            count_match = re.search(r"(?:^|;)COUNT=(\d+)", event.recurrence_rule, re.I)
            remaining_rule = event.recurrence_rule
            if count_match and "recurrence_rule" not in event_in.model_fields_set:
                before = sum(1 for _ in occurrences(event.start_at, event.end_at, event.recurrence_rule, event.start_at, split_dt, old_end))
                remaining = int(count_match[1]) - before
                if remaining < 1:
                    raise HTTPException(422, "Lần lặp nằm ngoài chuỗi.")
                remaining_rule = re.sub(r"COUNT=\d+", f"COUNT={remaining}", remaining_rule, flags=re.I)
            event.recurrence_end = split_dt - timedelta(seconds=1)
            db.add(event)

            series_start = event_in.start_at or split_dt
            duration = (event_in.end_at - event_in.start_at) if (event_in.end_at and event_in.start_at) else (event.end_at - event.start_at)
            series_end = event_in.end_at or (series_start + duration)

            new_series = Event(
                user_id=user_id,
                calendar_id=event_in.calendar_id or event.calendar_id,
                title=event_in.title if event_in.title is not None else event.title,
                description=event_in.description if event_in.description is not None else event.description,
                location=event_in.location if event_in.location is not None else event.location,
                start_at=series_start,
                end_at=series_end,
                is_all_day=event_in.is_all_day if event_in.is_all_day is not None else event.is_all_day,
                color=event_in.color or event.color,
                recurrence_rule=event_in.recurrence_rule if "recurrence_rule" in event_in.model_fields_set else remaining_rule,
                recurrence_end=event_in.recurrence_end if event_in.recurrence_end is not None else old_end,
                is_exception=False,
                parent_event_id=None
            )
            db.add(new_series)
            await db.flush()
            # Move future exceptions to the new master; do not leave orphan overrides in the old series.
            children = (await db.execute(select(Event).where(Event.parent_event_id == event.id, Event.original_start >= split_dt))).scalars().all()
            for child in children:
                child.parent_event_id = new_series.id
                shift = series_start - split_dt
                child.original_start += shift

            reminders_to_add = event_in.reminders if event_in.reminders is not None else (
                [EventReminderCreate(minutes_before=r.minutes_before) for r in event.reminders] if event.reminders else []
            )
            for rem in reminders_to_add:
                db.add(EventReminder(event_id=new_series.id, minutes_before=rem.minutes_before))

            await db.commit()
            return await event_crud.get_with_reminders(db, new_series.id)

        # Moving an entire recurring series must also move the exception anchors.
        if event.recurrence_rule and scope == "all" and event_in.start_at:
            shift = event_in.start_at - event.start_at
            children = (await db.execute(select(Event).where(Event.parent_event_id == event.id))).scalars().all()
            for child in children:
                child.original_start += shift
                child.start_at += shift
                child.end_at += shift
        # Update all or normal event or existing exception
        return await event_crud.update(db, db_obj=event, obj_in=event_in)

    @serialized_write
    async def delete_event(
        self,
        db: AsyncSession,
        event_id: int,
        user_id: int,
        scope: str = "this",
        occurrence_date: Optional[datetime] = None
    ) -> None:
        event = await self.get_event_by_id(db, event_id, user_id)
        if scope not in ("this", "following", "all"):
            raise HTTPException(422, "Phạm vi không hợp lệ.")
        if event.is_exception and scope == "this":
            event.is_cancelled = True
            await db.commit()
            return
        if event.is_exception and scope == "following":
            occurrence_date = event.original_start
            event = await self.get_event_by_id(db, event.parent_event_id, user_id)
        if event.recurrence_rule and scope in ("this", "following") and not occurrence_date:
            raise HTTPException(422, "Cần occurrence_date để chọn đúng lần lặp.")
        if event.recurrence_rule and scope in ("this", "following"):
            self._check_anchor(event, occurrence_date)

        if scope == "all":
            # If deleting all, purge all child exceptions referencing this event
            target_id = event.parent_event_id if (event.is_exception and event.parent_event_id) else event.id
            await db.execute(delete(Event).where(Event.parent_event_id == target_id))
            target_event = event if target_id == event.id else await self.get_event_by_id(db, target_id, user_id)
            await event_crud.delete(db, db_obj=target_event)
            return

        if event.recurrence_rule and not event.is_exception and scope == "this":
            inst_start = occurrence_date or event.start_at
            # Check if an exception already exists for this instance
            stmt = select(Event).where(
                Event.parent_event_id == event.id,
                Event.original_start == inst_start
            )
            result = await db.execute(stmt)
            existing_exc = result.scalars().first()
            if existing_exc:
                existing_exc.is_cancelled = True
                db.add(existing_exc)
                await db.commit()
                return

            duration = event.end_at - event.start_at
            cancelled_event = Event(
                user_id=user_id,
                calendar_id=event.calendar_id,
                title=event.title,
                description=event.description,
                location=event.location,
                start_at=inst_start,
                end_at=inst_start + duration,
                is_all_day=event.is_all_day,
                color=event.color,
                parent_event_id=event.id,
                is_exception=True,
                is_cancelled=True,
                original_start=inst_start
            )
            db.add(cancelled_event)
            await db.commit()
            return

        if event.recurrence_rule and not event.is_exception and scope == "following":
            cutoff = occurrence_date or event.start_at
            event.recurrence_end = cutoff - timedelta(seconds=1)
            await db.execute(delete(Event).where(Event.parent_event_id == event.id, Event.original_start >= cutoff))
            db.add(event)
            await db.commit()
            return

        # non-recurring or an exception row itself
        await db.execute(delete(Event).where(Event.parent_event_id == event.id))
        await event_crud.delete(db, db_obj=event)

    @staticmethod
    def _aware(value):
        return value.replace(tzinfo=BUSINESS_TZ) if value.tzinfo is None else value

    @staticmethod
    def _check_anchor(event, anchor):
        anchor = aware(anchor)
        matches = occurrences(event.start_at, event.end_at, event.recurrence_rule, anchor, anchor + timedelta(seconds=1), event.recurrence_end)
        if not any(start == anchor for start, _ in matches):
            raise HTTPException(422, "Thời điểm được chọn không phải lần lặp trong chuỗi.")

    async def _check_calendar(self, db, calendar_id, user_id):
        parent = await calendar_crud.get(db, id=calendar_id) if calendar_id else None
        if not parent or parent.user_id != user_id:
            raise HTTPException(404, "Không tìm thấy lịch này.")

event_service = EventService()

