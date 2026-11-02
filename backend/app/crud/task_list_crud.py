from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.crud.base import CRUDBase
from app.models.task_model import TaskList, Task
from app.schemas.task_schema import TaskListCreate, TaskListUpdate, ItemReorder

class CRUDTaskList(CRUDBase[TaskList]):
    async def get_by_user(self, db: AsyncSession, user_id: int) -> List[dict]:
        # Fetch lists and aggregate task counts
        stmt = (
            select(
                TaskList,
                func.count(Task.id).label("task_count"),
                func.count(Task.id).filter(Task.is_completed == True).label("completed_count")
            )
            .outerjoin(Task, Task.list_id == TaskList.id)
            .where(TaskList.user_id == user_id)
            .group_by(TaskList.id)
            .order_by(TaskList.position.asc(), TaskList.id.asc())
        )
        result = await db.execute(stmt)
        rows = result.all()
        lists = []
        for lst, total, completed in rows:
            lst_dict = {
                "id": lst.id,
                "user_id": lst.user_id,
                "name": lst.name,
                "color": lst.color,
                "icon": lst.icon,
                "position": lst.position,
                "is_default": lst.is_default,
                "created_at": lst.created_at,
                "updated_at": lst.updated_at,
                "task_count": total,
                "completed_count": completed
            }
            lists.append(lst_dict)
        return lists

    async def get_default(self, db: AsyncSession, user_id: int) -> Optional[TaskList]:
        stmt = select(TaskList).where(TaskList.user_id == user_id, TaskList.is_default == True)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def create(self, db: AsyncSession, user_id: int, obj_in: TaskListCreate, is_default: bool = False) -> TaskList:
        db_obj = TaskList(
            user_id=user_id,
            name=obj_in.name,
            color=obj_in.color,
            icon=obj_in.icon,
            position=obj_in.position or 0,
            is_default=is_default
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(self, db: AsyncSession, db_obj: TaskList, obj_in: TaskListUpdate) -> TaskList:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, db_obj: TaskList) -> None:
        await db.delete(db_obj)
        await db.commit()

    async def reorder(self, db: AsyncSession, user_id: int, items: List[ItemReorder]) -> None:
        for item in items:
            stmt = select(TaskList).where(TaskList.id == item.id, TaskList.user_id == user_id)
            obj = (await db.execute(stmt)).scalars().first()
            if obj:
                obj.position = item.position
        await db.commit()

task_list_crud = CRUDTaskList(TaskList)

