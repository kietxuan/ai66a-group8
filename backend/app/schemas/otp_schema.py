from pydantic import BaseModel
from app.core.exceptions import ErrorDetail

class OTPVerifyData(BaseModel):
    verified_token: str

class OTPErrors:
    OTP_EXPIRED = ErrorDetail("OTP_EXPIRED", 400, "Mã OTP đã hết hạn hoặc không tồn tại.")
    OTP_INVALID = ErrorDetail("OTP_INVALID", 400, "Mã OTP không chính xác.")
    OTP_LIMIT_EXCEEDED = ErrorDetail("OTP_LIMIT_EXCEEDED", 400, "Mã OTP nhập vượt quá số lần cho phép. Vui lòng lấy mã mới.")
    EMAIL_SEND_FAILED = ErrorDetail("EMAIL_SEND_FAILED", 500, "Không thể gửi email OTP. Vui lòng thử lại sau.")

