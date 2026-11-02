import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
TIMEACCESS = settings.ACCESS_TOKEN_EXPIRE_MINUTES

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def hash_password(password: str) -> str:
    """
    Hàm băm mật khẩu
    """
    return await asyncio.to_thread(pwd_context.hash, password)

async def verify_password(input_password: str, hashed_password: str) -> bool:
    """
    Hàm kiểm tra mật khẩu
    """
    return await asyncio.to_thread(pwd_context.verify, input_password, hashed_password)

def create_access_token(subject: Union[str, Any], is_developer: bool) -> str:
    """
    Hàm tạo token access cho jwt khi User đăng nhập thành công
    """
    # Tính toán thời gian hết hạn của mã token
    expire = datetime.now(timezone.utc) + timedelta(minutes=TIMEACCESS)

    # Gói thông tin và Payload
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "dev": is_developer
    }

    # Ký bảo mật và sinh chuỗi token JWT
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
