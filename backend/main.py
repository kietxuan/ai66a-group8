import asyncio
from datetime import datetime, date
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from admin import create_admin_user
from contextlib import asynccontextmanager
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text, select

from app.core.config import settings
from app.core.exceptions import (
    CustomAppException,
    global_app_exception_handler,
    validation_exception_handler,
    http_exception_handler,
    unhandled_exception_handler,
)
from app.core.logger import logger
from app.core.database import AsyncSessionLocal
from app.core.redis import redis_client
from app.models.user_model import User
from app.models.task_model import Task
from app.helper.otp import send_reminder_email

from app.api.v1.api import api_router


async def ensure_schema_columns(session):
    """Tự động bổ sung các cột mới vào cơ sở dữ liệu nếu chưa có (an toàn tuyệt đối khi nâng cấp)"""
    alter_statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN NOT NULL DEFAULT TRUE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_minutes_before INTEGER NOT NULL DEFAULT 15;",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location VARCHAR(300);",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS auto_complete BOOLEAN NOT NULL DEFAULT FALSE;",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER DEFAULT 15;",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;",
    ]
    for stmt in alter_statements:
        try:
            await session.execute(text(stmt))
        except Exception as e:
            logger.debug(f"Schema check ({stmt}): {e}")
    try:
        await session.commit()
    except Exception:
        await session.rollback()


async def background_scheduler_loop():
    """
    Vòng lặp chạy ngầm mỗi 45 giây:
    1. Tự động đánh dấu hoàn thành (is_completed=True) cho các Sự kiện (auto_complete=True) đã hết giờ.
    2. Tự động gửi Email thông báo nhắc lịch khi công việc/sự kiện sắp diễn ra theo cài đặt của người dùng.
    """
    while True:
        try:
            await asyncio.sleep(45)
            async with AsyncSessionLocal() as session:
                now = datetime.now()
                today = now.date()
                current_time = now.time()

                # 1. Lấy các task chưa hoàn thành có due_date
                stmt = select(Task, User).join(User, Task.user_id == User.id).where(
                    Task.is_completed == False,
                    Task.due_date.isnot(None)
                )
                rows = (await session.execute(stmt)).all()
                changed = False

                for task, user in rows:
                    # Kiểm tra tự động hoàn thành cho Sự kiện (auto_complete=True)
                    if getattr(task, "auto_complete", False):
                        should_complete = False
                        if task.due_date < today:
                            should_complete = True
                        elif task.due_date == today and not task.is_all_day:
                            end_t = task.end_time or task.due_time or task.start_time
                            if end_t and end_t <= current_time:
                                should_complete = True
                        if should_complete:
                            task.is_completed = True
                            task.completed_at = now
                            changed = True
                            continue

                    # Kiểm tra gửi email thông báo nhắc lịch hôm nay
                    if (
                        task.due_date == today
                        and not getattr(task, "reminder_sent", False)
                        and getattr(user, "notify_enabled", True)
                    ):
                        start_t = task.start_time or task.due_time
                        if start_t:
                            target_dt = datetime.combine(today, start_t)
                            diff_minutes = (target_dt - now).total_seconds() / 60.0
                            remind_mins = getattr(task, "reminder_minutes", None) or getattr(user, "notify_minutes_before", 15) or 15
                            if -5.0 <= diff_minutes <= float(remind_mins):
                                time_str = f"{start_t.strftime('%H:%M')} hôm nay ({today.strftime('%d/%m/%Y')})"
                                if task.end_time:
                                    time_str = f"{start_t.strftime('%H:%M')} - {task.end_time.strftime('%H:%M')} ({today.strftime('%d/%m/%Y')})"
                                await send_reminder_email(
                                    to_email=user.email,
                                    user_name=user.nickname,
                                    task_title=task.title,
                                    time_display=time_str,
                                    note=task.note or "",
                                    location=getattr(task, "location", "") or "",
                                    minutes_before=max(0, int(round(diff_minutes)))
                                )
                                task.reminder_sent = True
                                changed = True

                if changed:
                    await session.commit()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.debug(f"Background scheduler tick: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await redis_client.connect()
    except Exception as e:
        logger.error(f"Không thể kết nối tới Redis lúc khởi chạy: {e}")

    async with AsyncSessionLocal() as session:
        try:
            await ensure_schema_columns(session)
            await create_admin_user(session)
        except Exception as e:
            logger.error(f"Lỗi khởi tạo ban đầu: {e}")

    bg_task = asyncio.create_task(background_scheduler_loop())
    yield
    bg_task.cancel()
    await redis_client.close()


app = FastAPI(title=settings.PROJECT_NAME,
              version="2.0.0",
              lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.add_exception_handler(CustomAppException, global_app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

@app.get("/", tags=["Root"])
def read_root():
    return {"success": f"Welcome to {settings.PROJECT_NAME} API!"}

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
