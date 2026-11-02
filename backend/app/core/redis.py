import redis.asyncio as aioredis
from typing import Optional
from app.core.config import settings
from app.core.logger import logger

class RedisClient:
    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None

    async def connect(self) -> None:
        """
        Khởi tạo kết nối Redis bất đồng bộ sử dụng Connection Pool.
        """
        try:
            # Tạo instance Redis bất đồng bộ sử dụng URL
            self.redis = aioredis.from_url(
                settings.get_redis_url,
                decode_responses=True,  # Tự động decode bytes thành string
                socket_timeout=5.0
            )
            # Ping thử kết nối để đảm bảo hoạt động
            await self.redis.ping()
            logger.info("Kết nối tới Redis thành công!")
        except Exception as e:
            logger.error(f"Lỗi khởi tạo kết nối Redis: {str(e)}")
            self.redis = None
            raise e

    async def close(self) -> None:
        """
        Đóng kết nối Redis an toàn khi ứng dụng shutdown.
        """
        if self.redis:
            try:
                await self.redis.close()
                logger.info("Đóng kết nối Redis thành công!")
            except Exception as e:
                logger.error(f"Lỗi đóng kết nối Redis: {str(e)}")
            finally:
                self.redis = None

# Một instance duy nhất dùng chung toàn app
redis_client = RedisClient()

async def get_redis() -> aioredis.Redis:
    """
    Dependency helper cho FastAPI Endpoints.
    """
    if redis_client.redis is None:
        raise RuntimeError("Redis client chưa được khởi tạo!")
    return redis_client.redis
