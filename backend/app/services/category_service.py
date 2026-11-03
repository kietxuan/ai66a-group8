from app.services.write_lock import serialized_write
from typing import List
from sqlalchemy import and_, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.crud.category_crud import category_crud
from app.models.category_model import Category
from app.models.task_model import Task
from app.models.event_model import Event
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
        changes = cat_in.model_dump(exclude_unset=True)
        if any(value is None for value in changes.values()):
            raise HTTPException(status_code=422, detail="Tên và màu danh mục không được để trống.")
        for field, value in changes.items():
            setattr(category, field, value)
        values = {"category": changes["name"]} if "name" in changes else {}
        if "color" in changes:
            values["color"] = changes["color"]
        if values:
            for model in (Task, Event):
                await db.execute(
                    update(model)
                    .where(model.user_id == user_id,
                           or_(model.category == old_name,
                               and_(model.category.is_(None), model.color == old_color)))
                    .values(**values)
                )
        await db.commit()
        await db.refresh(category)
        return category

    @serialized_write
    async def delete_category(self, db: AsyncSession, cat_id: int, user_id: int) -> None:
        category = await self.get_category_by_id(db, cat_id, user_id)
        for model in (Task, Event):
            await db.execute(
                update(model)
                .where(model.user_id == user_id,
                       or_(model.category == category.name,
                           and_(model.category.is_(None), model.color == category.color)))
                .values(category=None, color=None)
            )
        await db.delete(category)
        await db.commit()

category_service = CategoryService()

