from fastapi import HTTPException, status, Depends
from app.api.deps import get_current_user
from app.models.user_model import User
from app.core.redis import redis_client
from app.core.logger import logger

AI_RATE_LIMIT_MAX = 30
AI_RATE_LIMIT_WINDOW_SECONDS = 60

async def enforce_limit(redis, key: str, maximum: int, window: int):
    if redis is None:
        raise HTTPException(503, "Dịch vụ giới hạn truy cập chưa sẵn sàng.")
    count = await redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
        1, f"ratelimit:{key}", window
    )
    if count > maximum:
        raise HTTPException(429, "Quá nhiều yêu cầu. Vui lòng thử lại sau.")

async def check_ai_rate_limit(current_user: User = Depends(get_current_user)) -> None:
    """
    Kiểm tra rate limit AI Chat (tối đa 30 tin nhắn / phút / user).
    Sử dụng Redis fixed window counter.
    """
    if not redis_client.redis:
        raise HTTPException(503, "Dịch vụ giới hạn chat chưa sẵn sàng.")

    key = f"ratelimit:ai:{current_user.id}"
    try:
        count = await redis_client.redis.incr(key)
        if count == 1:
            await redis_client.redis.expire(key, AI_RATE_LIMIT_WINDOW_SECONDS)

        if count > AI_RATE_LIMIT_MAX:
            ttl = await redis_client.redis.ttl(key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Bạn đã vượt quá giới hạn 30 tin nhắn/phút. Vui lòng thử lại sau {ttl if ttl > 0 else AI_RATE_LIMIT_WINDOW_SECONDS} giây."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Không kiểm tra được giới hạn chat.")
        raise HTTPException(503, "Dịch vụ giới hạn chat chưa sẵn sàng.")

