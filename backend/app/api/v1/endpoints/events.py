from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user_model import User
from app.schemas.event_schema import EventCreate, EventUpdate, EventResponse
from app.services.event_service import event_service

router = APIRouter()

@router.get("", response_model=List[EventResponse])
async def get_events(
    start: datetime = Query(..., description="Bắt đầu khoảng thời gian"),
    end: datetime = Query(..., description="Kết thúc khoảng thời gian"),
    calendar_id: Optional[int] = Query(None, description="Lọc theo ID lịch"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách sự kiện trong khoảng thời gian"""
    return await event_service.get_events_in_range(
        db,
        user_id=current_user.id,
        start_at=start,
        end_at=end,
        calendar_id=calendar_id
    )

@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_in: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tạo sự kiện mới (sự kiện thường hoặc lặp lại)"""
    return await event_service.create_event(db, user_id=current_user.id, event_in=event_in)

@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy chi tiết một sự kiện"""
    return await event_service.get_event_by_id(db, event_id=event_id, user_id=current_user.id)

@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    event_in: EventUpdate,
    if_match: Optional[str] = Header(None, alias="If-Match"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cập nhật sự kiện (hỗ trợ scope: this | following | all)"""
    return await event_service.update_event(
        db, event_id=event_id, user_id=current_user.id, event_in=event_in, expected_revision=if_match
    )

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int,
    scope: str = Query("this", pattern="^(this|following|all)$"),
    occurrence_date: Optional[datetime] = Query(None, description="Anchor start time of the specific occurrence being cancelled/split"),
    original_start: Optional[datetime] = Query(None, description="Alternative alias for occurrence_date"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xóa sự kiện"""
    await event_service.delete_event(
        db,
        event_id=event_id,
        user_id=current_user.id,
        scope=scope,
        occurrence_date=occurrence_date or original_start
    )

