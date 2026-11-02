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

    async def create_category(self, db: AsyncSession, user_id: int, cat_in: CategoryCreate) -> Category:
        return await category_crud.create(db, user_id=user_id, obj_in=cat_in)

    async def update_category(self, db: AsyncSession, cat_id: int, user_id: int, cat_in: CategoryUpdate) -> Category:
        category = await self.get_category_by_id(db, cat_id, user_id)
        return await category_crud.update(db, db_obj=category, obj_in=cat_in)

    async def delete_category(self, db: AsyncSession, cat_id: int, user_id: int) -> None:
        category = await self.get_category_by_id(db, cat_id, user_id)
        await category_crud.delete(db, db_obj=category)

category_service = CategoryService()

