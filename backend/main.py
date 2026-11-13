import asyncio
from pathlib import Path
from datetime import datetime, date
from app.core.time import local_now, BUSINESS_TZ
from app.services.task_service import task_service
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
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
from app.services.event_reminder_service import event_reminder_service

from app.api.v1.api import api_router


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
                now = local_now()
                today = now.date()

                # 1. Lấy các task chưa hoàn thành có due_date
                stmt = select(Task, User).join(User, Task.user_id == User.id).where(
                    Task.is_completed == False,
                    Task.due_date.isnot(None)
                )
                rows = (await session.execute(stmt)).all()
                await task_service.evaluate_auto_complete(session, [task for task, _ in rows])
                # Catch-up may have inserted a current/future successor; reminders use fresh rows.
                rows = (await session.execute(stmt)).all()
                changed = False

                for task, user in rows:
                    # Kiểm tra gửi email thông báo nhắc lịch hôm nay
                    if (
                        task.due_date == today
                        and not getattr(task, "reminder_sent", False)
                        and getattr(user, "notify_enabled", True)
                    ):
                        start_t = task.start_time or task.due_time
                        if start_t:
                            target_dt = datetime.combine(today, start_t, BUSINESS_TZ)
                            diff_minutes = (target_dt - now).total_seconds() / 60.0
                            remind_mins = task.reminder_minutes if task.reminder_minutes is not None else user.notify_minutes_before
                            if -5.0 <= diff_minutes <= float(remind_mins):
                                time_str = f"{start_t.strftime('%H:%M')} hôm nay ({today.strftime('%d/%m/%Y')})"
                                if task.end_time:
                                    time_str = f"{start_t.strftime('%H:%M')} - {task.end_time.strftime('%H:%M')} ({today.strftime('%d/%m/%Y')})"
                                sent_ok = await send_reminder_email(
                                    to_email=user.email,
                                    user_name=user.nickname,
                                    task_title=task.title,
                                    time_display=time_str,
                                    note=task.note or "",
                                    location=getattr(task, "location", "") or "",
                                    minutes_before=max(0, int(round(diff_minutes)))
                                )
                                task.reminder_sent = bool(sent_ok)
                                changed = bool(sent_ok) or changed

                if changed:
                    await session.commit()
            async with AsyncSessionLocal() as session:
                user_ids = (await session.execute(select(User.id).where(
                    User.notify_enabled.is_(True), User.is_activate.is_(True)
                ))).scalars().all()
            for user_id in user_ids:
                try:
                    async with AsyncSessionLocal() as session:
                        await event_reminder_service.send_due(session, user_id)
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.warning("Event reminder check failed for user id=%s", user_id)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.debug(f"Background scheduler tick: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_security()
    await redis_client.connect()
    async with AsyncSessionLocal() as session:
        # No startup DDL: migrations must supply the schema or startup fails visibly.
        await session.execute(select(User).limit(1))
        await session.execute(select(Task).limit(1))
        await create_admin_user(session)
    bg_task = asyncio.create_task(background_scheduler_loop()) if settings.SCHEDULER_ENABLED else None
    try:
        yield
    finally:
        if bg_task:
            bg_task.cancel()
            await bg_task
        await redis_client.close()


app = FastAPI(title=settings.PROJECT_NAME,
              version="2.0.0",
              lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.add_exception_handler(CustomAppException, global_app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if (FRONTEND_DIR / "index.html").is_file():
    for directory in ("css", "js", "assets"):
        app.mount(f"/{directory}", StaticFiles(directory=FRONTEND_DIR / directory), name=directory)

@app.get("/", tags=["Root"])
def read_root():
    if (FRONTEND_DIR / "index.html").is_file():
        return FileResponse(FRONTEND_DIR / "index.html", headers={"Cache-Control": "no-store"})
    return {"success": f"Welcome to {settings.PROJECT_NAME} API!"}

@app.get("/health", tags=["Health"])
async def health_check():
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        if not redis_client.redis:
            raise RuntimeError("Redis unavailable")
        await redis_client.redis.ping()
    except Exception:
        raise HTTPException(503, "Dependencies not ready.")
    return {"status": "healthy"}
