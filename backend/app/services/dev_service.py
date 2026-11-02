import asyncio

from app.core.logger import logger
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.schemas.dev_schema import DevErrors
from app.crud.user_crud import user_crud

class DeveloperService:
    async def _check_db(self, db: AsyncSession):
        try:
            await db.execute(text("SELECT 1"))
        except Exception as e:
            logger.error(f"Đã mất kết nối với PostgreSQL: {e}")
            raise DevErrors.DATABASE_ERROR.throw()

    async def _check_redis(self, redis: Redis):
        try:
            await redis.ping()
        except Exception as e:
            logger.error(f"Đã mất kết nối với Redis: {e}")
            raise DevErrors.REDIS_ERROR.throw()

    async def check_health(self, db: AsyncSession, redis: Redis) -> None:
        """Nghiệp vụ kiểm tra sức khỏe hệ thống (PostgreSQL và Redis)"""
        await asyncio.gather(
            self._check_db(db),
            self._check_redis(redis)
        )
    
    async def set_admin(self, email: str, db: AsyncSession) -> None:
        """Nghiệp vụ đặt tài khoản email thành admin"""
        user_existed = await user_crud.get_by_email(db=db, email=email)
        if not user_existed:
            raise DevErrors.USER_NOT_FOUND.throw()
        
        await user_crud.set_admin(email=email, db=db)
    

dev_service = DeveloperService()
