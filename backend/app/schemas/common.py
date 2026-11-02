from typing import Generic, TypeVar, Optional
from pydantic import BaseModel

T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    """Cấu trúc trả về kết quả chung khi thành công"""
    success: bool = True
    message: Optional[str] = None
    data: Optional[T] = None
