from typing import List, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query, status
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
    """Thực hiện thao tác hàng loạt trên nhiều công việc"""
    all_tasks = await task_service.get_tasks(db, user_id=current_user.id, view="all")
    target_ids = set(body.task_ids or [])
    affected = 0
    today = date.today()

    if body.action == "clear_completed":
        for t in all_tasks:
            if t.is_completed and (not target_ids or t.id in target_ids):
                await task_service.delete_task(db, task_id=t.id, user_id=current_user.id)
                affected += 1
        return {"success": True, "affected": affected, "action": body.action}

    if body.action == "reschedule_overdue":
        new_due = body.due_date or today
        for t in all_tasks:
            if not t.is_completed and t.due_date and t.due_date < today:
                if not target_ids or t.id in target_ids:
                    await task_service.update_task(
                        db, task_id=t.id, user_id=current_user.id,
                        task_in=TaskUpdate(due_date=new_due, is_in_my_day=(new_due == today))
                    )
                    affected += 1
        return {"success": True, "affected": affected, "action": body.action}

    targets = [t for t in all_tasks if t.id in target_ids]
    for t in targets:
        if body.action == "complete":
            await task_service.toggle_complete(db, task_id=t.id, user_id=current_user.id, is_completed=True)
            affected += 1
        elif body.action == "uncomplete":
            await task_service.toggle_complete(db, task_id=t.id, user_id=current_user.id, is_completed=False)
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
            await task_service.update_task(db, task_id=t.id, user_id=current_user.id, task_in=TaskUpdate(due_date=body.due_date))
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cập nhật thông tin công việc"""
    return await task_service.update_task(
        db, task_id=task_id, user_id=current_user.id, task_in=task_in
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Đánh dấu hoàn thành hoặc bỏ hoàn thành công việc"""
    return await task_service.toggle_complete(
        db, task_id=task_id, user_id=current_user.id, is_completed=body.is_completed
    )

@router.patch("/{task_id}/important", response_model=TaskResponse)
async def toggle_task_important(
    task_id: int,
    body: ToggleImportantBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Đánh dấu sao quan trọng"""
    return await task_service.toggle_important(
        db, task_id=task_id, user_id=current_user.id, is_important=body.is_important
    )

@router.patch("/{task_id}/my-day", response_model=TaskResponse)
async def toggle_task_my_day(
    task_id: int,
    body: ToggleMyDayBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Thêm vào hoặc xóa khỏi My Day"""
    return await task_service.toggle_my_day(
        db, task_id=task_id, user_id=current_user.id, is_in_my_day=body.is_in_my_day
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
