from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.schemas.task_schema import TaskCreate
from app.schemas.event_schema import EventCreate


def test_task_and_event_notes_share_5000_character_limit():
    start = datetime(2026, 11, 3, 9, tzinfo=timezone.utc)
    TaskCreate(title="Việc", note="a" * 5000)
    EventCreate(title="Họp", description="a" * 5000, start_at=start, end_at=start + timedelta(hours=1))

    with pytest.raises(ValidationError):
        TaskCreate(title="Việc", note="a" * 5001)
    with pytest.raises(ValidationError):
        EventCreate(title="Họp", description="a" * 5001, start_at=start, end_at=start + timedelta(hours=1))
