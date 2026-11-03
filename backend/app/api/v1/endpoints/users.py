from app.core.time import business_today, local_now, BUSINESS_TZ
from datetime import datetime, date
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.user_schema import UserCreate, UserUpdate, PasswordChange, UserResponse, UserListResponse
from app.services.user_service import user_service
from app.services.task_service import task_service
from app.api.deps import get_current_user, get_current_developer
from app.core.redis import get_redis
from app.models.user_model import User
from app.helper.otp import send_reminder_email

router = APIRouter()

@router.post("/register", response_model=ApiResponse[UserResponse], status_code=status.HTTP_201_CREATED)
async def register_user(
    user_in: UserCreate, 
    db: AsyncSession = Depends(get_db),
    redis = Depends(get_redis)
):
    """Đăng ký người dùng mới"""
    user = await user_service.register_new_user(db, user_in=user_in, redis=redis)
    return ApiResponse(
        message="Đăng ký tài khoản thành công",
        data=user
    )

@router.get("", response_model=ApiResponse[UserListResponse], status_code=status.HTTP_200_OK)
async def get_all_users(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_developer)
):
    """API xem toàn bộ người dùng"""
    users = await user_service.get_all_users(page=page, limit=limit, current_user=current_user, db=db)
    return ApiResponse(
        message="Lấy thông tin của toàn bộ người dùng thành công",
        data=UserListResponse(
            page=page,
            limit=limit,
            items=users
        )
    )

@router.get("/me", response_model=ApiResponse[UserResponse], status_code=status.HTTP_200_OK)
async def read_user_me(
    current_user: User = Depends(get_current_user)
):
    """Thông tin cá nhân"""
    return ApiResponse(
        message="Lấy thông tin cá nhân thành công",
        data=current_user
    )

@router.put("/me", response_model=ApiResponse[UserResponse], status_code=status.HTTP_200_OK)
async def update_user_me(
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    redis = Depends(get_redis),
    current_user: User = Depends(get_current_user)
):
    """Cập nhật thông tin cá nhân (nickname, theme_preference, timezone, notify_enabled, notify_minutes_before, email)"""
    updated_user = await user_service.update_profile(db, current_user=current_user, user_in=user_in, redis=redis)
    return ApiResponse(
        message="Cập nhật thông tin thành công",
        data=updated_user
    )

@router.put("/me/password", response_model=ApiResponse[None], status_code=status.HTTP_200_OK)
async def change_password(
    password_in: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Đổi mật khẩu người dùng"""
    await user_service.change_password(db, current_user=current_user, password_in=password_in)
    return ApiResponse(
        message="Đổi mật khẩu thành công",
        data=None
    )


@router.post("/me/check-reminders")
async def check_and_send_reminders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Kiểm tra các công việc / sự kiện sắp tới hạn trong ngày hôm nay và gửi Email thông báo
    nếu người dùng bật thông báo (notify_enabled=True).
    """
    notify_enabled = getattr(current_user, "notify_enabled", True)
    notify_minutes = current_user.notify_minutes_before

    today = business_today()
    now = local_now()
    all_tasks = await task_service.get_tasks(db, user_id=current_user.id, view="all")

    triggered = []
    if not notify_enabled:
        return {"notify_enabled": False, "triggered": []}

    for t in all_tasks:
        if t.is_completed or getattr(t, "reminder_sent", False):
            continue
        if t.due_date != today:
            continue

        start_t = t.start_time or t.due_time
        if not start_t:
            continue

        target_dt = datetime.combine(today, start_t, BUSINESS_TZ)
        diff_minutes = (target_dt - now).total_seconds() / 60.0
        item_remind_mins = t.reminder_minutes if t.reminder_minutes is not None else notify_minutes

        # Nếu nằm trong khoảng sắp bắt đầu (từ -5 phút đến item_remind_mins phút trước giờ bắt đầu)
        if -5.0 <= diff_minutes <= float(item_remind_mins):
            time_str = f"{start_t.strftime('%H:%M')} hôm nay ({today.strftime('%d/%m/%Y')})"
            if t.end_time:
                time_str = f"{start_t.strftime('%H:%M')} - {t.end_time.strftime('%H:%M')} ({today.strftime('%d/%m/%Y')})"

            sent_ok = await send_reminder_email(
                to_email=current_user.email,
                user_name=current_user.nickname,
                task_title=t.title,
                time_display=time_str,
                note=t.note or "",
                location=getattr(t, "location", "") or "",
                minutes_before=max(0, int(round(diff_minutes)))
            )
            t.reminder_sent = bool(sent_ok)
            triggered.append({
                "id": t.id,
                "title": t.title,
                "time_display": time_str,
                "minutes_left": max(0, int(round(diff_minutes))),
                "email_sent": sent_ok
            })

    if triggered:
        await db.commit()

    return {
        "notify_enabled": notify_enabled,
        "notify_minutes_before": notify_minutes,
        "triggered": triggered
    }


@router.post("/me/test-reminder")
async def send_test_reminder_email(
    current_user: User = Depends(get_current_user)
):
    """Gửi thử một email nhắc lịch đến địa chỉ email của người dùng hiện tại"""
    now_str = datetime.now().strftime("%H:%M ngày %d/%m/%Y")
    mins = current_user.notify_minutes_before
    sent_ok = await send_reminder_email(
        to_email=current_user.email,
        user_name=current_user.nickname,
        task_title="Kiểm thử thông báo nhắc lịch tự động Planify Pro",
        time_display=now_str,
        note="Hệ thống thông báo qua Email & Trình duyệt đã hoạt động ổn định.",
        location="Planify Pro Workspace",
        minutes_before=mins
    )
    return {
        "success": bool(sent_ok),
        "email_sent": sent_ok,
        "email": current_user.email,
        "message": f"Đã gửi thông báo thử nghiệm tới {current_user.email}" if sent_ok else f"Đã kích hoạt thông báo (kiểm tra tài khoản ADMIN trong .env cho {current_user.email})"
    }
