import asyncio
import sys
from datetime import datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException

from app.services.schedule_conflict import check_overlap, check_task_overlap


def test_overlap_lists_colliding_event_and_ignores_adjacent_slot(monkeypatch):
    zone = ZoneInfo("Asia/Ho_Chi_Minh")
    start = datetime(2026, 11, 3, 9, 0, tzinfo=zone)
    existing = {"type": "event", "id": 7, "title": "Họp", "start": start + timedelta(minutes=30), "end": start + timedelta(hours=1, minutes=30)}

    async def busy(*_args):
        return [existing]

    monkeypatch.setitem(sys.modules, "app.services.availability", SimpleNamespace(busy_intervals=busy))
    with pytest.raises(HTTPException) as error:
        asyncio.run(check_overlap(None, 1, start, start + timedelta(hours=1)))
    assert error.value.status_code == 409
    assert error.value.detail["items"][0]["title"] == "Họp"
    assert error.value.detail["requested"] == {
        "start": start.isoformat(), "end": (start + timedelta(hours=1)).isoformat()
    }

    asyncio.run(check_overlap(None, 1, start - timedelta(hours=1), start + timedelta(minutes=30)))
    asyncio.run(check_overlap(None, 1, start, start + timedelta(hours=1), allowed=True))


def test_same_clock_on_another_day_does_not_trigger_warning(monkeypatch):
    zone = ZoneInfo("Asia/Ho_Chi_Minh")
    chosen = datetime(2026, 11, 4, 15, 0, tzinfo=zone)
    future = datetime(2026, 11, 14, 15, 0, tzinfo=zone)
    requested_ranges = []

    async def busy(_db, _user_id, start, end, _exclude):
        requested_ranges.append((start, end))
        return [{"type": "task", "id": 8, "title": "Đánh cầu",
                 "start": future, "end": future + timedelta(hours=2)}]

    monkeypatch.setitem(sys.modules, "app.services.availability", SimpleNamespace(busy_intervals=busy))
    task = SimpleNamespace(due_date=chosen.date(), start_time=chosen.time(),
                           due_time=None, end_time=(chosen + timedelta(hours=2)).time(),
                           duration_minutes=120, is_all_day=False, recurrence_rule="FREQ=WEEKLY")
    asyncio.run(check_task_overlap(None, 1, task))

    assert requested_ranges == [(chosen, chosen + timedelta(hours=2))]


def test_recurring_task_still_warns_for_same_selected_day(monkeypatch):
    zone = ZoneInfo("Asia/Ho_Chi_Minh")
    chosen = datetime(2026, 11, 14, 15, 0, tzinfo=zone)

    async def busy(*_args):
        return [{"type": "task", "id": 8, "title": "Đánh cầu",
                 "start": chosen + timedelta(minutes=30),
                 "end": chosen + timedelta(hours=2)}]

    monkeypatch.setitem(sys.modules, "app.services.availability", SimpleNamespace(busy_intervals=busy))
    task = SimpleNamespace(due_date=chosen.date(), start_time=chosen.time(),
                           due_time=None, end_time=(chosen + timedelta(hours=2)).time(),
                           duration_minutes=120, is_all_day=False, recurrence_rule="FREQ=WEEKLY")
    with pytest.raises(HTTPException) as error:
        asyncio.run(check_task_overlap(None, 1, task))

    assert error.value.status_code == 409
    assert error.value.detail["items"][0]["title"] == "Đánh cầu"
