from datetime import datetime, timedelta, timezone
import asyncio

import bcrypt
import jwt
from fastapi import Request, Response
from passlib.context import CryptContext

from app.core.config import get_settings
from app.core.errors import AppError, error_response


password_context = CryptContext(
    schemes=["bcrypt"],
    bcrypt__rounds=12,
    bcrypt__ident="2b",
    bcrypt__truncate_error=True,
)


def _password_bytes(password):
    if not isinstance(password, str):
        raise TypeError("Password must be a string")
    encoded = password.encode("utf-8")
    if len(encoded) > 72:
        raise ValueError("Password exceeds bcrypt's 72-byte UTF-8 limit")
    return encoded


def hash_password(password):
    encoded = _password_bytes(password)
    if "\x00" in password:
        # Passlib rejects NUL; pyca/bcrypt 4.3.0 and our previous API allow it.
        # Preserve that narrow case without altering or pre-hashing passwords.
        return bcrypt.hashpw(encoded, bcrypt.gensalt(rounds=12)).decode("ascii")
    return password_context.hash(password)


def verify_password(password, hashed):
    try:
        encoded = _password_bytes(password)
        if not isinstance(hashed, str):
            return False
        if "\x00" in password:
            return bcrypt.checkpw(encoded, hashed.encode("ascii"))
        return password_context.verify(password, hashed)
    except (ValueError, UnicodeError, TypeError):
        return False


def set_cookie(response: Response, user_id):
    settings = get_settings()
    now = datetime.now(timezone.utc)
    token = jwt.encode({"sub": str(user_id), "iat": now,
                        "exp": now + timedelta(minutes=settings.jwt_expire_minutes)},
                       settings.jwt_secret_key, algorithm="HS256")
    response.set_cookie("access_token", token, max_age=settings.jwt_expire_minutes * 60,
                        httponly=True, secure=settings.cookie_secure, samesite="lax", path="/")


def clear_cookie(response: Response):
    response.delete_cookie("access_token", path="/", httponly=True,
                           secure=get_settings().cookie_secure, samesite="lax")


def token_user_id(request: Request):
    try:
        payload = jwt.decode(request.cookies.get("access_token", ""), get_settings().jwt_secret_key,
                             algorithms=["HS256"], options={"require": ["sub", "iat", "exp"]})
        user_id = int(payload["sub"])
        if user_id <= 0:
            raise ValueError()
        return user_id
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise AppError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại") from None


async def write_guard(request: Request, call_next):
    if (request.url.path == "/api" or request.url.path.startswith("/api/")) and request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if (request.headers.get("x-requested-with") != "todo-app"
                or (origin is not None and origin not in get_settings().origins)):
            return error_response(403, "CSRF_REJECTED", "Yêu cầu ghi không hợp lệ")
        limit = get_settings().max_request_bytes
        length = request.headers.get("content-length")
        if length and (not length.isdigit() or int(length) > limit):
            return error_response(413, "PAYLOAD_TOO_LARGE", "Nội dung yêu cầu quá lớn")
        chunks, size = [], 0
        try:
            async with asyncio.timeout(10):
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > limit:
                        return error_response(413, "PAYLOAD_TOO_LARGE", "Nội dung yêu cầu quá lớn")
                    chunks.append(chunk)
        except TimeoutError:
            return error_response(408, "REQUEST_TIMEOUT", "Nội dung gửi lên quá chậm. Hãy kiểm tra dữ liệu trước khi thử lại.")
        body = b"".join(chunks)
        request._body = body  # Cache the bounded body for Starlette's downstream request.
        if body and request.headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
            return error_response(415, "UNSUPPORTED_MEDIA_TYPE", "Body phải là application/json")
    return await call_next(request)
