from app.core.time import business_today, local_now, BUSINESS_TZ
from datetime import datetime, date, time, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user_model import User
from app.models.task_model import Task
from app.models.event_model import Event
from app.schemas.dashboard_schema import (
    DashboardTodayResponse,
    DashboardStatsResponse,
    DashboardSummaryMetrics,
    DailyTrendItem,
    ListStatItem,
)
from app.services.event_service import event_service
from app.services.task_service import task_service
from app.services.task_list_service import task_list_service
from app.services.recurrence import expand_event_rows, is_task_overdue

router = APIRouter()

VI_SHORT_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

@router.get("/today", response_model=DashboardTodayResponse)
async def get_today_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy thông tin tổng hợp lịch và công việc trong ngày hôm nay"""
    today = business_today()
    start_of_day = datetime.combine(today, time.min, BUSINESS_TZ)
    end_of_day = datetime.combine(today + timedelta(days=1), time.min, BUSINESS_TZ)

    events_today = await event_service.get_events_in_range(
        db, user_id=current_user.id, start_at=start_of_day, end_at=end_of_day
    )
    events_today = expand_event_rows(events_today, start_of_day, end_of_day)
    tasks_my_day = await task_service.get_tasks(
        db, user_id=current_user.id, view="my_day"
    )

    overdue_tasks = await task_service.get_tasks(db, user_id=current_user.id, view="overdue")
    overdue_count = len(overdue_tasks)

    due_today_stmt = select(func.count(Task.id)).where(
        Task.user_id == current_user.id,
        Task.is_completed == False,
        Task.due_date == today
    )
    due_today_count = (await db.execute(due_today_stmt)).scalar() or 0

    completed_today_stmt = select(func.count(Task.id)).where(
        Task.user_id == current_user.id,
        Task.is_completed == True,
        Task.completed_at >= start_of_day,
        Task.completed_at < end_of_day
    )
    completed_today_count = (await db.execute(completed_today_stmt)).scalar() or 0

    return DashboardTodayResponse(
        date=today,
        events_today=events_today,
        events_count=len(events_today),
        tasks_my_day=tasks_my_day,
        tasks_overdue_count=overdue_count,
        tasks_due_today_count=due_today_count,
        tasks_completed_today_count=completed_today_count
    )


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy toàn bộ dữ liệu biểu đồ thống kê và phân tích năng suất cho trang Dashboard"""
    today = business_today()
    start_of_day = datetime.combine(today, time.min)
    end_of_day = datetime.combine(today, time.max)

    # 1. All user tasks
    all_tasks = await task_service.get_tasks(db, user_id=current_user.id, view="all")
    total_tasks = len(all_tasks)
    completed_tasks = sum(1 for t in all_tasks if t.is_completed)
    pending_tasks = total_tasks - completed_tasks
    completion_rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

    important_tasks = [t for t in all_tasks if t.is_important and not t.is_completed]
    my_day_all = [t for t in all_tasks if t.is_in_my_day]
    my_day_completed = sum(1 for t in my_day_all if t.is_completed)
    now = local_now()
    overdue_tasks = [t for t in all_tasks if is_task_overdue(t, now)]
    due_today_tasks = [t for t in all_tasks if not t.is_completed and t.due_date == today]
    today_pending = [t for t in due_today_tasks if not is_task_overdue(t, now)]
    time_blocked_tasks = [t for t in all_tasks if not t.is_completed and not t.is_all_day and t.start_time]

    completed_today_count = 0
    for t in all_tasks:
        if t.is_completed and t.completed_at:
            comp_date = t.completed_at.astimezone(BUSINESS_TZ).date() if isinstance(t.completed_at, datetime) else today
            if comp_date == today:
                completed_today_count += 1

    # Status breakdown for Donut Chart
    scheduled_pending = sum(
        1 for t in all_tasks
        if not t.is_completed and t.due_date and t.due_date != today and not is_task_overdue(t, now)
    )
    unscheduled_pending = sum(
        1 for t in all_tasks
        if not t.is_completed and not t.due_date
    )
    in_my_day_pending = len(today_pending)

    status_breakdown = {
        "completed": completed_tasks,
        "in_my_day": in_my_day_pending,
        "overdue": len(overdue_tasks),
        "scheduled": scheduled_pending,
        "unscheduled": unscheduled_pending
    }

    # 2. Events in 7-day window (past 3 days + today + next 3 days, plus upcoming 7 days)
    trend_start_date = today - timedelta(days=6)
    upcoming_end_date = today + timedelta(days=7)

    events_window = await event_service.get_events_in_range(
        db,
        user_id=current_user.id,
        start_at=datetime.combine(trend_start_date, time.min),
        end_at=datetime.combine(upcoming_end_date, time.max)
    )
    active_events = expand_event_rows(events_window, datetime.combine(trend_start_date, time.min, BUSINESS_TZ), datetime.combine(upcoming_end_date + timedelta(days=1), time.min, BUSINESS_TZ))

    events_today = [
        e for e in active_events
        if e.start_at < datetime.combine(today + timedelta(days=1), time.min, BUSINESS_TZ) and e.end_at > datetime.combine(today, time.min, BUSINESS_TZ)
    ]
    upcoming_events = [
        e for e in active_events
        if today <= e.start_at.date() <= upcoming_end_date
    ][:15]

    busy_hours_today = 0.0
    for e in events_today:
        if not e.is_all_day:
            dur = max(0.0, (min(e.end_at, datetime.combine(today + timedelta(days=1), time.min, BUSINESS_TZ)) - max(e.start_at, datetime.combine(today, time.min, BUSINESS_TZ))).total_seconds() / 3600.0)
            busy_hours_today += dur
    for t in all_tasks:
        if t.due_date == today and not t.is_all_day and t.start_time:
            busy_hours_today += (t.duration_minutes or 60) / 60.0
    busy_hours_today = round(busy_hours_today, 1)

    # 3. 7-day trend (last 7 days including today)
    weekly_trend = []
    for offset in range(6, -1, -1):
        d = today - timedelta(days=offset)
        wd_label = VI_SHORT_DAYS[d.weekday()]
        date_label = f"{wd_label} ({d.strftime('%d/%m')})"

        comp_cnt = sum(
            1 for t in all_tasks
            if t.is_completed and t.completed_at and t.completed_at.astimezone(BUSINESS_TZ).date() == d
        )
        due_cnt = sum(1 for t in all_tasks if t.due_date == d)
        if d == today:
            overdue_cnt = len(overdue_tasks)
        else:
            overdue_cnt = sum(
                1 for t in all_tasks
                if t.due_date == d and (
                    (not t.is_completed) or 
                    (t.completed_at and t.completed_at.astimezone(BUSINESS_TZ).date() > d)
                )
            )
        ev_day = [e for e in active_events if e.start_at.date() == d]
        ev_cnt = len(ev_day)

        day_hours = 0.0
        for e in ev_day:
            if not e.is_all_day:
                day_hours += max(0.0, (e.end_at - e.start_at).total_seconds() / 3600.0)
        for t in all_tasks:
            if t.due_date == d and not t.is_all_day and t.start_time:
                day_hours += (t.duration_minutes or 60) / 60.0

        weekly_trend.append(DailyTrendItem(
            date=d.isoformat(),
            label=date_label,
            completed_tasks=comp_cnt,
            due_tasks=due_cnt,
            overdue_tasks=overdue_cnt,
            events_count=ev_cnt,
            busy_hours=round(day_hours, 1)
        ))

    # 4. Task Lists breakdown
    raw_lists = await task_list_service.get_task_lists(db, user_id=current_user.id)
    list_breakdown = []
    for lst in raw_lists:
        tot = lst.get("task_count", 0) or 0
        comp = lst.get("completed_count", 0) or 0
        pend = max(0, tot - comp)
        rate = round((comp / tot * 100), 1) if tot > 0 else 0.0
        list_breakdown.append(ListStatItem(
            id=lst["id"],
            name=lst["name"],
            icon=lst.get("icon") or "📝",
            color=lst.get("color") or "#4285F4",
            total=tot,
            completed=comp,
            pending=pend,
            completion_rate=rate
        ))

    # 5. Calculate Productivity Score (0 - 100)
    base_score = completion_rate * 0.6
    my_day_ratio = (my_day_completed / len(my_day_all) * 25) if len(my_day_all) > 0 else 15.0
    overdue_penalty = min(20.0, len(overdue_tasks) * 4.0)
    activity_bonus = min(15.0, (completed_today_count * 5.0) + (len(events_today) * 2.5))
    productivity_score = int(max(10, min(100, round(base_score + my_day_ratio + activity_bonus - overdue_penalty))))
    if total_tasks == 0 and len(active_events) == 0:
        productivity_score = None  # No activity yet; do not present a fabricated score.

    summary = DashboardSummaryMetrics(
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        pending_tasks=pending_tasks,
        completion_rate=completion_rate,
        important_pending_count=len(important_tasks),
        my_day_total=len(my_day_all),
        my_day_completed=my_day_completed,
        overdue_count=len(overdue_tasks),
        due_today_count=len(due_today_tasks),
        completed_today_count=completed_today_count,
        time_blocked_count=len(time_blocked_tasks),
        events_today_count=len(events_today),
        events_week_count=len(upcoming_events),
        busy_hours_today=busy_hours_today,
        productivity_score=productivity_score
    )

    return DashboardStatsResponse(
        date=today,
        summary=summary,
        status_breakdown=status_breakdown,
        weekly_trend=weekly_trend,
        list_breakdown=list_breakdown,
        events_today=events_today,
        upcoming_events=upcoming_events,
        tasks_my_day=today_pending[:10],
        tasks_important=important_tasks[:10],
        tasks_overdue=overdue_tasks[:10],
        tasks_todo=[t for t in all_tasks if not t.is_completed and t.due_date != today and not is_task_overdue(t, now)][:10]
    )
