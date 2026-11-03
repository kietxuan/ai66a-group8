from app.core.time import business_today, local_now, BUSINESS_TZ
from typing import List, Optional
from datetime import date, datetime, timedelta
from types import SimpleNamespace
from fastapi import APIRouter, Depends, Query, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user_model import User
from app.schemas.task_schema import TaskCreate, TaskUpdate, TaskResponse, ReorderRequest
from app.services.task_service import task_service

router = APIRouter()

class ToggleCompleteBody(BaseModel):
    is_completed: bool
    allow_overlap: bool = False

class ToggleImportantBody(BaseModel):
    is_important: bool

class ToggleMyDayBody(BaseModel):
    is_in_my_day: bool

class UpdatePositionBody(BaseModel):
    position: int

class BatchTaskActionBody(BaseModel):
    action: str  # complete, uncomplete, important, unimportant, my_day, remove_my_day, delete, move_list, set_due_date, clear_completed, reschedule_overdue
    task_ids: Optional[List[int]] = None
    list_id: Optional[int] = None
    due_date: Optional[date] = None
    allow_overlap: bool = False

@router.get("", response_model=List[TaskResponse])
async def get_tasks(
    list_id: Optional[int] = Query(None, description="Lọc theo ID danh sách"),
    view: Optional[str] = Query(None, description="Smart list: my_day, important, planned, overdue, completed, time_blocked, all"),
    is_completed: Optional[bool] = Query(None, description="Lọc theo trạng thái hoàn thành"),
    due_before: Optional[date] = Query(None, description="Hạn chót trước ngày"),
    due_after: Optional[date] = Query(None, description="Hạn chót sau ngày"),
    search: Optional[str] = Query(None, description="Tìm kiếm theo tiêu đề hoặc ghi chú"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách công việc theo bộ lọc hoặc smart list"""
    tasks = await task_service.get_tasks(
        db,
        user_id=current_user.id,
        list_id=list_id,
        view=view,
        is_completed=is_completed,
        due_before=due_before,
        due_after=due_after
    )
    if search and search.strip():
        q = search.strip().lower()
        tasks = [t for t in tasks if q in (t.title or "").lower() or q in (t.note or "").lower()]
    return tasks

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tạo công việc mới"""
    return await task_service.create_task(db, user_id=current_user.id, task_in=task_in)

@router.post("/batch")
async def batch_task_action(
    body: BatchTaskActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.services.write_lock import lock_owner, AtomicBatchSession
    await lock_owner(db, current_user.id)
    try:
        result = await _batch_task_action(body, AtomicBatchSession(db), current_user)
        await db.commit()
        return result
    except Exception:
        await db.rollback()
        raise


async def _batch_task_action(body, db, current_user):
    """Thực hiện thao tác hàng loạt trên nhiều công việc"""
    all_tasks = await task_service.get_tasks(db, user_id=current_user.id, view="all")
    target_ids = set(body.task_ids or [])
    affected = 0
    today = business_today()

    if body.action == "clear_completed":
        for t in all_tasks:
            if t.is_completed and (not target_ids or t.id in target_ids):
                await task_service.delete_task(db, task_id=t.id, user_id=current_user.id)
                affected += 1
        return {"success": True, "affected": affected, "action": body.action}

    if body.action == "reschedule_overdue":
        new_due = body.due_date or today
        from app.services.recurrence import is_task_overdue
        targets = [t for t in all_tasks if is_task_overdue(t) and (not target_ids or t.id in target_ids)]
        if not body.allow_overlap:
            from app.services.schedule_conflict import check_task_overlap
            from app.core.time import BUSINESS_TZ
            intervals = []
            for t in targets:
                candidate = SimpleNamespace(due_date=new_due, is_all_day=t.is_all_day, start_time=t.start_time,
                    due_time=t.due_time, end_time=t.end_time, duration_minutes=t.duration_minutes)
                await check_task_overlap(db, current_user.id, candidate, exclude=("task", t.id))
                if candidate.is_all_day or not (candidate.start_time or candidate.due_time):
                    continue
                start = datetime.combine(new_due, candidate.start_time or candidate.due_time, BUSINESS_TZ)
                end = datetime.combine(new_due, candidate.end_time, BUSINESS_TZ) if candidate.end_time else start + timedelta(minutes=candidate.duration_minutes or 60)
                for previous, prior_start, prior_end in intervals:
                    if start < prior_end and end > prior_start:
                        raise HTTPException(409, detail={"code": "SCHEDULE_CONFLICT", "message": "Các công việc sẽ trùng giờ.",
                            "items": [{"type": "task", "id": previous.id, "title": previous.title,
                                       "start": prior_start.isoformat(), "end": prior_end.isoformat()}]})
                intervals.append((t, start, end))
        for t in targets:
            await task_service.update_task(
                db, task_id=t.id, user_id=current_user.id,
                task_in=TaskUpdate(due_date=new_due, is_in_my_day=(new_due == today), allow_overlap=body.allow_overlap)
            )
            affected += 1
        return {"success": True, "affected": affected, "action": body.action}

    targets = [t for t in all_tasks if t.id in target_ids]
    for t in targets:
        if body.action == "complete":
            await task_service.toggle_complete(db, task_id=t.id, user_id=current_user.id, is_completed=True)
            affected += 1
        elif body.action == "uncomplete":
            await task_service.toggle_complete(db, task_id=t.id, user_id=current_user.id, is_completed=False, allow_overlap=body.allow_overlap)
            affected += 1
        elif body.action == "important":
            await task_service.toggle_important(db, task_id=t.id, user_id=current_user.id, is_important=True)
            affected += 1
        elif body.action == "unimportant":
            await task_service.toggle_important(db, task_id=t.id, user_id=current_user.id, is_important=False)
            affected += 1
        elif body.action == "my_day":
            await task_service.toggle_my_day(db, task_id=t.id, user_id=current_user.id, is_in_my_day=True)
            affected += 1
        elif body.action == "remove_my_day":
            await task_service.toggle_my_day(db, task_id=t.id, user_id=current_user.id, is_in_my_day=False)
            affected += 1
        elif body.action == "move_list" and body.list_id:
            await task_service.update_task(db, task_id=t.id, user_id=current_user.id, task_in=TaskUpdate(list_id=body.list_id))
            affected += 1
        elif body.action == "set_due_date":
            await task_service.update_task(db, task_id=t.id, user_id=current_user.id, task_in=TaskUpdate(due_date=body.due_date, allow_overlap=body.allow_overlap))
            affected += 1
        elif body.action == "delete":
            await task_service.delete_task(db, task_id=t.id, user_id=current_user.id)
            affected += 1

    return {"success": True, "affected": affected, "action": body.action}

@router.put("/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_tasks(
    req: ReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sắp xếp lại thứ tự công việc"""
    await task_service.reorder_tasks(db, user_id=current_user.id, items=req.items)

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy chi tiết công việc kèm các steps con"""
    return await task_service.get_task_by_id(db, task_id=task_id, user_id=current_user.id)

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_in: TaskUpdate,
    if_match: Optional[str] = Header(None, alias="If-Match"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cập nhật thông tin công việc"""
    return await task_service.update_task(
        db, task_id=task_id, user_id=current_user.id, task_in=task_in, expected_revision=if_match
    )

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xóa công việc"""
    await task_service.delete_task(db, task_id=task_id, user_id=current_user.id)

@router.patch("/{task_id}/complete", response_model=TaskResponse)
async def toggle_task_complete(
    task_id: int,
    body: ToggleCompleteBody,
    if_match: Optional[str] = Header(None, alias="If-Match"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Đánh dấu hoàn thành hoặc bỏ hoàn thành công việc"""
    return await task_service.toggle_complete(
        db, task_id=task_id, user_id=current_user.id, is_completed=body.is_completed, allow_overlap=body.allow_overlap, expected_revision=if_match
    )

@router.patch("/{task_id}/important", response_model=TaskResponse)
async def toggle_task_important(
    task_id: int,
    body: ToggleImportantBody,
    if_match: Optional[str] = Header(None, alias="If-Match"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Đánh dấu sao quan trọng"""
    return await task_service.toggle_important(
        db, task_id=task_id, user_id=current_user.id, is_important=body.is_important, expected_revision=if_match
    )

@router.patch("/{task_id}/my-day", response_model=TaskResponse)
async def toggle_task_my_day(
    task_id: int,
    body: ToggleMyDayBody,
    if_match: Optional[str] = Header(None, alias="If-Match"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Thêm vào hoặc xóa khỏi My Day"""
    return await task_service.toggle_my_day(
        db, task_id=task_id, user_id=current_user.id, is_in_my_day=body.is_in_my_day, expected_revision=if_match
    )

@router.patch("/{task_id}/position", response_model=TaskResponse)
async def update_task_position(
    task_id: int,
    body: UpdatePositionBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cập nhật vị trí sắp xếp công việc"""
    return await task_service.update_task(
        db, task_id=task_id, user_id=current_user.id, task_in=TaskUpdate(position=body.position)
    )
