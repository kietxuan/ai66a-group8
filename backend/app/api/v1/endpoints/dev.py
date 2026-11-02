from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from pydantic import EmailStr

from app.models.user_model import User
from app.schemas.common import ApiResponse
from app.schemas.dev_schema import SystemInfoData
from app.core.database import get_db
from app.core.redis import get_redis
from app.api.deps import get_current_developer
from app.core.logger import logger
from app.services.dev_service import dev_service

router = APIRouter()

@router.get("/system-info", response_model=ApiResponse[SystemInfoData])
async def get_system_info(
    dev: User = Depends(get_current_developer)
):
    logger.info(f"Developer {dev.email} đang truy cập thông tin hệ thống.")

    info_data = SystemInfoData(
        app_name="Hệ thống quản lý API",
        version="1.0.0",
        developer=dev.email
    )
    
    return ApiResponse(
        message="Hệ thống ổn định",
        data=info_data
    )

@router.get("/health", response_model=ApiResponse[None])
async def check_connect_db(
    dev: User = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    """API Dev kiểm tra kết nối với các cơ sở dữ liệu"""
    await dev_service.check_health(db=db, redis=redis)
    return ApiResponse(message="Mọi thứ kết nối ổn định")

@router.patch("/set-admin", response_model=ApiResponse[None])
async def set_admin(
    email: EmailStr,
    dev: User = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db)
):
    """API Dev cấp quyền admin cho User"""
    await dev_service.set_admin(email=email, db=db)
    return ApiResponse(message=f"Đã cập nhật admin cho email {email}")
