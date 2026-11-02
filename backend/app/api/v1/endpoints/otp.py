from typing import Literal
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from pydantic import BaseModel, EmailStr, Field
from app.core.database import get_db
from app.core.redis import get_redis
from app.services.auth_service import auth_service
from app.schemas.common import ApiResponse
from app.schemas.otp_schema import OTPVerifyData

router = APIRouter()

class OTPSendRequest(BaseModel):
    email: EmailStr
    reason: Literal["verify-email", "change-password", "reset-password", "forgot-password"] = "verify-email"

class OTPVerifyRequest(OTPSendRequest):
    otp: str = Field(pattern=r"^\d{6}$")

@router.post("/send", response_model=ApiResponse[None])
async def send_otp_email(payload: OTPSendRequest, request: Request, db: AsyncSession = Depends(get_db), redis: Redis = Depends(get_redis)):
    from app.core.rate_limit import enforce_limit
    await enforce_limit(redis, f"otp-ip:{request.client.host if request.client else 'unknown'}", 20, 3600)
    await auth_service.send_otp_email(payload.email, payload.reason, db, redis)
    return ApiResponse(message="Mã OTP đã được gửi.")

@router.post("/verify", response_model=ApiResponse[OTPVerifyData])
async def verify_otp_email(payload: OTPVerifyRequest, redis: Redis = Depends(get_redis)):
    token = await auth_service.verify_otp_email(payload.email, payload.reason, payload.otp, redis)
    return ApiResponse(message="Xác thực OTP thành công", data=OTPVerifyData(verified_token=token))
