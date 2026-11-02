from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user_model import User
from app.schemas.task_schema import TaskStepCreate, TaskStepUpdate, TaskStepResponse
from app.services.task_service import task_service

router = APIRouter()

class ToggleStepCompleteBody(BaseModel):
    is_completed: bool

@router.post("/{task_id}/steps", response_model=TaskStepResponse, status_code=status.HTTP_201_CREATED)
async def add_task_step(
    task_id: int,
    step_in: TaskStepCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Thêm bước (subtask) cho công việc"""
    return await task_service.add_step(
        db, task_id=task_id, user_id=current_user.id, step_in=step_in
    )

@router.put("/{task_id}/steps/{step_id}", response_model=TaskStepResponse)
async def update_task_step(
    task_id: int,
    step_id: int,
    step_in: TaskStepUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cập nhật bước của công việc"""
    return await task_service.update_step(
        db, task_id=task_id, step_id=step_id, user_id=current_user.id, step_in=step_in
    )

@router.delete("/{task_id}/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_step(
    task_id: int,
    step_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Xóa bước của công việc"""
    await task_service.delete_step(db, task_id=task_id, step_id=step_id, user_id=current_user.id)

@router.patch("/{task_id}/steps/{step_id}/complete", response_model=TaskStepResponse)
async def toggle_task_step_complete(
    task_id: int,
    step_id: int,
    body: ToggleStepCompleteBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Đánh dấu hoàn thành bước con"""
    return await task_service.update_step(
        db,
        task_id=task_id,
        step_id=step_id,
        user_id=current_user.id,
        step_in=TaskStepUpdate(is_completed=body.is_completed)
    )

