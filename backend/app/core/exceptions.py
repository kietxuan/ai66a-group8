from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.core.logger import logger

class ErrorDetail:
    """Cấu trúc mô tả chi tiết lỗi"""
    def __init__(self, code: str, status_code: int, message: str):
        self.code = code
        self.status_code = status_code
        self.message = message

    def throw(self, dynamic_message: str = None):
        """Ném lỗi nhanh"""
        raise CustomAppException(self, dynamic_message)


class CustomAppException(Exception):
    """Ngoại lệ dùng chung cho toàn bộ dự án"""
    def __init__(self, error_detail: ErrorDetail, dynamic_message: str = None):
        self.code = error_detail.code
        self.status_code = error_detail.status_code
        self.detail = dynamic_message or error_detail.message


# Handlers tự động format JSON trả về cho Frontend
async def global_app_exception_handler(request: Request, exc: CustomAppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.detail
            }
        },
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        loc = " -> ".join(str(l) for l in err["loc"])
        errors.append(f"{loc}: {err['msg']}")
    message = "; ".join(errors)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": message
            }
        }
    )

async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": "HTTP_EXCEPTION",
                "message": exc.detail
            }
        }
    )

async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Lỗi hệ thống chưa được bắt: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "SYSTEM_ERROR",
                "message": "Đã xảy ra lỗi hệ thống nghiêm trọng."
            }
        }
    )
