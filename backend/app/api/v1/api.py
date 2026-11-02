from fastapi import APIRouter

from app.api.v1.endpoints import (
    users,
    dev,
    otp,
    auth,
    calendars,
    events,
    task_lists,
    tasks,
    task_steps,
    categories,
    dashboard,
    ai_chat
)

api_router = APIRouter()

api_router.include_router(otp.router, prefix="/otp", tags=["OTP"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(calendars.router, prefix="/calendars", tags=["Calendars"])
api_router.include_router(events.router, prefix="/events", tags=["Events"])
api_router.include_router(task_lists.router, prefix="/lists", tags=["Task Lists"])
api_router.include_router(task_lists.router, prefix="/task-lists", tags=["Task Lists"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(task_steps.router, prefix="/tasks", tags=["Task Steps"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(ai_chat.router, prefix="/ai", tags=["AI Agent"])
api_router.include_router(dev.router, prefix="/dev", tags=["Developer"])
