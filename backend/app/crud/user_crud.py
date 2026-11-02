from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.crud.base import CRUDBase
from app.models.user_model import User
from app.schemas.user_schema import UserCreate, UserUpdate

class CRUDUser(CRUDBase[User]):
    async def get_all_users(self, page: int, limit: int, current_user_id: int, db: AsyncSession) -> List[User]:
        stmt = (
            select(self.model)
            .where(self.model.id != current_user_id)
            .order_by(self.model.id.desc())
            .limit(limit)
            .offset((page - 1) * limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        result = await db.execute(select(self.model).where(self.model.email == email))
        return result.scalars().first()

    async def create(self, db: AsyncSession, obj_in: UserCreate, hashed_password: str) -> User:
        db_obj = User(
            email=obj_in.email,
            nickname=obj_in.nickname,
            password_hashed=hashed_password,
            is_activate=True,
            theme_preference=getattr(obj_in, "theme_preference", "light") or "light",
            timezone=getattr(obj_in, "timezone", "Asia/Ho_Chi_Minh") or "Asia/Ho_Chi_Minh",
            notify_enabled=True if getattr(obj_in, "notify_enabled", None) is None else bool(obj_in.notify_enabled),
            notify_minutes_before=getattr(obj_in, "notify_minutes_before", 15) or 15,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update_profile(self, db: AsyncSession, user: User, obj_in: UserUpdate) -> User:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        await db.commit()
        await db.refresh(user)
        return user

    async def update_password(self, db: AsyncSession, user: User, hashed_password: str) -> User:
        user.password_hashed = hashed_password
        await db.commit()
        await db.refresh(user)
        return user

    async def set_admin(self, email: str, db: AsyncSession) -> None:
        stmt = (
            update(self.model)
            .where(self.model.email == email)
            .values(is_developer=True)
        )
        await db.execute(stmt)
        await db.commit()

user_crud = CRUDUser(User)
