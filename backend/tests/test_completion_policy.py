import asyncio
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.time import BUSINESS_TZ
from app.schemas.task_schema import TaskCreate, TaskUpdate, TaskResponse
from app.schemas.event_schema import EventResponse
from app.services.task_service import TaskService
from app.ai.tool_executor import ToolExecutor


def test_legacy_task_auto_flag_cannot_enable_automatic_completion():
    assert TaskCreate(title='Task', auto_complete=True).auto_complete is False
    assert TaskUpdate(auto_complete=True).model_dump(exclude_unset=True) == {'auto_complete': False}
    response = TaskResponse(title='Task', id=1, user_id=2, list_id=3,
        auto_complete=True, is_completed=False, position=0, created_at=datetime.now(BUSINESS_TZ))
    assert response.auto_complete is False
    assert response.is_completed is False


def test_overdue_legacy_recurring_task_is_never_completed_or_advanced():
    task = SimpleNamespace(id=1, user_id=2, auto_complete=True, is_completed=False,
        is_in_my_day=False, due_date=datetime.now(BUSINESS_TZ).date()-timedelta(days=90),
        recurrence_rule='FREQ=DAILY')
    db = SimpleNamespace(commit=AsyncMock(), execute=AsyncMock())
    service = TaskService()
    service._complete_transition = AsyncMock()
    assert asyncio.run(service.evaluate_daily_state(db, [task])) == [task]
    assert task.is_completed is False
    service._complete_transition.assert_not_awaited()
    db.commit.assert_not_awaited()
    db.execute.assert_not_awaited()


def test_my_day_reset_still_works_without_completing_task(monkeypatch):
    today = datetime.now(BUSINESS_TZ).date()
    task = SimpleNamespace(id=1, user_id=2, auto_complete=True, is_completed=False,
        is_in_my_day=True, my_day_date=today-timedelta(days=1))
    lock = AsyncMock()
    monkeypatch.setattr('app.services.task_service.lock_owner', lock)
    db = SimpleNamespace(commit=AsyncMock(), refresh=AsyncMock())
    asyncio.run(TaskService().evaluate_daily_state(db, [task]))
    assert task.is_in_my_day is False
    assert task.my_day_date is None
    assert task.is_completed is False
    lock.assert_awaited_once_with(db, 2)
    db.commit.assert_awaited_once()


@pytest.mark.parametrize('offset, cancelled, completed', [(-1, False, True), (0, False, True), (1, False, False), (-1, True, False)])
def test_event_completion_tracks_end_of_each_occurrence(monkeypatch, offset, cancelled, completed):
    now = datetime(2026, 11, 14, 10, tzinfo=BUSINESS_TZ)
    monkeypatch.setattr('app.schemas.event_schema.local_now', lambda: now)
    event = EventResponse(id=1, user_id=2, calendar_id=3, title='Event',
        start_at=now-timedelta(hours=1), end_at=now+timedelta(minutes=offset),
        created_at=now, is_cancelled=cancelled, recurrence_rule='FREQ=DAILY')
    assert event.model_dump()['is_completed'] is completed
    tomorrow = event.model_copy(update={'start_at': now+timedelta(days=1), 'end_at': now+timedelta(days=1, hours=1), 'is_cancelled': False})
    assert tomorrow.is_completed is False


def test_ai_does_not_turn_a_requested_event_into_a_task():
    args = {'title': 'Họp', 'start_at': '2026-11-14T09:00:00+07:00', 'end_at': '2026-11-14T10:00:00+07:00'}
    name, _ = ToolExecutor._normalize_creation('create_event', args, 'Tạo sự kiện họp tự động hoàn thành')
    assert name == 'create_event'
    name, converted = ToolExecutor._normalize_creation('create_event', args, 'Tạo lịch học trong ngày')
    assert name == 'create_task'
    assert converted['auto_complete'] is False
