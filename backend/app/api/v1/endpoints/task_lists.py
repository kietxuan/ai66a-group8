from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user_model import User
from app.schemas.task_schema import (
    TaskListCreate, TaskListUpdate, TaskListResponse, ReorderRequest
)
from app.services.task_list_service import task_list_service

router = APIRouter()

@router.get("", response_model=List[TaskListResponse])
async def get_task_lists(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách task lists kèm số lượng việc"""
    return await task_list_service.get_task_lists(db, user_id=current_user.id)

@router.post("", response_model=TaskListResponse, status_code=status.HTTP_201_CREATED)
async def create_task_list(
    list_in: TaskListCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tạo danh sách công việc mới"""
    return await task_list_service.create_task_list(db, user_id=current_user.id, list_in=list_in)

@router.put("/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_task_lists(
    req: ReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sắp xếp lại thứ tự các danh sách công việc"""
    await task_list_service.reorder_task_lists(db, user_id=current_user.id, items=req.items)

@router.put("/{list_id}", response_model=TaskListResponse)
async def update_task_list(
    list_id: int,
    list_in: TaskListUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cập nhật thông tin danh sách"""
    return await task_list_service.update_task_list(
        db, list_id=list_id, user_id=current_user.id, list_in=list_in
    )

@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_list(
    list_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xóa danh sách (không thể xóa danh sách mặc định)"""
    await task_list_service.delete_task_list(db, list_id=list_id, user_id=current_user.id)

