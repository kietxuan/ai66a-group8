from pydantic import BaseModel
from app.core.exceptions import ErrorDetail

class SystemInfoData(BaseModel):
    app_name: str
    version: str
    developer: str

class DevErrors:
    USER_NOT_FOUND = ErrorDetail("USER_NOT_FOUND", 503, "Không tìm thấy người dùng trong hệ thống")
    DATABASE_ERROR = ErrorDetail("DATABASE_ERROR", 503, "Mất kết nối với cơ sở dữ liệu.")
    REDIS_ERROR = ErrorDetail("REDIS_ERROR", 503, "Mất kết nối với Redis.")
