from pydantic import BaseModel
from app.core.exceptions import ErrorDetail

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: str | None = None

class AuthErrors:
    INVALID_LOGIN = ErrorDetail("INVALID_LOGIN", 401, "Email hoặc mật khẩu không chính xác.")
    NOT_DEVELOPER = ErrorDetail("NOT_DEVELOPER", 403, "Bạn không có quyền truy cập tài nguyên này.")
    UNAUTHORIZED = ErrorDetail("UNAUTHORIZED", 401, "Phiên đăng nhập hết hạn hoặc không hợp lệ.")
