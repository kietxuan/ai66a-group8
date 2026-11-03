"""A selected category must survive the create path for both item types."""
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

from app.crud.event_crud import event_crud
from app.crud.task_crud import task_crud
from app.schemas.event_schema import EventCreate
from app.schemas.task_schema import TaskCreate


def test_task_create_keeps_selected_category(monkeypatch):
    db = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    monkeypatch.setattr(task_crud, "get_with_steps", AsyncMock())

    asyncio.run(task_crud.create(db, user_id=1, obj_in=TaskCreate(
        title="Việc học", list_id=2, category="Học tập", color="#8B5CF6"
    )))

    created = db.add.call_args.args[0]
    assert created.category == "Học tập"
    assert created.color == "#8B5CF6"


def test_event_create_keeps_selected_category(monkeypatch):
    db = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    monkeypatch.setattr(event_crud, "get_with_reminders", AsyncMock())
    start = datetime(2026, 11, 4, 9, tzinfo=timezone.utc)

    asyncio.run(event_crud.create(db, user_id=1, obj_in=EventCreate(
        title="Buổi học", calendar_id=2, start_at=start,
        end_at=start + timedelta(hours=1), category="Học tập", color="#8B5CF6"
    )))

    created = db.add.call_args.args[0]
    assert created.category == "Học tập"
    assert created.color == "#8B5CF6"
