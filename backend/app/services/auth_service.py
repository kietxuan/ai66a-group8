import json
import secrets

from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from fastapi.security import OAuth2PasswordRequestForm

from app.crud.user_crud import user_crud
from app.core.security import verify_password, create_access_token, hash_password
from app.schemas.token_schema import AuthErrors
from app.schemas.user_schema import UserErrors, ForgotPasswordReset
from app.schemas.otp_schema import OTPErrors
from app.helper.otp import send_email, verify_action_token

class AuthService:
    async def authenticate_by_credentials(self, db: AsyncSession, email: str, password: str) -> dict:
        """Nghiệp vụ xác thực thông tin đăng nhập và cấp Token bằng email & password"""
        if not email or not password:
            raise AuthErrors.INVALID_LOGIN.throw()

        user = await user_crud.get_by_email(db, email=email)

        if not user or not user.is_activate or not await verify_password(password, user.password_hashed):
            raise AuthErrors.INVALID_LOGIN.throw()

        access_token = create_access_token(subject=user.id, is_developer=user.is_developer)
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

        if redis is not None:
            try:
                await redis.set(f"otp:{norm_reason}:{email}", payload, ex=300)
            except Exception:
                pass
        await send_email(email=email, otp=code, reason=norm_reason)
        return code

    async def verify_otp_email(self, email: str, reason: str, otp: str, redis: Redis) -> str:
        """Nghiệp vụ xác minh mã OTP"""
        norm_reason = "change-password" if reason in ("change-password", "reset-password", "forgot-password") else "verify-email"
        redis_key = f"otp:{norm_reason}:{email}"

        otp_data = await redis.get(redis_key)

        if not otp_data:
            raise OTPErrors.OTP_EXPIRED.throw()

        otp_data = json.loads(otp_data)

        if otp_data.get("attempts", 0) >= 5:
            await redis.delete(redis_key)
            raise OTPErrors.OTP_LIMIT_EXCEEDED.throw()

        if str(otp_data["code"]).strip() != str(otp).strip():
            otp_data["attempts"] = otp_data.get("attempts", 0) + 1
            remain = 5 - otp_data["attempts"]
            await redis.set(redis_key, json.dumps(otp_data), ex=300)
            raise OTPErrors.OTP_INVALID.throw(dynamic_message=f"Mã OTP không chính xác. Bạn còn {remain} lần thử.")

        verification_token = secrets.token_hex(16)

        await redis.set(f"verified-token:{norm_reason}:{email}", verification_token, ex=600)
        await redis.delete(redis_key)

        return verification_token

    async def reset_password_with_otp(self, db: AsyncSession, redis: Redis, payload: ForgotPasswordReset) -> None:
        """Đặt lại mật khẩu sau khi xác thực OTP hoặc verified_token"""
        user = await user_crud.get_by_email(db, email=payload.email)
        if not user:
            raise UserErrors.USER_NOT_FOUND.throw()

        norm_reason = "change-password"
        if payload.verified_token:
            await verify_action_token(payload.email, norm_reason, payload.verified_token, redis)
        elif payload.otp:
            await self.verify_otp_email(payload.email, norm_reason, payload.otp, redis)
        else:
            raise OTPErrors.OTP_EXPIRED.throw()

        hashed_pwd = await hash_password(payload.new_password)
        await user_crud.update_password(db, user=user, hashed_password=hashed_pwd)


auth_service = AuthService()
