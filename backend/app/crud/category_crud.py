from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.crud.base import CRUDBase
from app.models.category_model import Category
from app.schemas.category_schema import CategoryCreate, CategoryUpdate

class CRUDCategory(CRUDBase[Category]):
    async def get_by_user(self, db: AsyncSession, user_id: int) -> List[Category]:
        stmt = select(Category).where(Category.user_id == user_id).order_by(Category.name.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, user_id: int, obj_in: CategoryCreate) -> Category:
        db_obj = Category(
            user_id=user_id,
            name=obj_in.name,
            color=obj_in.color
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(self, db: AsyncSession, db_obj: Category, obj_in: CategoryUpdate) -> Category:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, db_obj: Category) -> None:
        await db.delete(db_obj)
        await db.commit()

category_crud = CRUDCategory(Category)

