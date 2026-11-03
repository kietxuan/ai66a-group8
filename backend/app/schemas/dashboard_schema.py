from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import date
from app.schemas.event_schema import EventResponse
from app.schemas.task_schema import TaskResponse

class DashboardTodayResponse(BaseModel):
    date: date
    events_today: List[EventResponse] = []
    events_count: int = 0
    tasks_my_day: List[TaskResponse] = []
    tasks_overdue_count: int = 0
    tasks_due_today_count: int = 0
    tasks_completed_today_count: int = 0

class DailyTrendItem(BaseModel):
    date: str
    label: str
    completed_tasks: int = 0
    due_tasks: int = 0
    events_count: int = 0
    busy_hours: float = 0.0

class ListStatItem(BaseModel):
    id: int
    name: str
    icon: Optional[str] = "📝"
    color: str = "#4285F4"
    total: int = 0
    completed: int = 0
    pending: int = 0
    completion_rate: float = 0.0

class DashboardSummaryMetrics(BaseModel):
    total_tasks: int = 0
    completed_tasks: int = 0
    pending_tasks: int = 0
    completion_rate: float = 0.0
    important_pending_count: int = 0
    my_day_total: int = 0
    my_day_completed: int = 0
    overdue_count: int = 0
    due_today_count: int = 0
    completed_today_count: int = 0
    time_blocked_count: int = 0
    events_today_count: int = 0
    events_week_count: int = 0
    busy_hours_today: float = 0.0
    productivity_score: int = 0

class DashboardStatsResponse(BaseModel):
    date: date
    summary: DashboardSummaryMetrics
    status_breakdown: Dict[str, int]
    weekly_trend: List[DailyTrendItem] = []
    list_breakdown: List[ListStatItem] = []
    events_today: List[EventResponse] = []
    upcoming_events: List[EventResponse] = []
    tasks_my_day: List[TaskResponse] = []
    tasks_important: List[TaskResponse] = []
    tasks_overdue: List[TaskResponse] = []
    tasks_todo: List[TaskResponse] = []
