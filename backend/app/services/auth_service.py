import json
import secrets

from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import HTTPException
from redis.exceptions import WatchError

from app.crud.user_crud import user_crud
from app.core.security import verify_password, create_access_token, hash_password
from app.schemas.token_schema import AuthErrors
from app.schemas.user_schema import UserErrors, ForgotPasswordReset
from app.schemas.otp_schema import OTPErrors
from app.helper.otp import send_email, verify_action_token

class AuthService:
    async def authenticate_by_credentials(self, db: AsyncSession, email: str, password: str) -> dict:
        """Nghiệp vụ xác thực thông tin đăng nhập và cấp Token bằng email & password"""
        if not isinstance(email, str) or not isinstance(password, str) or not email or not password:
            raise AuthErrors.INVALID_LOGIN.throw()

        user = await user_crud.get_by_email(db, email=email)

        if not user or not user.is_activate or not await verify_password(password, user.password_hashed):
            raise AuthErrors.INVALID_LOGIN.throw()

        access_token = create_access_token(subject=user.id, is_developer=user.is_developer, token_version=user.token_version)
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "nickname": user.nickname,
                "theme_preference": user.theme_preference,
                "notify_enabled": getattr(user, "notify_enabled", True),
                "notify_minutes_before": getattr(user, "notify_minutes_before", 15),
            }
        }

    async def authenticate_user(self, db: AsyncSession, form_data: OAuth2PasswordRequestForm) -> dict:
        """Nghiệp vụ xác thực thông tin đăng nhập từ OAuth2 Form"""
        return await self.authenticate_by_credentials(db, email=form_data.username, password=form_data.password)

    async def send_otp_email(self, email: str, reason: str, db: AsyncSession, redis: Redis) -> str:
        """Nghiệp vụ gửi mã OTP"""
        existed_user = await user_crud.get_by_email(db, email=email)

        norm_reason = "change-password" if reason in ("change-password", "reset-password", "forgot-password") else "verify-email"

        if norm_reason == "verify-email":
            if existed_user:
                raise UserErrors.EMAIL_ALREADY_EXISTS.throw()
        elif norm_reason == "change-password":
            if not existed_user:
                raise UserErrors.USER_NOT_FOUND.throw()

        code = "".join(secrets.choice("0123456789") for _ in range(6))
        payload = json.dumps({"code": code, "attempts": 0})

        if redis is None:
            raise HTTPException(503, "Dịch vụ xác minh chưa sẵn sàng.")
        # A cooldown and an hourly cap survive successful/failed verification and resends.
        from app.core.rate_limit import enforce_limit
        await enforce_limit(redis, f"otp-send:{email}", 5, 3600)
        if not await redis.set(f"otp-cooldown:{email}", "1", nx=True, ex=60):
            raise HTTPException(429, "Vui lòng đợi 60 giây trước khi gửi lại OTP.")
        await redis.set(f"otp:{norm_reason}:{email}", payload, ex=300)
        if not await send_email(email=email, otp=code, reason=norm_reason):
            await redis.delete(f"otp:{norm_reason}:{email}")
            raise HTTPException(503, "Không gửi được email. Vui lòng kiểm tra tài khoản ADMIN trong file .env.")
        return code

    async def verify_otp_email(self, email: str, reason: str, otp: str, redis: Redis) -> str:
        """Nghiệp vụ xác minh mã OTP"""
        norm_reason = "change-password" if reason in ("change-password", "reset-password", "forgot-password") else "verify-email"
        redis_key = f"otp:{norm_reason}:{email}"

        from app.core.rate_limit import enforce_limit
        await enforce_limit(redis, f"otp-verify:{email}", 10, 600)
        # WATCH prevents simultaneous correct submissions from minting two proofs.
        for _ in range(5):
            async with redis.pipeline() as pipe:
                try:
                    await pipe.watch(redis_key)
                    raw = await pipe.get(redis_key)
                    ttl = await pipe.ttl(redis_key)
                    if not raw or ttl <= 0:
                        raise OTPErrors.OTP_EXPIRED.throw()
                    data = json.loads(raw)
                    valid = secrets.compare_digest(str(data["code"]), str(otp).strip())
                    data["attempts"] = data.get("attempts", 0) + 1
                    token = secrets.token_hex(32)
                    pipe.multi()
                    if valid or data["attempts"] >= 5:
                        pipe.delete(redis_key)
                    else:
                        pipe.set(redis_key, json.dumps(data), ex=ttl)
                    if valid:
                        pipe.set(f"verified-token:{norm_reason}:{email}", token, ex=600)
                    await pipe.execute()
                    if valid:
                        return token
                    if data["attempts"] >= 5:
                        raise OTPErrors.OTP_LIMIT_EXCEEDED.throw()
                    raise OTPErrors.OTP_INVALID.throw()
                except WatchError:
                    continue
        raise HTTPException(409, "OTP đang được xác minh, vui lòng thử lại.")

    async def reset_password_with_otp(self, db: AsyncSession, redis: Redis, payload: ForgotPasswordReset) -> None:
        """Đặt lại mật khẩu sau khi xác thực OTP hoặc verified_token"""
        user = await user_crud.get_by_email(db, email=payload.email)
        if not user:
            raise UserErrors.USER_NOT_FOUND.throw()

        norm_reason = "change-password"
        if payload.verified_token:
            await verify_action_token(payload.email, norm_reason, payload.verified_token, redis)
        elif payload.otp:
            proof = await self.verify_otp_email(payload.email, norm_reason, payload.otp, redis)
            await verify_action_token(payload.email, norm_reason, proof, redis)
        else:
            raise OTPErrors.OTP_EXPIRED.throw()

        hashed_pwd = await hash_password(payload.new_password)
        await user_crud.update_password(db, user=user, hashed_password=hashed_pwd)


auth_service = AuthService()
