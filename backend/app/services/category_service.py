from app.services.write_lock import serialized_write
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.crud.category_crud import category_crud
from app.models.category_model import Category
from app.schemas.category_schema import CategoryCreate, CategoryUpdate

class CategoryService:
    async def get_categories(self, db: AsyncSession, user_id: int) -> List[Category]:
        return await category_crud.get_by_user(db, user_id=user_id)

    async def get_category_by_id(self, db: AsyncSession, cat_id: int, user_id: int) -> Category:
        category = await category_crud.get(db, id=cat_id)
        if not category or category.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy danh mục này.")
        return category

    @serialized_write
    async def create_category(self, db: AsyncSession, user_id: int, cat_in: CategoryCreate) -> Category:
        return await category_crud.create(db, user_id=user_id, obj_in=cat_in)

    @serialized_write
    async def update_category(self, db: AsyncSession, cat_id: int, user_id: int, cat_in: CategoryUpdate) -> Category:
        category = await self.get_category_by_id(db, cat_id, user_id)
        old_name = category.name
        old_color = category.color
        updated = await category_crud.update(db, db_obj=category, obj_in=cat_in)
        from sqlalchemy import update
        from app.models.task_model import Task
        from app.models.event_model import Event
        values = {}
        if cat_in.name is not None:
            values["category"] = cat_in.name
        if cat_in.color is not None:
            values["color"] = cat_in.color
        if values:
            await db.execute(
                update(Task)
                .where(Task.user_id == user_id, (Task.category == old_name) | ((Task.category.is_(None)) & (Task.color == old_color)))
                .values(**values)
            )
            await db.execute(
                update(Event)
                .where(Event.user_id == user_id, (Event.category == old_name) | ((Event.category.is_(None)) & (Event.color == old_color)))
                .values(**values)
            )
            await db.commit()
        return updated

    @serialized_write
    async def delete_category(self, db: AsyncSession, cat_id: int, user_id: int) -> None:
        category = await self.get_category_by_id(db, cat_id, user_id)
        from sqlalchemy import update
        from app.models.task_model import Task
        from app.models.event_model import Event
        await db.execute(
            update(Task)
            .where(Task.user_id == user_id, (Task.category == category.name) | (Task.color == category.color))
            .values(category=None, color=None)
        )
        await db.execute(
            update(Event)
            .where(Event.user_id == user_id, (Event.category == category.name) | (Event.color == category.color))
            .values(category=None, color=None)
        )
        await category_crud.delete(db, db_obj=category)
        await db.commit()

category_service = CategoryService()

