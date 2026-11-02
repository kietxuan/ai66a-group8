from app.services.write_lock import serialized_write
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.crud.task_list_crud import task_list_crud
from app.models.task_model import TaskList
from app.schemas.task_schema import TaskListCreate, TaskListUpdate, ItemReorder

class TaskListService:
    async def get_task_lists(self, db: AsyncSession, user_id: int) -> List[dict]:
        return await task_list_crud.get_by_user(db, user_id=user_id)

    async def get_task_list_by_id(self, db: AsyncSession, list_id: int, user_id: int) -> TaskList:
        task_list = await task_list_crud.get(db, id=list_id)
        if not task_list or task_list.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy danh sách công việc này.")
        return task_list

    @serialized_write
    async def create_task_list(self, db: AsyncSession, user_id: int, list_in: TaskListCreate) -> TaskList:
        return await task_list_crud.create(db, user_id=user_id, obj_in=list_in)

    @serialized_write
    async def update_task_list(self, db: AsyncSession, list_id: int, user_id: int, list_in: TaskListUpdate) -> TaskList:
        task_list = await self.get_task_list_by_id(db, list_id, user_id)
        return await task_list_crud.update(db, db_obj=task_list, obj_in=list_in)

    @serialized_write
    async def delete_task_list(self, db: AsyncSession, list_id: int, user_id: int) -> None:
        task_list = await self.get_task_list_by_id(db, list_id, user_id)
        if task_list.is_default:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể xóa danh sách Tasks mặc định.")
        await task_list_crud.delete(db, db_obj=task_list)

    @serialized_write
    async def reorder_task_lists(self, db: AsyncSession, user_id: int, items: List[ItemReorder]) -> None:
        await task_list_crud.reorder(db, user_id=user_id, items=items)

task_list_service = TaskListService()

