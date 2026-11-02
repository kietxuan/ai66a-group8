from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.redis import get_redis
from app.services.auth_service import auth_service
from app.schemas.common import ApiResponse
from app.schemas.otp_schema import OTPVerifyData

router = APIRouter()


class OTPSendRequest(BaseModel):
    email: Optional[EmailStr] = None
    reason: Optional[str] = "verify-email"


class OTPVerifyRequest(BaseModel):
    email: Optional[EmailStr] = None
    otp: Optional[str] = None
    reason: Optional[str] = "verify-email"


@router.post("/send", response_model=ApiResponse[None])
async def send_otp_email(
    request: Request,
    email: Optional[EmailStr] = Query(None),
    reason: str = Query("verify-email"),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    """Gửi mã OTP về email để xác nhận đăng ký hoặc đặt lại mật khẩu (hỗ trợ cả Query và JSON Body)"""
    target_email = email
    target_reason = reason
    if not target_email:
        try:
            body = await request.json()
            target_email = body.get("email")
            target_reason = body.get("reason") or reason
        except Exception:
            pass
    await auth_service.send_otp_email(email=target_email, reason=target_reason, db=db, redis=redis)
    return ApiResponse(message=f"Mã OTP 6 chữ số đã được gửi tới {target_email}")


@router.post("/verify", response_model=ApiResponse[OTPVerifyData])
async def verify_otp_email(
    request: Request,
    email: Optional[EmailStr] = Query(None),
    otp: Optional[str] = Query(None),
    reason: str = Query("verify-email"),
    redis: Redis = Depends(get_redis)
):
    """Xác nhận mã OTP đã gửi về email (hỗ trợ cả Query và JSON Body)"""
    target_email = email
    target_otp = otp
    target_reason = reason
    if not target_email or not target_otp:
        try:
            body = await request.json()
            target_email = target_email or body.get("email")
            target_otp = target_otp or body.get("otp")
            target_reason = body.get("reason") or reason
        except Exception:
            pass
    verified_token = await auth_service.verify_otp_email(
        email=target_email, reason=target_reason, otp=target_otp, redis=redis
    )
    return ApiResponse(
        message="Xác thực OTP thành công",
        data=OTPVerifyData(verified_token=verified_token)
    )
