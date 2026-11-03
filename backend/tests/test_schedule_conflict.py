import asyncio
import sys
from datetime import datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException

from app.services.schedule_conflict import check_overlap


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

    asyncio.run(check_overlap(None, 1, start - timedelta(hours=1), start + timedelta(minutes=30)))
    asyncio.run(check_overlap(None, 1, start, start + timedelta(hours=1), allowed=True))
