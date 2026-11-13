import asyncio
import os
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.core.time import BUSINESS_TZ
from app.crud.event_crud import event_crud
from app.models.event_model import Event, EventReminder, EventReminderDelivery
from app.models.calendar_model import Calendar
from app.models.user_model import User
from app.models.task_model import Task, TaskList
from app.schemas.event_schema import EventCreate, EventUpdate
from app.services import event_reminder_service as module
from app.services.event_reminder_service import due_event_reminders, event_time_display

START = datetime(2026, 11, 16, 9, tzinfo=BUSINESS_TZ)
NOW = START - timedelta(minutes=15)


def row(*, id=1, start=START, end=None, rule=None, all_day=False, cancelled=False, parent=None, original=None, leads=(None,)):
    return SimpleNamespace(id=id, start_at=start, end_at=end or start + timedelta(hours=1),
        recurrence_rule=rule, recurrence_end=None, is_all_day=all_day, is_cancelled=cancelled,
        parent_event_id=parent, original_start=original, is_exception=parent is not None,
        reminders=[SimpleNamespace(id=i+1, minutes_before=15 if lead is None else lead, use_user_default=lead is None) for i, lead in enumerate(leads)])


def test_inherited_and_explicit_minutes_cross_midnight_and_no_stale_alerts():
    assert len(list(due_event_reminders([row()], NOW, 15))) == 1
    assert not list(due_event_reminders([row()], NOW, 5))
    assert len(list(due_event_reminders([row(leads=(30,))], NOW, 5))) == 1
    assert not list(due_event_reminders([row()], START + timedelta(minutes=6), 15))
    assert not list(due_event_reminders([row(leads=())], NOW, 15))
    midnight = START.replace(hour=0, minute=5)
    assert len(list(due_event_reminders([row(start=midnight)], midnight-timedelta(minutes=30), 30))) == 1


def test_all_day_multi_day_only_reminds_at_first_day_0800_vietnam():
    start = START.replace(hour=0)
    event = row(start=start, end=start+timedelta(days=3), all_day=True)
    due = list(due_event_reminders([event], start+timedelta(hours=7, minutes=45), 15))
    assert len(due) == 1
    assert due[0].target.hour == 8
    assert due[0].start == start
    assert '18/11/2026' in event_time_display(due[0])
    assert '19/11/2026' not in event_time_display(due[0])
    assert not list(due_event_reminders([event], start+timedelta(days=1, hours=7, minutes=45), 15))


def test_recurrence_count_until_exceptions_and_each_occurrence_identity():
    event = row(rule='FREQ=DAILY;COUNT=2')
    one = list(due_event_reminders([event], NOW, 15))
    two = list(due_event_reminders([event], NOW+timedelta(days=1), 15))
    assert len(one) == len(two) == 1
    assert one[0].key != two[0].key
    assert not list(due_event_reminders([event], NOW+timedelta(days=2), 15))
    event.recurrence_rule = 'FREQ=DAILY;UNTIL=20261116'
    assert not list(due_event_reminders([event], NOW+timedelta(days=1), 15))
    event.recurrence_rule = 'FREQ=DAILY;COUNT=2'
    cancelled = row(id=2, cancelled=True, parent=1, original=START)
    assert not list(due_event_reminders([event, cancelled], NOW, 15))
    moved = row(id=2, start=START+timedelta(hours=2), parent=1, original=START)
    assert not list(due_event_reminders([event, moved], NOW, 15))
    assert [item.event.id for item in due_event_reminders([event, moved], NOW+timedelta(hours=2), 15)] == [2]


def test_large_lead_can_remind_multiple_occurrences_without_reusing_identity():
    due = list(due_event_reminders([row(rule='FREQ=DAILY;COUNT=3')], START, 1440))
    assert len(due) == 2
    assert len({item.key for item in due}) == 2


def test_all_day_legacy_non_midnight_start_still_uses_0800():
    assert len(list(due_event_reminders([row(start=START.replace(hour=14), all_day=True)], START.replace(hour=7, minute=45), 15))) == 1


@pytest_asyncio.fixture
async def qa_db():
    url = os.environ.get('REMINDER_TEST_DATABASE_URL')
    if not url:
        pytest.skip('Dedicated reminder QA database not configured')
    # Never accidentally run integration writes against a production URL.
    from urllib.parse import urlsplit
    assert urlsplit(url).hostname == 'planify-reminder-db'
    engine = create_async_engine(url, poolclass=NullPool)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        user = User(email=f'qa-{uuid4().hex}@example.com', nickname='QA', password_hashed='qa-only', notify_enabled=True, notify_minutes_before=15)
        db.add(user)
        await db.flush()
        calendar = Calendar(user_id=user.id, name='QA', is_default=True)
        db.add(calendar)
        await db.commit()
        ids = user.id, calendar.id
    yield factory, *ids
    await engine.dispose()


async def create_event(db, user_id, calendar_id, **kwargs):
    return await event_crud.create(db, user_id, EventCreate(title='QA event', calendar_id=calendar_id,
        start_at=kwargs.pop('start', START), end_at=kwargs.pop('end', START+timedelta(hours=1)), **kwargs))


@pytest.mark.asyncio
async def test_real_database_defaults_persistence_dedup_failure_retry_and_owner_scope(qa_db, monkeypatch):
    factory, user_id, calendar_id = qa_db
    sender = AsyncMock(return_value=False)
    monkeypatch.setattr(module, 'send_reminder_email', sender)
    async with factory() as db:
        event = await create_event(db, user_id, calendar_id)
        event_id = event.id
        assert event.reminders[0].minutes_before == 15
        assert event.reminders[0].use_user_default is True
        recipient = (await db.get(User, user_id)).email
        assert (await module.event_reminder_service.send_due(db, user_id, now=NOW))[0]['email_sent'] is False
    async with factory() as db:
        assert await db.scalar(select(func.count()).select_from(EventReminderDelivery).where(EventReminderDelivery.event_id == event_id)) == 0
        sender.return_value = True
        assert len(await module.event_reminder_service.send_due(db, user_id, now=NOW)) == 1
        assert sender.call_args.kwargs['to_email'] == recipient
    # A fresh session simulates another poll / process restart.
    async with factory() as db:
        assert not await module.event_reminder_service.send_due(db, user_id, now=NOW)
        assert (await db.get(Event, event_id)).user_id == user_id
        user = await db.get(User, user_id)
        user.notify_enabled = False
        await db.commit()
        assert not await module.event_reminder_service.send_due(db, user_id, now=NOW)
    assert sender.await_count == 2


@pytest.mark.asyncio
async def test_real_database_repeat_and_changed_shared_settings(qa_db, monkeypatch):
    factory, user_id, calendar_id = qa_db
    sender = AsyncMock(return_value=True)
    monkeypatch.setattr(module, 'send_reminder_email', sender)
    async with factory() as db:
        await create_event(db, user_id, calendar_id, recurrence_rule='FREQ=DAILY;COUNT=2')
        assert not await module.event_reminder_service.send_due(db, user_id, now=START-timedelta(minutes=30))
        user = await db.get(User, user_id)
        user.notify_minutes_before = 60
        await db.commit()
        assert len(await module.event_reminder_service.send_due(db, user_id, now=START-timedelta(minutes=30))) == 1
        assert len(await module.event_reminder_service.send_due(db, user_id, now=NOW+timedelta(days=1))) == 1
        assert not await module.event_reminder_service.send_due(db, user_id, now=NOW+timedelta(days=2))
    assert sender.await_count == 2


@pytest.mark.asyncio
async def test_two_concurrent_polls_send_once_and_do_not_block_each_other(qa_db, monkeypatch):
    factory, user_id, calendar_id = qa_db
    entered, release = asyncio.Event(), asyncio.Event()
    async def fake_send(**kwargs):
        entered.set()
        await release.wait()
        return True
    sender = AsyncMock(side_effect=fake_send)
    monkeypatch.setattr(module, 'send_reminder_email', sender)
    async with factory() as db:
        await create_event(db, user_id, calendar_id)
    async def poll():
        async with factory() as db:
            return await module.event_reminder_service.send_due(db, user_id, now=NOW)
    first = asyncio.create_task(poll())
    try:
        await asyncio.wait_for(entered.wait(), timeout=5)
        assert await asyncio.wait_for(poll(), timeout=5) == []
    finally:
        release.set()
    assert len(await first) == 1
    assert not await poll()
    assert sender.await_count == 1


@pytest.mark.asyncio
async def test_unchanged_reminder_save_is_deduped_but_rescheduling_notifies_again(qa_db, monkeypatch):
    factory, user_id, calendar_id = qa_db
    sender = AsyncMock(return_value=True)
    monkeypatch.setattr(module, 'send_reminder_email', sender)
    async with factory() as db:
        event = await create_event(db, user_id, calendar_id, reminders=[{'minutes_before': 15}])
        event_id = event.id
        await module.event_reminder_service.send_due(db, user_id, now=NOW)
        event = await event_crud.get_with_reminders(db, event_id)
        await event_crud.update(db, event, EventUpdate(reminders=[{'minutes_before': 15}]))
        assert not await module.event_reminder_service.send_due(db, user_id, now=NOW)
        event = await event_crud.get_with_reminders(db, event_id)
        await event_crud.update(db, event, EventUpdate(start_at=START+timedelta(minutes=10), end_at=START+timedelta(hours=1, minutes=10)))
        assert len(await module.event_reminder_service.send_due(db, user_id, now=NOW+timedelta(minutes=10))) == 1
    assert sender.await_count == 2


@pytest.mark.asyncio
async def test_api_shared_settings_trigger_events_and_tasks_without_real_email(qa_db, monkeypatch):
    import httpx
    from fastapi import Depends
    from app.api.deps import get_current_user
    from app.api.v1.endpoints import users
    from app.core.database import get_db
    from main import app
    factory, user_id, calendar_id = qa_db
    sender = AsyncMock(return_value=True)
    monkeypatch.setattr(module, 'send_reminder_email', sender)
    monkeypatch.setattr(module, 'local_now', lambda: NOW)
    monkeypatch.setattr(users, 'local_now', lambda: NOW)
    monkeypatch.setattr(users, 'business_today', lambda: NOW.date())
    monkeypatch.setattr(users, 'send_reminder_email', sender)
    async with factory() as db:
        event = await create_event(db, user_id, calendar_id)
        event_id = event.id
        task_list = TaskList(user_id=user_id, name='QA')
        db.add(task_list)
        await db.flush()
        db.add(Task(user_id=user_id, list_id=task_list.id, title='QA task', due_date=START.date(), start_time=START.time().replace(tzinfo=None), end_time=START.replace(hour=10).time().replace(tzinfo=None), reminder_minutes=15, is_all_day=False))
        await db.commit()
    async def session_dependency():
        async with factory() as db:
            yield db
    async def auth(db=Depends(get_db)):
        return await db.get(User, user_id)
    old = app.dependency_overrides.copy()
    app.dependency_overrides.update({get_db: session_dependency, get_current_user: auth})
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://qa') as client:
            listed = await client.get('/api/v1/events', params={'start': (START-timedelta(days=1)).isoformat(), 'end': (START+timedelta(days=1)).isoformat()})
            assert listed.status_code == 200, listed.text
            assert isinstance(listed.json()[0]['reminders'][0]['minutes_before'], int)
            assert listed.json()[0]['reminders'][0]['use_user_default'] is True
            response = await client.post('/api/v1/users/me/check-reminders')
            assert response.status_code == 200, response.text
            payload = response.json()
            assert len(payload['triggered']) == 2
            event = next(item for item in payload['triggered'] if item.get('item_type') == 'event')
            assert event['id'] == event_id and event['email_sent']
            assert event['notification_key'].startswith(f'event-{event_id}-')
            assert (await client.post('/api/v1/users/me/check-reminders')).json()['triggered'] == []
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(old)
    assert sender.await_count == 2


@pytest.mark.asyncio
async def test_opt_out_cancelled_other_owner_and_delete_cascade(qa_db, monkeypatch):
    factory, user_id, calendar_id = qa_db
    sender = AsyncMock(return_value=True)
    monkeypatch.setattr(module, 'send_reminder_email', sender)
    async with factory() as db:
        active = await create_event(db, user_id, calendar_id)
        active_id = active.id
        await create_event(db, user_id, calendar_id, reminders=[])
        cancelled = await create_event(db, user_id, calendar_id)
        cancelled.is_cancelled = True
        other = User(email=f'other-{uuid4().hex}@example.com', nickname='Other QA', password_hashed='qa-only')
        db.add(other)
        await db.flush()
        other_id, other_email = other.id, other.email
        other_calendar = Calendar(user_id=other_id, name='QA')
        db.add(other_calendar)
        await db.commit()
        await create_event(db, other_id, other_calendar.id)
        results = await module.event_reminder_service.send_due(db, user_id, now=NOW)
        assert [item['id'] for item in results] == [active_id]
        active = await event_crud.get_with_reminders(db, active_id)
        await event_crud.delete(db, active)
        assert await db.scalar(select(func.count()).select_from(EventReminderDelivery).where(EventReminderDelivery.event_id == active_id)) == 0
        assert not await module.event_reminder_service.send_due(db, user_id, now=NOW)
        assert len(await module.event_reminder_service.send_due(db, other_id, now=NOW)) == 1
        assert sender.call_args.kwargs['to_email'] == other_email
    assert sender.await_count == 2


@pytest.mark.asyncio
async def test_second_failure_keeps_first_acknowledgement(qa_db, monkeypatch):
    factory, user_id, calendar_id = qa_db
    sender = AsyncMock(side_effect=[True, False])
    monkeypatch.setattr(module, 'send_reminder_email', sender)
    async with factory() as db:
        await create_event(db, user_id, calendar_id)
        second = await create_event(db, user_id, calendar_id)
        second_id = second.id
        first_pass = await module.event_reminder_service.send_due(db, user_id, now=NOW)
        assert [item['email_sent'] for item in first_pass] == [True, False]
        sender.side_effect = None
        sender.return_value = True
        retry = await module.event_reminder_service.send_due(db, user_id, now=NOW)
        assert [item['id'] for item in retry] == [second_id]
    assert sender.await_count == 3


@pytest.mark.asyncio
async def test_background_scheduler_sends_event_without_open_browser(qa_db, monkeypatch):
    import main
    factory, user_id, calendar_id = qa_db
    sender = AsyncMock(return_value=True)
    monkeypatch.setattr(module, 'send_reminder_email', sender)
    monkeypatch.setattr(module, 'local_now', lambda: NOW)
    monkeypatch.setattr(main, 'send_reminder_email', AsyncMock(return_value=True))
    monkeypatch.setattr(main, 'local_now', lambda: NOW)
    monkeypatch.setattr(main, 'AsyncSessionLocal', factory)
    sleeps = 0
    async def tick_once(_):
        nonlocal sleeps
        sleeps += 1
        if sleeps > 1:
            raise asyncio.CancelledError()
    monkeypatch.setattr(main, 'asyncio', SimpleNamespace(sleep=tick_once, CancelledError=asyncio.CancelledError))
    async with factory() as db:
        event = await create_event(db, user_id, calendar_id)
        event_id = event.id
        event.title = f'QA background {user_id}'
        await db.commit()
    await main.background_scheduler_loop()
    async with factory() as db:
        assert await db.scalar(select(func.count()).select_from(EventReminderDelivery).where(EventReminderDelivery.event_id == event_id)) == 1
    assert sum(call.kwargs['task_title'] == f'QA background {user_id}' for call in sender.call_args_list) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('scope', ['this', 'following'])
async def test_recurring_edit_keeps_inherited_settings(qa_db, scope):
    from app.services.event_service import event_service
    factory, user_id, calendar_id = qa_db
    async with factory() as db:
        event = await create_event(db, user_id, calendar_id, recurrence_rule='FREQ=DAILY;COUNT=3')
        edited = await event_service.update_event(db, event.id, user_id,
            EventUpdate(title='QA edited occurrence', scope=scope, original_start=START+timedelta(days=1)),
            expected_revision=event.created_at.isoformat())
        assert edited.reminders[0].minutes_before == 15
        assert edited.reminders[0].use_user_default is True
        # Changing Settings still affects the exception/split, not a frozen 15.
        assert not list(due_event_reminders([edited], START+timedelta(days=1, minutes=-30), 15))
        assert len(list(due_event_reminders([edited], START+timedelta(days=1, minutes=-30), 60))) == 1
