import asyncio
from datetime import date, datetime, time, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException

from app.crud.event_crud import event_crud
from app.crud.task_crud import task_crud
from app.services.availability import busy_intervals
from app.services.schedule_conflict import check_overlap


def test_recurring_task_only_blocks_its_stored_due_date(monkeypatch):
    zone = ZoneInfo("Asia/Ho_Chi_Minh")
    records = [
        SimpleNamespace(id=7, title="Đánh cầu", due_date=date(2026, 11, 7),
                        start_time=time(15), due_time=None, end_time=time(17),
                        duration_minutes=120, is_all_day=False, recurrence_rule="FREQ=WEEKLY"),
        SimpleNamespace(id=21, title="Đánh cầu", due_date=date(2026, 11, 21),
                        start_time=time(15), due_time=None, end_time=time(17),
                        duration_minutes=120, is_all_day=False, recurrence_rule="FREQ=WEEKLY"),
    ]

    async def no_events(*_args):
        return []

    async def stored_tasks(_db, _user_id, **filters):
        return [task for task in records if filters["due_after"] <= task.due_date <= filters["due_before"]]

    monkeypatch.setattr(event_crud, "get_by_range", no_events)
    monkeypatch.setattr(task_crud, "get_by_filters", stored_tasks)

    missing_date = datetime(2026, 11, 14, 15, tzinfo=zone)
    actual_date = datetime(2026, 11, 21, 15, tzinfo=zone)

    assert asyncio.run(busy_intervals(None, 1, missing_date, missing_date + timedelta(hours=2))) == []
    asyncio.run(check_overlap(None, 1, missing_date, missing_date + timedelta(hours=2)))

    with pytest.raises(HTTPException) as error:
        asyncio.run(check_overlap(None, 1, actual_date, actual_date + timedelta(hours=2)))
    assert error.value.detail["items"] == [{
        "type": "task", "id": 21, "title": "Đánh cầu",
        "start": actual_date.isoformat(), "end": (actual_date + timedelta(hours=2)).isoformat()
    }]


def test_recurring_calendar_event_still_blocks_visible_occurrence(monkeypatch):
    zone = ZoneInfo("Asia/Ho_Chi_Minh")
    first = datetime(2026, 11, 7, 15, tzinfo=zone)
    requested = datetime(2026, 11, 14, 15, tzinfo=zone)
    event = SimpleNamespace(id=9, title="Lịch nhóm", start_at=first,
                            end_at=first + timedelta(hours=2), recurrence_rule="FREQ=WEEKLY",
                            recurrence_end=None, parent_event_id=None, original_start=None,
                            is_all_day=False, is_cancelled=False, is_exception=False)

    async def events(*_args):
        return [event]

    async def no_tasks(*_args, **_kwargs):
        return []

    monkeypatch.setattr(event_crud, "get_by_range", events)
    monkeypatch.setattr(task_crud, "get_by_filters", no_tasks)

    with pytest.raises(HTTPException) as error:
        asyncio.run(check_overlap(None, 1, requested, requested + timedelta(hours=2)))
    assert error.value.detail["items"][0]["start"] == requested.isoformat()
