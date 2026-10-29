from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from sqlalchemy.exc import SQLAlchemyError


class AppError(Exception):
    def __init__(self, status, code, message, details=None):
        self.status, self.code, self.message = status, code, message
        self.details = details or {}


def error_response(status, code, message, details=None):
    return JSONResponse(status_code=status, content={"error": {
        "code": code, "message": message, "details": details or {},
    }})


def install_handlers(app: FastAPI):
    @app.exception_handler(SQLAlchemyError)
    async def database(request: Request, exc: SQLAlchemyError):
        # Never expose SQL, bound parameters, passwords or connection strings.
        return error_response(503, "DATABASE_UNAVAILABLE", "Cơ sở dữ liệu tạm thời chưa sẵn sàng. Vui lòng thử lại sau.")

    @app.exception_handler(AppError)
    async def business(request: Request, exc: AppError):
        return error_response(exc.status, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def validation(request: Request, exc: RequestValidationError):
        # Do not return raw input: auth payloads include passwords.
        fields = [{"field": ".".join(str(x) for x in e["loc"]), "message": e["msg"]}
                  for e in exc.errors()]
        return error_response(422, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", {"fields": fields})

    @app.exception_handler(HTTPException)
    async def http(request: Request, exc: HTTPException):
        return error_response(exc.status_code, "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR",
                              "Không tìm thấy tài nguyên" if exc.status_code == 404 else "Yêu cầu không hợp lệ")
