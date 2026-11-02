from typing import Any, Generic, Type, TypeVar, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import Base

# Khai báo kiểu dữ liệu động ràng buộc với Base Class của SQLAlchemy
ModelType = TypeVar("ModelType", bound=Base)

class CRUDBase(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: Any) -> Optional[ModelType]:
        """Lấy một thực thể theo ID khóa chính"""
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalars().first()
