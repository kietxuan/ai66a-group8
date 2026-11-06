from typing import AsyncGenerator
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.core.db_connection import database_connect_args

# 1. Lấy chuỗi kết nối (Tự động thích ứng Docker hoặc Local)
DATABASE_URL = settings.get_database_url

# 2. Cấu hình Connection Pool tối ưu cho hiệu năng và độ ổn định
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,

    connect_args=database_connect_args(),
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_timeout=30,       # Nếu pool bị đầy, request phải chờ tối đa 30 giây trước khi báo lỗi timeout
    pool_recycle=1800,     # Tự động đóng và giải phóng kết nối sau 30 phút để tránh lỗi Postgres ngắt kết nối idle (treo mạng)
    pool_pre_ping=True,    # Cơ chế "bắt tay trước" - tự động kiểm tra kết nối còn sống không trước khi giao cho app
)

# Tạo Sessions bất đồng bộ
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Tạo lớp cơ sở
class Base(DeclarativeBase):
    pass

# Dependancy cấp kết nối dưới dạng Async Generator cho các API
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
