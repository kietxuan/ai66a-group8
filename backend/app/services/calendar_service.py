from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.crud.calendar_crud import calendar_crud
from app.models.calendar_model import Calendar
from app.schemas.calendar_schema import CalendarCreate, CalendarUpdate

class CalendarService:
    async def get_calendars(self, db: AsyncSession, user_id: int) -> List[Calendar]:
        return await calendar_crud.get_by_user(db, user_id=user_id)

    async def get_calendar_by_id(self, db: AsyncSession, calendar_id: int, user_id: int) -> Calendar:
        calendar = await calendar_crud.get(db, id=calendar_id)
        if not calendar or calendar.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lịch này.")
        return calendar

    async def create_calendar(self, db: AsyncSession, user_id: int, calendar_in: CalendarCreate) -> Calendar:
        return await calendar_crud.create(db, user_id=user_id, obj_in=calendar_in)

    async def update_calendar(self, db: AsyncSession, calendar_id: int, user_id: int, calendar_in: CalendarUpdate) -> Calendar:
        calendar = await self.get_calendar_by_id(db, calendar_id, user_id)
        return await calendar_crud.update(db, db_obj=calendar, obj_in=calendar_in)

    async def delete_calendar(self, db: AsyncSession, calendar_id: int, user_id: int) -> None:
        calendar = await self.get_calendar_by_id(db, calendar_id, user_id)
        if calendar.is_default:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể xóa lịch mặc định của bạn.")
        await calendar_crud.delete(db, db_obj=calendar)

calendar_service = CalendarService()

