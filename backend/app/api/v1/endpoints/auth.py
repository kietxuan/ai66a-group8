from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.core.database import get_db
from app.core.redis import get_redis
from app.schemas.token_schema import Token
from app.schemas.user_schema import UserCreate, UserResponse, ForgotPasswordReset
from app.schemas.common import ApiResponse
from app.services.auth_service import auth_service
from app.services.user_service import user_service
from app.helper.otp import verify_action_token

router = APIRouter()


@router.post("/login", response_model=Token)
async def login_access_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    """
    Đăng nhập và nhận về Access Token.
    Hỗ trợ cả application/json ({email, password}) lẫn application/x-www-form-urlencoded (OAuth2 form).
    """
    content_type = request.headers.get("content-type", "")
    from app.core.rate_limit import enforce_limit
    await enforce_limit(redis, f"login:{request.client.host if request.client else 'unknown'}", 30, 60)
    if "application/json" in content_type:
        from fastapi import HTTPException
        try:
            body = await request.json()
        except ValueError:
            raise HTTPException(400, "JSON không hợp lệ.")
        if not isinstance(body, dict):
            raise HTTPException(422, "Cần object email và password.")
        email = body.get("email") or body.get("username")
        password = body.get("password")
    else:
        form = await request.form()
        email = form.get("username") or form.get("email")
        password = form.get("password")

    return await auth_service.authenticate_by_credentials(db, email=email, password=password)


@router.post("/register", response_model=ApiResponse[UserResponse], status_code=status.HTTP_201_CREATED)
async def register_user_via_auth(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    """Đăng ký người dùng mới (hỗ trợ xác thực OTP hoặc verified_token)"""
    user = await user_service.register_new_user(db, user_in=user_in, redis=redis)
    return ApiResponse(
        message="Đăng ký tài khoản thành công",
        data=user
    )


@router.post("/reset-password", response_model=ApiResponse[None])
@router.post("/forgot-password", response_model=ApiResponse[None])
async def reset_password_via_otp(
    payload: ForgotPasswordReset,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    """Đặt lại mật khẩu bằng mã OTP gửi về email"""
    await auth_service.reset_password_with_otp(db=db, redis=redis, payload=payload)
    return ApiResponse(
        message="Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.",
        data=None
    )
