from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user_model import User
from app.schemas.calendar_schema import CalendarCreate, CalendarUpdate, CalendarResponse
from app.services.calendar_service import calendar_service

router = APIRouter()

@router.get("", response_model=List[CalendarResponse])
async def get_calendars(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách calendars của người dùng"""
    return await calendar_service.get_calendars(db, user_id=current_user.id)

@router.post("", response_model=CalendarResponse, status_code=status.HTTP_201_CREATED)
async def create_calendar(
    calendar_in: CalendarCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tạo calendar mới"""
    return await calendar_service.create_calendar(db, user_id=current_user.id, calendar_in=calendar_in)

@router.put("/{calendar_id}", response_model=CalendarResponse)
async def update_calendar(
    calendar_id: int,
    calendar_in: CalendarUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cập nhật calendar"""
    return await calendar_service.update_calendar(
        db, calendar_id=calendar_id, user_id=current_user.id, calendar_in=calendar_in
    )

@router.delete("/{calendar_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar(
    calendar_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xóa calendar (không thể xóa lịch mặc định)"""
    await calendar_service.delete_calendar(db, calendar_id=calendar_id, user_id=current_user.id)

