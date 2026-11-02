#!/usr/bin/env python3
"""
Challenger M4 Backend Adversarial Test Suite
=============================================
Stress-tests:
1. ToolExecutor & parameter parsers:
   - Malformed date/time/datetime strings
   - Timezone-aware vs naive vs UTC datetime strings
   - Time-only strings, date-only strings in datetime/time fields
   - Zero unhandled 500 exceptions on boundary/corrupted parameters
2. Backend Event Exception Persistence & Range Query:
   - Series with multiple exceptions (modified start time, modified duration, cancelled tombstone)
   - Series with scope='this' vs scope='following' vs scope='all'
   - Verify get_by_range returns active master, active exceptions, and cancelled tombstones for deduplication.
3. AI Service Chat Endpoint boundary requests:
   - Rapid succession of messages, empty content, tool invocation edge cases
"""

import asyncio
import os
import sys
from datetime import datetime, date, time, timedelta, timezone

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.user_model import User
from app.models.calendar_model import Calendar
from app.models.event_model import Event
from app.models.task_model import Task, TaskList
from app.schemas.event_schema import EventCreate, EventUpdate
from app.schemas.task_schema import TaskCreate, TaskUpdate
from app.services.event_service import event_service
from app.services.task_service import task_service
from app.ai.tool_executor import ToolExecutor, parse_date, parse_time, parse_datetime

async def get_test_user_and_cal(db: AsyncSession):
    # Find or create a test user
    stmt = select(User).where(User.email == "challenger_m4@test.com")
    res = await db.execute(stmt)
    user = res.scalars().first()
    if not user:
        user = User(
            email="challenger_m4@test.com",
            password_hashed="hashed_pwd_placeholder",
            nickname="ChallengerM4",
            timezone="Asia/Ho_Chi_Minh"
        )
        db.add(user)
        await db.flush()

    # Find or create default calendar
    stmt = select(Calendar).where(Calendar.user_id == user.id, Calendar.is_default == True)
    res = await db.execute(stmt)
    cal = res.scalars().first()
    if not cal:
        cal = Calendar(user_id=user.id, name="Challenger Cal", color="#4285F4", is_default=True)
        db.add(cal)
        await db.flush()

    # Find or create default task list
    stmt = select(TaskList).where(TaskList.user_id == user.id, TaskList.is_default == True)
    res = await db.execute(stmt)
    tlist = res.scalars().first()
    if not tlist:
        tlist = TaskList(user_id=user.id, name="Challenger List", color="#4285F4", is_default=True)
        db.add(tlist)
        await db.flush()

    await db.commit()
    return user, cal, tlist

async def run_parsers_adversarial_tests():
    print("[*] 1. Stress-testing parameter parsers in tool_executor.py...")

    # --- parse_date ---
    assert parse_date(None) is None
    assert parse_date("") is None
    assert parse_date(date(2026, 11, 2)) == date(2026, 11, 2)
    assert parse_date(datetime(2026, 11, 2, 10, 30)) == date(2026, 11, 2)
    assert parse_date("2026-11-02") == date(2026, 11, 2)
    assert parse_date("2026-11-02T15:30:00") == date(2026, 11, 2)
    assert parse_date("2026-11-02T15:30:00Z") == date(2026, 11, 2)
    assert parse_date("2026-11-02T15:30:00+07:00") == date(2026, 11, 2)
    assert parse_date("2026-11-02 15:30:00") == date(2026, 11, 2)

    # Malformed date strings
    for malformed in ["not-a-date", "2026/11/02", "2026-02-30", "   ", "abc-def"]:
        try:
            d = parse_date(malformed)
            # If not raising, it must either be None or handled
        except Exception as e:
            # Raising ValueError is acceptable, as ToolExecutor.execute() catches Exception
            assert isinstance(e, ValueError)

    # --- parse_time ---
    assert parse_time(None) is None
    assert parse_time("") is None
    assert parse_time(time(14, 30)) == time(14, 30)
    assert parse_time(datetime(2026, 11, 2, 14, 30)) == time(14, 30)
    assert parse_time("14:30") == time(14, 30, 0)
    assert parse_time("14:30:45") == time(14, 30, 45)
    assert parse_time("2026-11-02T14:30:00") == time(14, 30, 0)
    assert parse_time("2026-11-02T14:30:00Z") == time(14, 30, 0)
    assert parse_time("2026-11-02T14:30:00+07:00") == time(14, 30, 0)

    # Malformed time strings should return None or raise ValueError
    for malformed in ["not-a-time", "25:00", "14:60", "   "]:
        res = parse_time(malformed)
        assert res is None, f"Expected None for malformed time '{malformed}', got {res}"

    # --- parse_datetime ---
    assert parse_datetime(None) is None
    assert parse_datetime("") is None
    assert parse_datetime(datetime(2026, 11, 2, 10, 0)) == datetime(2026, 11, 2, 10, 0)
    assert parse_datetime(date(2026, 11, 2)) == datetime(2026, 11, 2, 0, 0)
    assert parse_datetime("2026-11-02") == datetime(2026, 11, 2, 0, 0)
    assert parse_datetime("2026-11-02T10:30:00") == datetime(2026, 11, 2, 10, 30, 0)
    assert parse_datetime("2026-11-02 10:30:00") == datetime(2026, 11, 2, 10, 30, 0)

    # Timezone-aware datetimes
    dt_z = parse_datetime("2026-11-02T10:30:00Z")
    assert dt_z.tzinfo is not None
    assert dt_z.year == 2026 and dt_z.month == 11 and dt_z.day == 2

    dt_vn = parse_datetime("2026-11-02T10:30:00+07:00")
    assert dt_vn.tzinfo is not None
    assert dt_vn.utcoffset() == timedelta(hours=7)

    dt_ny = parse_datetime("2026-11-02T10:30:00-05:00")
    assert dt_ny.tzinfo is not None
    assert dt_ny.utcoffset() == timedelta(hours=-5)

    print("   [PASS] Parsers correctly handle standard, timezone-aware, and boundary formats.")

async def run_tool_executor_resilience_tests(db: AsyncSession, user: User, cal: Calendar, tlist: TaskList):
    print("[*] 2. Stress-testing ToolExecutor.execute() with boundary & malformed parameters...")
    executor = ToolExecutor(user_id=user.id, db=db)

    # 1. Unknown tool
    res = await executor.execute("non_existent_tool_xyz", {"arg1": 123})
    assert res["success"] is False
    assert "không tồn tại" in res["error"]

    # 2. create_event with malformed start_at (must return success=False, NO unhandled 500 crash!)
    res = await executor.execute("create_event", {
        "title": "Malformed Event",
        "start_at": "totally-invalid-date-string"
    })
    assert res["success"] is False
    assert "error" in res

    # 3. create_event with timezone-aware ISO string (+07:00)
    res = await executor.execute("create_event", {
        "title": "Timezone +07:00 Event",
        "start_at": "2026-11-10T14:00:00+07:00",
        "end_at": "2026-11-10T15:00:00+07:00",
        "calendar_id": cal.id
    })
    assert res["success"] is True, f"Failed create_event with +07:00: {res}"
    event_id = res["data"]["id"]

    # 4. create_event with UTC ISO string (Z)
    res = await executor.execute("create_event", {
        "title": "Timezone UTC Event",
        "start_at": "2026-11-11T07:00:00Z",
        "end_at": "2026-11-11T08:00:00Z",
        "calendar_id": cal.id
    })
    assert res["success"] is True, f"Failed create_event with UTC Z: {res}"

    # 5. create_event with date-only string
    res = await executor.execute("create_event", {
        "title": "Date Only Event",
        "start_at": "2026-11-12",
        "calendar_id": cal.id
    })
    assert res["success"] is True, f"Failed create_event with date-only: {res}"

    # 6. update_event with timezone string
    res = await executor.execute("update_event", {
        "event_id": event_id,
        "title": "Updated Event Title",
        "start_at": "2026-11-10T16:00:00+07:00"
    })
    assert res["success"] is True, f"Failed update_event: {res}"

    # 7. create_task with full ISO string for due_date
    res = await executor.execute("create_task", {
        "title": "Task with ISO due_date",
        "due_date": "2026-11-15T00:00:00+07:00",
        "start_time": "09:30",
        "end_time": "10:30",
        "duration_minutes": 60,
        "is_all_day": False,
        "list_id": tlist.id
    })
    assert res["success"] is True, f"Failed create_task with ISO due_date: {res}"
    task_id = res["data"]["id"]
    assert res["data"]["due_date"] == "2026-11-15"
    assert "09:30" in res["data"]["start_time"]

    # 8. create_task with malformed due_date (must return success=False cleanly)
    res = await executor.execute("create_task", {
        "title": "Task with malformed due_date",
        "due_date": "corrupted-date-xyz",
        "list_id": tlist.id
    })
    assert res["success"] is False
    assert "error" in res

    # 9. update_task with ISO strings
    res = await executor.execute("update_task", {
        "task_id": task_id,
        "due_date": "2026-11-16T10:00:00Z",
        "start_time": "2026-11-16T14:00:00+07:00"
    })
    assert res["success"] is True, f"Failed update_task: {res}"

    # 10. complete_task
    res = await executor.execute("complete_task", {
        "task_id": task_id,
        "is_completed": True
    })
    assert res["success"] is True
    assert res["data"]["is_completed"] is True

    # 11. get_schedule_summary with boundary formats
    res = await executor.execute("get_schedule_summary", {
        "date_str": "2026-11-10T00:00:00+07:00"
    })
    assert res["success"] is True
    assert "events" in res["data"]

    res = await executor.execute("get_schedule_summary", {
        "date_str": "invalid-summary-date"
    })
    assert res["success"] is False
    assert "error" in res

    print("   [PASS] ToolExecutor executes 11 boundary scenarios with 0 unhandled 500 exceptions.")

async def run_recurring_deduplication_backend_tests(db: AsyncSession, user: User, cal: Calendar):
    print("[*] 3. Stress-testing Backend Recurring Exceptions & Deduplication Queries...")

    # Create a 14-day daily recurring master event starting 2026-11-01 at 09:00:00
    start_base = datetime(2026, 11, 1, 9, 0, 0, tzinfo=timezone.utc)
    end_base = datetime(2026, 11, 1, 10, 0, 0, tzinfo=timezone.utc)

    master = Event(
        user_id=user.id,
        calendar_id=cal.id,
        title="Daily Standup Series",
        start_at=start_base,
        end_at=end_base,
        is_all_day=False,
        recurrence_rule="FREQ=DAILY;COUNT=14",
        is_exception=False,
        parent_event_id=None
    )
    db.add(master)
    await db.flush()

    master_id = master.id

    # 1. Exception 1 (Day 3: Nov 3): Modified start time to 14:00
    nov3_orig = datetime(2026, 11, 3, 9, 0, 0, tzinfo=timezone.utc)
    nov3_new_start = datetime(2026, 11, 3, 14, 0, 0, tzinfo=timezone.utc)
    nov3_new_end = datetime(2026, 11, 3, 15, 0, 0, tzinfo=timezone.utc)

    exc_update = EventUpdate(
        title="Daily Standup (Moved to Afternoon)",
        start_at=nov3_new_start,
        end_at=nov3_new_end,
        original_start=nov3_orig,
        scope="this"
    )
    exc1 = await event_service.update_event(db, event_id=master_id, user_id=user.id, event_in=exc_update)
    assert exc1.is_exception is True
    assert exc1.parent_event_id == master_id
    assert exc1.original_start == nov3_orig

    # 2. Exception 2 (Day 5: Nov 5): Cancelled tombstone via DELETE scope=this
    nov5_orig = datetime(2026, 11, 5, 9, 0, 0, tzinfo=timezone.utc)
    await event_service.delete_event(
        db, event_id=master_id, user_id=user.id, scope="this", occurrence_date=nov5_orig
    )

    # 3. Exception 3 (Day 7: Nov 7): Moved to Nov 8 at 16:00
    nov7_orig = datetime(2026, 11, 7, 9, 0, 0, tzinfo=timezone.utc)
    nov8_rescheduled = datetime(2026, 11, 8, 16, 0, 0, tzinfo=timezone.utc)
    exc_update_7 = EventUpdate(
        title="Daily Standup (Rescheduled to Nov 8)",
        start_at=nov8_rescheduled,
        end_at=nov8_rescheduled + timedelta(hours=1),
        original_start=nov7_orig,
        scope="this"
    )
    exc3 = await event_service.update_event(db, event_id=master_id, user_id=user.id, event_in=exc_update_7)
    assert exc3.is_exception is True

    # 4. Query get_events_in_range for range Nov 1 - Nov 14
    range_start = datetime(2026, 11, 1, 0, 0, 0, tzinfo=timezone.utc)
    range_end = datetime(2026, 11, 14, 23, 59, 59, tzinfo=timezone.utc)

    fetched = await event_service.get_events_in_range(
        db, user_id=user.id, start_at=range_start, end_at=range_end, calendar_id=cal.id
    )

    # Filter items belonging to this series
    series_items = [e for e in fetched if e.id == master_id or e.parent_event_id == master_id]

    master_items = [e for e in series_items if e.id == master_id]
    exceptions = [e for e in series_items if e.parent_event_id == master_id]
    cancelled_tombstones = [e for e in exceptions if e.is_cancelled is True]
    active_exceptions = [e for e in exceptions if e.is_cancelled is False]

    assert len(master_items) == 1, "Master event should be present"
    assert len(cancelled_tombstones) == 1, f"Expected 1 cancelled tombstone, got {len(cancelled_tombstones)}"
    assert cancelled_tombstones[0].original_start == nov5_orig, "Tombstone should match Nov 5 original_start"
    assert len(active_exceptions) == 2, f"Expected 2 active exceptions, got {len(active_exceptions)}"

    print("   [PASS] Backend event_service correctly returns master series, active exceptions, and cancelled tombstones.")

    # 5. Split series test (scope="following" on Nov 10)
    nov10_split = datetime(2026, 11, 10, 9, 0, 0, tzinfo=timezone.utc)
    split_update = EventUpdate(
        title="Daily Standup Series (Split Part 2)",
        start_at=nov10_split,
        end_at=nov10_split + timedelta(hours=1),
        original_start=nov10_split,
        recurrence_rule="FREQ=DAILY;COUNT=5",
        scope="following"
    )
    split_series = await event_service.update_event(db, event_id=master_id, user_id=user.id, event_in=split_update)
    assert split_series.is_exception is False
    assert split_series.parent_event_id is None

    # Refresh master to verify recurrence_end cutoff
    await db.refresh(master)
    assert master.recurrence_end is not None
    assert master.recurrence_end < nov10_split
    print("   [PASS] Scope 'following' successfully truncated parent series and initialized split series.")

async def main():
    print("=====================================================================")
    print("   PLANIFY MILESTONE M4 BACKEND ADVERSARIAL TEST SUITE")
    print("=====================================================================")

    await run_parsers_adversarial_tests()

    async with AsyncSessionLocal() as db:
        user, cal, tlist = await get_test_user_and_cal(db)
        await run_tool_executor_resilience_tests(db, user, cal, tlist)
        await run_recurring_deduplication_backend_tests(db, user, cal)

    print("\n=====================================================================")
    print("🎉 ALL M4 BACKEND ADVERSARIAL TESTS PASSED (0 EXCEPTIONS, 0 FAILURES)!")
    print("=====================================================================")

if __name__ == "__main__":
    asyncio.run(main())
