from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List
from app.core.exceptions import ErrorDetail
from app.schemas.validation import InputValidation

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase, InputValidation):
    nickname: str
    password: str
    theme_preference: Optional[str] = "light"
    timezone: Optional[str] = "Asia/Ho_Chi_Minh"
    notify_enabled: Optional[bool] = True
    notify_minutes_before: int = Field(15, ge=0, le=10080)
    otp: Optional[str] = None
    verified_token: Optional[str] = None

class UserUpdate(InputValidation):
    nickname: Optional[str] = None
    theme_preference: Optional[str] = None
    timezone: Optional[str] = None
    notify_enabled: Optional[bool] = None
    notify_minutes_before: Optional[int] = Field(None, ge=0, le=10080)

class PasswordChange(InputValidation):
    current_password: str
    new_password: str

class ForgotPasswordReset(InputValidation):
    email: EmailStr
    new_password: str
    otp: Optional[str] = None
    verified_token: Optional[str] = None

class UserResponse(UserBase):
    id: int
    nickname: str
    is_activate: Optional[bool] = True
    is_developer: Optional[bool] = False
    theme_preference: Optional[str] = "light"
    timezone: Optional[str] = "Asia/Ho_Chi_Minh"
    notify_enabled: Optional[bool] = True
    notify_minutes_before: Optional[int] = 15
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserListResponse(BaseModel):
    page: int
    limit: int
    items: List[UserResponse]

    class Config:
        from_attributes = True

class UserErrors:
    EMAIL_ALREADY_EXISTS = ErrorDetail("EMAIL_ALREADY_EXISTS", 400, "Email này đã tồn tại.")
    USER_NOT_FOUND = ErrorDetail("USER_NOT_FOUND", 404, "Không tìm thấy người dùng này.")
    INVALID_CURRENT_PASSWORD = ErrorDetail("INVALID_CURRENT_PASSWORD", 400, "Mật khẩu hiện tại không đúng.")
