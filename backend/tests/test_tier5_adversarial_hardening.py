from unittest import SkipTest as _LegacyProbeSkipped
raise _LegacyProbeSkipped("Historical probe archived: unsafe live DB/provider assumptions. Run backend/tests/regression instead.")

#!/usr/bin/env python3
"""
Planify Tier 5 White-Box Adversarial Hardening Test Suite
==========================================================
Audits and stress-tests:
1. RFC 5545 Recurrence Engine & Extreme Date-Math Boundaries:
   - Leap year (Feb 29) yearly & monthly rollovers across leap and non-leap years.
   - Month-end clamping (Jan 31 -> Feb 28 -> Mar 31 -> Apr 30).
   - Extreme, zero, negative INTERVAL values & giant COUNT values.
   - Inverted start/end times auto-healing.
   - Midnight crossing time blocks.
2. Event Series Splitting & Exception Semantics (scope="following", "this", "all"):
   - scope="following" on the first occurrence of a recurring series.
   - scope="following" on the last occurrence of a recurring series.
   - scope="following" delete on the first occurrence.
   - scope="this" double-deletion idempotency (no duplicate tombstone errors).
   - scope="all" cascade deletion: verifies master + all child exceptions purged with 0 orphans.
   - Direct deletion of child exception row without affecting master series.
3. Task & Step Adversarial Hardening:
   - Extreme reorder (negative, duplicate, giant positions, non-existent IDs).
   - Task reorder cross-user security isolation.
   - Task recurrence termination on COUNT=1 and UNTIL boundary in the past.
   - Task step overflow with 30+ steps, emojis, unicode, long strings.
4. AI Tool Executor Malformed Input & Security Guardrails:
   - Fallback on unknown tool name (graceful failure, 0 unhandled exceptions).
   - SQL injection & XSS payload resistance.
   - AI conversation cross-user isolation on GET and POST /conversations/{id}/messages.
   - AI rate-limiting enforcement via Redis counter (HTTP 429).
5. Concurrency & Race Conditions:
   - Concurrent task creations under load (asyncio.gather).
   - Concurrent overlapping event creations.
   - Concurrent task toggle completion.
6. Frontend White-Box Algorithms Emulation:
   - Collision column packing algorithmic stress with 20 concurrent overlapping events.
   - AgendaView 30-day window filtering & dayMap chronological sorting.
   - RRuleParser corrupt string resilience.

Usage:
    docker exec web-template-backend-1 python tests/test_tier5_adversarial_hardening.py
"""

import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import time
import uuid
import json
import asyncio
import calendar
from datetime import datetime, date, time as dtime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple

import httpx
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

# Backend imports (runnable inside the container)
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.redis import redis_client
from app.models.user_model import User
from app.models.calendar_model import Calendar
from app.models.event_model import Event, EventReminder
from app.models.task_model import Task, TaskList, TaskStep
from app.models.ai_model import AIConversation, AIMessage
from app.services.event_service import event_service
from app.services.task_service import task_service
from app.services.ai_service import ai_service
from app.ai.tool_executor import ToolExecutor, parse_date, parse_time, parse_datetime

# Configuration
BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000/api/v1")

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def unwrap(res: httpx.Response) -> Any:
    """Helper to unwrap ApiResponse format {success, message, data} or raw JSON."""
    if res.status_code == 204:
        return None
    try:
        j = res.json()
    except Exception:
        return res.text
    if isinstance(j, dict) and "data" in j and len(j) <= 3:
        return j["data"]
    return j


class AdversarialTestResult:
    def __init__(self, name: str, category: str):
        self.name = name
        self.category = category
        self.passed = False
        self.error: Optional[str] = None
        self.duration_ms: float = 0.0


class AdversarialTestRunner:
    def __init__(self):
        self.results: List[AdversarialTestResult] = []
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
        self.token: Optional[str] = None
        self.headers: Dict[str, str] = {}
        self.user_email: Optional[str] = None
        self.user_id: Optional[int] = None

    async def init_session(self):
        # Connect redis client
        try:
            await redis_client.connect()
        except Exception as e:
            print(f"Warning: redis connect failed: {e}")

        uid = uuid.uuid4().hex[:8]
        ts = int(time.time())
        self.user_email = f"tier5_adv_{ts}_{uid}@example.com"
        pwd = "AdvPassword123!"

        reg_resp = await self.client.post("/users/register", json={
            "email": self.user_email,
            "nickname": f"AdvUser {uid}",
            "password": pwd
        })
        if reg_resp.status_code not in (200, 201):
            raise RuntimeError(f"Registration failed: {reg_resp.text}")

        login_resp = await self.client.post("/auth/login", data={
            "username": self.user_email,
            "password": pwd
        })
        if login_resp.status_code != 200:
            raise RuntimeError(f"Login failed: {login_resp.text}")

        login_data = login_resp.json()
        self.token = login_data["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

        # Resolve internal user_id
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(User).where(User.email == self.user_email))
            u = res.scalars().first()
            if u:
                self.user_id = u.id

    async def create_secondary_user(self) -> Tuple[httpx.AsyncClient, Dict[str, str], int]:
        """Creates a second isolated user for authorization/isolation testing."""
        uid = uuid.uuid4().hex[:8]
        email = f"secondary_{uid}@example.com"
        pwd = "AdvPassword123!"
        c = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
        await c.post("/users/register", json={"email": email, "nickname": f"Sec {uid}", "password": pwd})
        l = (await c.post("/auth/login", data={"username": email, "password": pwd})).json()
        headers = {"Authorization": f"Bearer {l['access_token']}"}

        async with AsyncSessionLocal() as db:
            res = await db.execute(select(User).where(User.email == email))
            sec_u = res.scalars().first()
            sec_id = sec_u.id

        return c, headers, sec_id

    async def close(self):
        await self.client.aclose()
        if redis_client.redis:
            await redis_client.close()

    async def run_test(self, name: str, category: str, coro):
        res = AdversarialTestResult(name, category)
        t0 = time.time()
        try:
            await coro()
            res.passed = True
        except Exception as e:
            res.passed = False
            res.error = f"{type(e).__name__}: {str(e)}"
        finally:
            res.duration_ms = (time.time() - t0) * 1000
            self.results.append(res)
            status_str = f"{GREEN}[PASS]{RESET}" if res.passed else f"{RED}[FAIL]{RESET}"
            print(f"  {status_str} {name} ({res.duration_ms:.1f}ms)")
            if not res.passed:
                print(f"         {YELLOW}--> {res.error}{RESET}")


# =====================================================================
# TEST DEFINITIONS
# =====================================================================

async def main():
    runner = AdversarialTestRunner()
    await runner.init_session()

    print(f"\n{BOLD}{CYAN}====================================================================={RESET}")
    print(f"{BOLD}{CYAN}   PLANIFY TIER 5 WHITE-BOX ADVERSARIAL HARDENING SUITE              {RESET}")
    print(f"{BOLD}{CYAN}   Session User: {runner.user_email} (ID: {runner.user_id})          {RESET}")
    print(f"{BOLD}{CYAN}====================================================================={RESET}\n")

    # -----------------------------------------------------------------
    # SUITE 1: Extreme RRULE & Date-Math Edge Cases
    # -----------------------------------------------------------------
    print(f"{BOLD}--- Suite 1: Extreme RRULE & Date-Math Edge Cases ---{RESET}")

    async def test_adv_01_leap_year_feb29_recurrence():
        # Test leap year Feb 29 yearly calculation
        d = date(2024, 2, 29)
        next_1 = task_service._calculate_next_due_date(d, "FREQ=YEARLY;INTERVAL=1")
        assert next_1 == date(2025, 2, 28), f"Expected 2025-02-28, got {next_1}"

        next_2 = task_service._calculate_next_due_date(next_1, "FREQ=YEARLY;INTERVAL=1")
        assert next_2 == date(2026, 2, 28), f"Expected 2026-02-28, got {next_2}"

        next_4 = task_service._calculate_next_due_date(d, "FREQ=YEARLY;INTERVAL=4")
        assert next_4 == date(2028, 2, 29), f"Expected 2028-02-29, got {next_4}"

        # Test month-end rollover: Jan 31 -> Feb 28 (non-leap 2025)
        d_jan31 = date(2025, 1, 31)
        next_feb = task_service._calculate_next_due_date(d_jan31, "FREQ=MONTHLY;INTERVAL=1")
        assert next_feb == date(2025, 2, 28), f"Expected 2025-02-28, got {next_feb}"

        # Jan 31 2024 -> Feb 29 2024 (leap year)
        d_jan31_leap = date(2024, 1, 31)
        next_feb_leap = task_service._calculate_next_due_date(d_jan31_leap, "FREQ=MONTHLY;INTERVAL=1")
        assert next_feb_leap == date(2024, 2, 29), f"Expected 2024-02-29, got {next_feb_leap}"

    await runner.run_test(
        "test_adv_01_leap_year_feb29_recurrence",
        "Recurrence & Date Math",
        test_adv_01_leap_year_feb29_recurrence
    )

    async def test_adv_02_rrule_extreme_and_corrupt_parameters():
        base = date(2026, 5, 1)
        # Negative interval clamped to 1
        res_neg = task_service._calculate_next_due_date(base, "FREQ=DAILY;INTERVAL=-10")
        assert res_neg == date(2026, 5, 2), f"Expected 2026-05-02, got {res_neg}"

        # Zero interval clamped to 1
        res_zero = task_service._calculate_next_due_date(base, "FREQ=DAILY;INTERVAL=0")
        assert res_zero == date(2026, 5, 2), f"Expected 2026-05-02, got {res_zero}"

        # Unknown frequency fallback
        res_unk = task_service._calculate_next_due_date(base, "FREQ=MINUTELY;INTERVAL=5")
        assert res_unk == date(2026, 5, 6), f"Expected 2026-05-06, got {res_unk}"

        # Corrupted / empty rule returns None
        assert task_service._calculate_next_due_date(base, "") is None

        # UNTIL boundary in the past returns None
        res_until_past = task_service._calculate_next_due_date(base, "FREQ=DAILY;UNTIL=20250101")
        assert res_until_past is None, f"Expected None for expired UNTIL, got {res_until_past}"

        # COUNT=1 returns None (last occurrence)
        res_count_1 = task_service._calculate_next_due_date(base, "FREQ=DAILY;COUNT=1")
        assert res_count_1 is None, f"Expected None for COUNT=1, got {res_count_1}"

        # COUNT=3 returns next date and decrements count to COUNT=2
        res_count_3 = task_service._calculate_next_due_date(base, "FREQ=DAILY;COUNT=3")
        assert res_count_3 == date(2026, 5, 2)
        dec_rrule = task_service._decrement_count_in_rrule("FREQ=DAILY;COUNT=3")
        assert "COUNT=2" in dec_rrule

    await runner.run_test(
        "test_adv_02_rrule_extreme_and_corrupt_parameters",
        "Recurrence & Date Math",
        test_adv_02_rrule_extreme_and_corrupt_parameters
    )

    async def test_adv_03_inverted_event_times_auto_heal():
        # Post event where end_at is before start_at
        start_str = "2026-07-15T16:00:00"
        end_str = "2026-07-15T14:00:00"  # 2 hours before start
        resp = await runner.client.post("/events", headers=runner.headers, json={
            "title": "Adversarial Inverted Time Event",
            "start_at": start_str,
            "end_at": end_str
        })
        assert resp.status_code in (200, 201), f"Event creation failed: {resp.text}"
        data = unwrap(resp)
        # Backend must auto-heal end_at to start_at + 1 hour (17:00:00)
        assert data["start_at"].startswith("2026-07-15T16:00:00")
        assert data["end_at"].startswith("2026-07-15T17:00:00"), f"Expected auto-healed 17:00:00, got {data['end_at']}"

    await runner.run_test(
        "test_adv_03_inverted_event_times_auto_heal",
        "Recurrence & Date Math",
        test_adv_03_inverted_event_times_auto_heal
    )

    async def test_adv_04_midnight_crossing_time_blocks():
        # Task scheduled from 23:30 to 00:30 next day
        resp = await runner.client.post("/tasks", headers=runner.headers, json={
            "title": "Midnight Crossing Task",
            "due_date": "2026-08-01",
            "start_time": "23:30:00",
            "end_time": "00:30:00",
            "duration_minutes": 60,
            "is_all_day": False
        })
        assert resp.status_code in (200, 201), f"Task creation failed: {resp.text}"
        data = unwrap(resp)
        assert data["start_time"] == "23:30:00"
        assert data["end_time"] == "00:30:00"
        assert data["duration_minutes"] == 60

    await runner.run_test(
        "test_adv_04_midnight_crossing_time_blocks",
        "Recurrence & Date Math",
        test_adv_04_midnight_crossing_time_blocks
    )

    # -----------------------------------------------------------------
    # SUITE 2: Event Series Splitting & Exception Semantics
    # -----------------------------------------------------------------
    print(f"\n{BOLD}--- Suite 2: Event Series Splitting & Exception Semantics ---{RESET}")

    async def test_adv_05_event_split_following_first_occurrence():
        # Create master recurring event: Daily for 10 days starting 2026-09-01T09:00:00
        start_dt = "2026-09-01T09:00:00"
        end_dt = "2026-09-01T10:00:00"
        create_resp = await runner.client.post("/events", headers=runner.headers, json={
            "title": "Master Daily Series",
            "start_at": start_dt,
            "end_at": end_dt,
            "recurrence_rule": "FREQ=DAILY;COUNT=10"
        })
        master_id = unwrap(create_resp)["id"]

        # Apply scope="following" on the FIRST occurrence (2026-09-01T09:00:00)
        split_resp = await runner.client.put(f"/events/{master_id}", headers=runner.headers, json={
            "title": "Renamed Following First Occurrence",
            "start_at": "2026-09-01T11:00:00",
            "end_at": "2026-09-01T12:00:00",
            "original_start": start_dt,
            "scope": "following"
        })
        assert split_resp.status_code == 200, f"Split following first occurrence failed: {split_resp.text}"
        new_series = unwrap(split_resp)
        assert new_series["id"] != master_id, "New series ID should differ from master ID"
        assert new_series["title"] == "Renamed Following First Occurrence"
        assert new_series["start_at"].startswith("2026-09-01T11:00:00")

        # Verify in DB: master_event recurrence_end should be before split_dt (2026-09-01 08:59:59)
        async with AsyncSessionLocal() as db:
            m = (await db.execute(select(Event).where(Event.id == master_id))).scalars().first()
            assert m.recurrence_end is not None
            rec_end_naive = m.recurrence_end.replace(tzinfo=None)
            split_naive = datetime.fromisoformat(start_dt).replace(tzinfo=None)
            assert rec_end_naive < split_naive, f"Expected {rec_end_naive} < {split_naive}"

    await runner.run_test(
        "test_adv_05_event_split_following_first_occurrence",
        "Exception & Series Split",
        test_adv_05_event_split_following_first_occurrence
    )

    async def test_adv_06_event_split_following_last_occurrence():
        # Create master recurring event: Daily 5 times starting 2026-09-10T10:00:00
        start_dt = "2026-09-10T10:00:00"
        end_dt = "2026-09-10T11:00:00"
        create_resp = await runner.client.post("/events", headers=runner.headers, json={
            "title": "5-Day Series",
            "start_at": start_dt,
            "end_at": end_dt,
            "recurrence_rule": "FREQ=DAILY;COUNT=5"
        })
        master_id = unwrap(create_resp)["id"]

        # Split at last occurrence (day 5: 2026-09-14T10:00:00)
        split_dt = "2026-09-14T10:00:00"
        split_resp = await runner.client.put(f"/events/{master_id}", headers=runner.headers, json={
            "title": "Last Occurrence Split",
            "start_at": "2026-09-14T14:00:00",
            "end_at": "2026-09-14T15:00:00",
            "original_start": split_dt,
            "scope": "following"
        })
        assert split_resp.status_code == 200, f"Split last occurrence failed: {split_resp.text}"
        new_event = unwrap(split_resp)
        assert new_event["id"] != master_id
        assert new_event["title"] == "Last Occurrence Split"

    await runner.run_test(
        "test_adv_06_event_split_following_last_occurrence",
        "Exception & Series Split",
        test_adv_06_event_split_following_last_occurrence
    )

    async def test_adv_07_event_delete_following_first_occurrence():
        # Create recurring event
        c_resp = await runner.client.post("/events", headers=runner.headers, json={
            "title": "Series To Truncate Immediately",
            "start_at": "2026-10-01T08:00:00",
            "end_at": "2026-10-01T09:00:00",
            "recurrence_rule": "FREQ=WEEKLY;INTERVAL=1"
        })
        m_id = unwrap(c_resp)["id"]

        # Delete with scope="following" at the start date
        del_resp = await runner.client.delete(
            f"/events/{m_id}?scope=following&occurrence_date=2026-10-01T08:00:00",
            headers=runner.headers
        )
        assert del_resp.status_code == 204

        # Verify DB recurrence_end is before start_at
        async with AsyncSessionLocal() as db:
            ev = (await db.execute(select(Event).where(Event.id == m_id))).scalars().first()
            assert ev.recurrence_end is not None
            rec_end_naive = ev.recurrence_end.replace(tzinfo=None)
            assert rec_end_naive < datetime(2026, 10, 1, 8, 0, 0)

    await runner.run_test(
        "test_adv_07_event_delete_following_first_occurrence",
        "Exception & Series Split",
        test_adv_07_event_delete_following_first_occurrence
    )

    async def test_adv_08_event_exception_idempotent_delete_this():
        # Create recurring event
        c_resp = await runner.client.post("/events", headers=runner.headers, json={
            "title": "Idempotent Series",
            "start_at": "2026-10-10T14:00:00",
            "end_at": "2026-10-10T15:00:00",
            "recurrence_rule": "FREQ=DAILY"
        })
        m_id = unwrap(c_resp)["id"]
        target_occ = "2026-10-12T14:00:00"

        # First cancellation
        d1 = await runner.client.delete(
            f"/events/{m_id}?scope=this&occurrence_date={target_occ}",
            headers=runner.headers
        )
        assert d1.status_code == 204

        # Second cancellation of SAME occurrence (idempotency stress test)
        d2 = await runner.client.delete(
            f"/events/{m_id}?scope=this&occurrence_date={target_occ}",
            headers=runner.headers
        )
        assert d2.status_code == 204

        # Verify exactly 1 cancelled exception row exists in DB
        async with AsyncSessionLocal() as db:
            stmt = select(Event).where(
                Event.parent_event_id == m_id,
                Event.original_start == datetime.fromisoformat(target_occ)
            )
            rows = (await db.execute(stmt)).scalars().all()
            assert len(rows) == 1, f"Expected exactly 1 exception row, found {len(rows)}"
            assert rows[0].is_cancelled is True

    await runner.run_test(
        "test_adv_08_event_exception_idempotent_delete_this",
        "Exception & Series Split",
        test_adv_08_event_exception_idempotent_delete_this
    )

    async def test_adv_09_event_cascade_purge_scope_all():
        # Create master recurring event
        c_resp = await runner.client.post("/events", headers=runner.headers, json={
            "title": "Master To Purge Entirely",
            "start_at": "2026-11-01T09:00:00",
            "end_at": "2026-11-01T10:00:00",
            "recurrence_rule": "FREQ=DAILY"
        })
        m_id = unwrap(c_resp)["id"]

        # 1. Modify occurrence 1 (scope=this)
        await runner.client.put(f"/events/{m_id}", headers=runner.headers, json={
            "title": "Exception 1",
            "start_at": "2026-11-02T11:00:00",
            "original_start": "2026-11-02T09:00:00",
            "scope": "this"
        })
        # 2. Modify occurrence 2 (scope=this)
        await runner.client.put(f"/events/{m_id}", headers=runner.headers, json={
            "title": "Exception 2",
            "start_at": "2026-11-03T11:00:00",
            "original_start": "2026-11-03T09:00:00",
            "scope": "this"
        })
        # 3. Cancel occurrence 3 (scope=this)
        await runner.client.delete(
            f"/events/{m_id}?scope=this&occurrence_date=2026-11-04T09:00:00",
            headers=runner.headers
        )

        # Check DB count: 1 master + 3 children = 4
        async with AsyncSessionLocal() as db:
            stmt = select(func.count(Event.id)).where(
                (Event.id == m_id) | (Event.parent_event_id == m_id)
            )
            count = (await db.execute(stmt)).scalar()
            assert count == 4, f"Expected 4 rows before purge, got {count}"

        # Delete with scope="all"
        del_resp = await runner.client.delete(f"/events/{m_id}?scope=all", headers=runner.headers)
        assert del_resp.status_code == 204

        # Check DB count: must be 0 (0 orphaned child exceptions)
        async with AsyncSessionLocal() as db:
            stmt = select(func.count(Event.id)).where(
                (Event.id == m_id) | (Event.parent_event_id == m_id)
            )
            count_after = (await db.execute(stmt)).scalar()
            assert count_after == 0, f"Expected 0 rows after scope=all purge, got {count_after} (orphaned rows detected!)"

    await runner.run_test(
        "test_adv_09_event_cascade_purge_scope_all",
        "Exception & Series Split",
        test_adv_09_event_cascade_purge_scope_all
    )

    async def test_adv_10_event_delete_child_exception_directly():
        # Create recurring event
        c_resp = await runner.client.post("/events", headers=runner.headers, json={
            "title": "Master Series For Direct Child Delete",
            "start_at": "2026-11-10T10:00:00",
            "end_at": "2026-11-10T11:00:00",
            "recurrence_rule": "FREQ=DAILY"
        })
        m_id = unwrap(c_resp)["id"]

        # Create child exception
        exc_resp = await runner.client.put(f"/events/{m_id}", headers=runner.headers, json={
            "title": "Detached Child Instance",
            "start_at": "2026-11-11T14:00:00",
            "original_start": "2026-11-11T10:00:00",
            "scope": "this"
        })
        child_id = unwrap(exc_resp)["id"]
        assert child_id != m_id

        # Delete the child exception directly
        d_resp = await runner.client.delete(f"/events/{child_id}", headers=runner.headers)
        assert d_resp.status_code == 204

        # Verify child is deleted, master still exists
        async with AsyncSessionLocal() as db:
            child = (await db.execute(select(Event).where(Event.id == child_id))).scalars().first()
            master = (await db.execute(select(Event).where(Event.id == m_id))).scalars().first()
            assert child is None, "Child exception should be deleted"
            assert master is not None, "Master recurring series must remain alive"

    await runner.run_test(
        "test_adv_10_event_delete_child_exception_directly",
        "Exception & Series Split",
        test_adv_10_event_delete_child_exception_directly
    )

    # -----------------------------------------------------------------
    # SUITE 3: Task & Step Adversarial Hardening
    # -----------------------------------------------------------------
    print(f"\n{BOLD}--- Suite 3: Task & Step Adversarial Hardening ---{RESET}")

    async def test_adv_11_task_reorder_sparse_duplicates_and_nonexistent():
        # Create 3 tasks
        t1 = unwrap(await runner.client.post("/tasks", headers=runner.headers, json={"title": "Task 1"}))["id"]
        t2 = unwrap(await runner.client.post("/tasks", headers=runner.headers, json={"title": "Task 2"}))["id"]
        t3 = unwrap(await runner.client.post("/tasks", headers=runner.headers, json={"title": "Task 3"}))["id"]

        # Adversarial reorder: negative position, giant position, duplicate position, non-existent task ID (9999999)
        reorder_payload = {
            "items": [
                {"id": t1, "position": -100},
                {"id": t2, "position": 1000000},
                {"id": t3, "position": 1000000},
                {"id": 9999999, "position": 42}
            ]
        }
        resp = await runner.client.put("/tasks/reorder", headers=runner.headers, json=reorder_payload)
        assert resp.status_code in (200, 204), f"Reorder failed: {resp.text}"

        # Verify in DB
        async with AsyncSessionLocal() as db:
            o1 = (await db.execute(select(Task).where(Task.id == t1))).scalars().first()
            o2 = (await db.execute(select(Task).where(Task.id == t2))).scalars().first()
            o3 = (await db.execute(select(Task).where(Task.id == t3))).scalars().first()
            assert o1.position == -100
            assert o2.position == 1000000
            assert o3.position == 1000000

    await runner.run_test(
        "test_adv_11_task_reorder_sparse_duplicates_and_nonexistent",
        "Task & Steps Hardening",
        test_adv_11_task_reorder_sparse_duplicates_and_nonexistent
    )

    async def test_adv_12_task_reorder_cross_user_isolation():
        sec_client, sec_headers, sec_user_id = await runner.create_secondary_user()
        try:
            # User 1 creates task
            t1 = unwrap(await runner.client.post("/tasks", headers=runner.headers, json={"title": "User1 Task"}))["id"]
            # User 2 creates task
            t2 = unwrap(await sec_client.post("/tasks", headers=sec_headers, json={"title": "User2 Task"}))["id"]

            # User 2 attempts to maliciously reorder User 1's task
            malicious_reorder = {
                "items": [
                    {"id": t1, "position": 777},
                    {"id": t2, "position": 888}
                ]
            }
            await sec_client.put("/tasks/reorder", headers=sec_headers, json=malicious_reorder)

            # Verify User 1's task was NOT modified
            async with AsyncSessionLocal() as db:
                task_user1 = (await db.execute(select(Task).where(Task.id == t1))).scalars().first()
                task_user2 = (await db.execute(select(Task).where(Task.id == t2))).scalars().first()
                assert task_user1.position != 777, "Cross-user authorization bypass: User 2 modified User 1 task position!"
                assert task_user2.position == 888
        finally:
            await sec_client.aclose()

    await runner.run_test(
        "test_adv_12_task_reorder_cross_user_isolation",
        "Task & Steps Hardening",
        test_adv_12_task_reorder_cross_user_isolation
    )

    async def test_adv_13_task_recurrence_termination_count_one():
        # Recurring task with COUNT=1
        t_resp = await runner.client.post("/tasks", headers=runner.headers, json={
            "title": "Single Execution Recurring Task",
            "due_date": "2026-11-20",
            "recurrence_rule": "FREQ=DAILY;COUNT=1"
        })
        t_id = unwrap(t_resp)["id"]

        # Complete task
        await runner.client.patch(f"/tasks/{t_id}/complete", headers=runner.headers, json={"is_completed": True})

        # Check total tasks with title "Single Execution Recurring Task" - must remain exactly 1 (no new task generated)
        async with AsyncSessionLocal() as db:
            stmt = select(func.count(Task.id)).where(
                Task.user_id == runner.user_id,
                Task.title == "Single Execution Recurring Task"
            )
            count = (await db.execute(stmt)).scalar()
            assert count == 1, f"Expected 1 task (COUNT=1 exhausted), but found {count}"

    await runner.run_test(
        "test_adv_13_task_recurrence_termination_count_one",
        "Task & Steps Hardening",
        test_adv_13_task_recurrence_termination_count_one
    )

    async def test_adv_14_task_recurrence_termination_until_past():
        # Recurring task with UNTIL in the past
        t_resp = await runner.client.post("/tasks", headers=runner.headers, json={
            "title": "Expired Recurring Task",
            "due_date": "2026-11-20",
            "recurrence_rule": "FREQ=DAILY;UNTIL=20261101"
        })
        t_id = unwrap(t_resp)["id"]

        # Complete task
        await runner.client.patch(f"/tasks/{t_id}/complete", headers=runner.headers, json={"is_completed": True})

        # Verify no second task was created
        async with AsyncSessionLocal() as db:
            stmt = select(func.count(Task.id)).where(
                Task.user_id == runner.user_id,
                Task.title == "Expired Recurring Task"
            )
            count = (await db.execute(stmt)).scalar()
            assert count == 1, f"Expected 1 task (UNTIL expired), but found {count}"

    await runner.run_test(
        "test_adv_14_task_recurrence_termination_until_past",
        "Task & Steps Hardening",
        test_adv_14_task_recurrence_termination_until_past
    )

    async def test_adv_15_task_bulk_steps_and_extreme_payloads():
        # Create task with 30 steps containing Unicode, Vietnamese, emojis, special characters
        long_title = "Tiêu đề công việc kiểm tra giới hạn hệ thống ⭐⭐⭐"
        t_resp = await runner.client.post("/tasks", headers=runner.headers, json={
            "title": long_title,
            "note": "Ghi chú chứa ký tự đặc biệt: <script>console.log('test')</script> & ' \" --",
            "steps": [{"title": f"Bước {i}: Thử nghiệm bảo mật 🚀 #{i}"} for i in range(1, 31)]
        })
        assert t_resp.status_code in (200, 201), f"Bulk task creation failed: {t_resp.text}"
        task_data = unwrap(t_resp)
        t_id = task_data["id"]
        assert len(task_data["steps"]) == 30

        # Toggle first step complete via PATCH /{task_id}/steps/{step_id}/complete
        s1 = task_data["steps"][0]
        step_patch = await runner.client.patch(
            f"/tasks/{t_id}/steps/{s1['id']}/complete",
            headers=runner.headers,
            json={"is_completed": True}
        )
        assert step_patch.status_code == 200, f"Step toggle complete failed: {step_patch.text}"
        step_data = unwrap(step_patch)
        assert step_data["is_completed"] is True

        # Delete a step
        del_step = await runner.client.delete(f"/tasks/{t_id}/steps/{s1['id']}", headers=runner.headers)
        assert del_step.status_code == 204

    await runner.run_test(
        "test_adv_15_task_bulk_steps_and_extreme_payloads",
        "Task & Steps Hardening",
        test_adv_15_task_bulk_steps_and_extreme_payloads
    )

    # -----------------------------------------------------------------
    # SUITE 4: AI Tool Executor Adversarial Resilience & Scope
    # -----------------------------------------------------------------
    print(f"\n{BOLD}--- Suite 4: AI Tool Executor Adversarial Resilience & Scope ---{RESET}")

    async def test_adv_16_ai_tool_executor_unknown_and_corrupt_tools():
        async with AsyncSessionLocal() as db:
            executor = ToolExecutor(user_id=runner.user_id, db=db)
            # Call non-existent tool
            res_unknown = await executor.execute("unauthorized_admin_drop_db", {"confirm": True})
            assert res_unknown["success"] is False
            assert "không tồn tại" in res_unknown["error"]

            # Call create_event with malformed parameters (should not raise unhandled exception)
            res_bad_dt = await executor.execute("create_event", {
                "title": "Bad Date Event",
                "start_at": "totally-invalid-date-string"
            })
            assert res_bad_dt["success"] is False
            assert "error" in res_bad_dt

    await runner.run_test(
        "test_adv_16_ai_tool_executor_unknown_and_corrupt_tools",
        "AI Hardening & Guardrails",
        test_adv_16_ai_tool_executor_unknown_and_corrupt_tools
    )

    async def test_adv_17_ai_tool_executor_sql_and_xss_injection():
        async with AsyncSessionLocal() as db:
            executor = ToolExecutor(user_id=runner.user_id, db=db)
            # SQL injection test via tool executor
            sql_payload = "'; DROP TABLE tasks; --"
            res_sql = await executor.execute("create_task", {
                "title": sql_payload,
                "note": "<script>alert('pwned')</script>"
            })
            assert res_sql["success"] is True
            created_task_id = res_sql["data"]["id"]

            # Verify table still intact and record safely stored
            t = (await db.execute(select(Task).where(Task.id == created_task_id))).scalars().first()
            assert t is not None
            assert t.title == sql_payload
            assert t.note == "<script>alert('pwned')</script>"

    await runner.run_test(
        "test_adv_17_ai_tool_executor_sql_and_xss_injection",
        "AI Hardening & Guardrails",
        test_adv_17_ai_tool_executor_sql_and_xss_injection
    )

    async def test_adv_18_ai_conversation_cross_user_isolation():
        sec_client, sec_headers, sec_user_id = await runner.create_secondary_user()
        try:
            # User 1 creates conversation
            c1_resp = await runner.client.post("/ai/conversations", headers=runner.headers, json={"title": "Private User 1 Thread"})
            c1_id = unwrap(c1_resp)["id"]

            # User 2 attempts to fetch User 1's conversation
            get_resp = await sec_client.get(f"/ai/conversations/{c1_id}", headers=sec_headers)
            assert get_resp.status_code == 404, f"Expected 404 on cross-user conversation read, got {get_resp.status_code}"

            # User 2 attempts to inject message into User 1's conversation via /conversations/{id}/messages
            post_msg_resp = await sec_client.post(f"/ai/conversations/{c1_id}/messages", headers=sec_headers, json={
                "content": "Malicious Injection"
            })
            assert post_msg_resp.status_code == 404, f"Expected 404 on cross-user chat injection, got {post_msg_resp.status_code}"
        finally:
            await sec_client.aclose()

    await runner.run_test(
        "test_adv_18_ai_conversation_cross_user_isolation",
        "AI Hardening & Guardrails",
        test_adv_18_ai_conversation_cross_user_isolation
    )

    async def test_adv_19_ai_rate_limiting_enforcement():
        # Set Redis rate-limit counter directly to threshold
        if redis_client.redis:
            rkey = f"ratelimit:ai:{runner.user_id}"
            await redis_client.redis.set(rkey, 31, ex=60)
            try:
                r = await runner.client.post("/ai/chat", headers=runner.headers, json={
                    "content": "Ping rate limit test"
                })
                assert r.status_code == 429, f"Expected HTTP 429 Too Many Requests when counter > 30, got {r.status_code}"
            finally:
                await redis_client.redis.delete(rkey)
        else:
            print("  (Redis unavailable, skipping rate-limit test)")

    await runner.run_test(
        "test_adv_19_ai_rate_limiting_enforcement",
        "AI Hardening & Guardrails",
        test_adv_19_ai_rate_limiting_enforcement
    )

    # -----------------------------------------------------------------
    # SUITE 5: Concurrency, Collision & Race Conditions
    # -----------------------------------------------------------------
    print(f"\n{BOLD}--- Suite 5: Concurrency, Collision & Race Conditions ---{RESET}")

    async def test_adv_20_concurrent_task_creation_flood():
        # Fire 15 concurrent task creation requests
        async def make_task(i):
            return await runner.client.post("/tasks", headers=runner.headers, json={
                "title": f"Concurrent Task #{i}",
                "due_date": "2026-12-01",
                "is_important": (i % 2 == 0)
            })

        tasks_coros = [make_task(i) for i in range(15)]
        responses = await asyncio.gather(*tasks_coros)
        for r in responses:
            assert r.status_code in (200, 201), f"Concurrent task creation failed: {r.status_code} {r.text}"

    await runner.run_test(
        "test_adv_20_concurrent_task_creation_flood",
        "Concurrency & Contention",
        test_adv_20_concurrent_task_creation_flood
    )

    async def test_adv_21_concurrent_event_overlapping_grid():
        # Fire 15 concurrent events created on the exact same minute slot
        slot_start = "2026-12-05T14:00:00"
        slot_end = "2026-12-05T15:00:00"

        async def make_event(i):
            return await runner.client.post("/events", headers=runner.headers, json={
                "title": f"Overlapping Slot Event #{i}",
                "start_at": slot_start,
                "end_at": slot_end
            })

        event_coros = [make_event(i) for i in range(15)]
        responses = await asyncio.gather(*event_coros)
        for r in responses:
            assert r.status_code in (200, 201), f"Concurrent overlapping event creation failed: {r.status_code} {r.text}"

    await runner.run_test(
        "test_adv_21_concurrent_event_overlapping_grid",
        "Concurrency & Contention",
        test_adv_21_concurrent_event_overlapping_grid
    )

    async def test_adv_22_concurrent_recurring_task_toggle():
        # Create recurring task
        t_resp = await runner.client.post("/tasks", headers=runner.headers, json={
            "title": "Race Condition Recurring Task",
            "due_date": "2026-12-10",
            "recurrence_rule": "FREQ=DAILY;COUNT=5"
        })
        task_id = unwrap(t_resp)["id"]

        # Send 3 concurrent toggle requests
        async def toggle():
            return await runner.client.patch(
                f"/tasks/{task_id}/complete",
                headers=runner.headers,
                json={"is_completed": True}
            )

        resps = await asyncio.gather(toggle(), toggle(), toggle(), return_exceptions=True)
        # Verify no unhandled 500 error occurred
        for r in resps:
            if isinstance(r, httpx.Response):
                assert r.status_code in (200, 409), f"Unexpected status during concurrent toggle: {r.status_code}"

    await runner.run_test(
        "test_adv_22_concurrent_recurring_task_toggle",
        "Concurrency & Contention",
        test_adv_22_concurrent_recurring_task_toggle
    )

    # -----------------------------------------------------------------
    # SUITE 6: Frontend White-Box Algorithms Emulation
    # -----------------------------------------------------------------
    print(f"\n{BOLD}--- Suite 6: Frontend White-Box Algorithms Emulation ---{RESET}")

    async def test_adv_23_collision_packing_stress_emulation():
        # Emulate Week/Day view packCollidingEvents algorithm with 20 overlapping events
        def pack_colliding_events(items):
            if not items:
                return []
            sorted_items = sorted(
                items,
                key=lambda x: (
                    datetime.fromisoformat(x["start_at"]),
                    -(datetime.fromisoformat(x["end_at"]) - datetime.fromisoformat(x["start_at"])).total_seconds()
                )
            )
            clusters = []
            cur_cluster = []
            cur_cluster_end = None

            for it in sorted_items:
                s = datetime.fromisoformat(it["start_at"])
                e = datetime.fromisoformat(it["end_at"])
                if not cur_cluster:
                    cur_cluster.append(it)
                    cur_cluster_end = e
                elif s < cur_cluster_end:
                    cur_cluster.append(it)
                    if e > cur_cluster_end:
                        cur_cluster_end = e
                else:
                    clusters.append(cur_cluster)
                    cur_cluster = [it]
                    cur_cluster_end = e
            if cur_cluster:
                clusters.append(cur_cluster)

            packed = []
            for cl in clusters:
                cols = []
                for it in cl:
                    s = datetime.fromisoformat(it["start_at"])
                    placed = False
                    for c_idx, last_end in enumerate(cols):
                        if s >= last_end:
                            it["_col"] = c_idx
                            cols[c_idx] = datetime.fromisoformat(it["end_at"])
                            placed = True
                            break
                    if not placed:
                        it["_col"] = len(cols)
                        cols.append(datetime.fromisoformat(it["end_at"]))
                total_cols = max(1, len(cols))
                for it in cl:
                    it["_totalCols"] = total_cols
                    it["_colWidth"] = 100.0 / total_cols
                    it["_leftOffset"] = it["_col"] * it["_colWidth"]
                    packed.append(it)
            return packed

        # 20 overlapping items
        raw_items = [
            {
                "id": i,
                "start_at": f"2026-12-15T10:{i:02d}:00",
                "end_at": f"2026-12-15T11:{i:02d}:00"
            }
            for i in range(20)
        ]
        result = pack_colliding_events(raw_items)
        assert len(result) == 20
        for item in result:
            assert "_col" in item
            assert "_totalCols" in item
            assert item["_totalCols"] > 1
            assert item["_colWidth"] <= 50.0
            assert 0.0 <= item["_leftOffset"] <= 100.0

    await runner.run_test(
        "test_adv_23_collision_packing_stress_emulation",
        "Frontend Algorithms",
        test_adv_23_collision_packing_stress_emulation
    )

    async def test_adv_24_agenda_view_window_emulation():
        # AgendaView 30-day window filtering emulation
        start_day = datetime(2026, 6, 1, 0, 0, 0)
        end_day = datetime(2026, 6, 30, 23, 59, 59, 999000)

        # 100 events: 30 before start_day, 40 within window, 30 after end_day
        events = []
        for d_offset in range(-30, 70):
            dt = start_day + timedelta(days=d_offset, hours=10)
            events.append({
                "id": d_offset,
                "title": f"Event {d_offset}",
                "start_at": dt.isoformat(),
                "end_at": (dt + timedelta(hours=1)).isoformat()
            })

        # Filter like AgendaView
        in_range = [
            e for e in events
            if start_day <= datetime.fromisoformat(e["start_at"]) <= end_day
        ]
        # Should be exactly 30 days (offset 0 to 29)
        assert len(in_range) == 30, f"Expected 30 events in Agenda window, got {len(in_range)}"

    await runner.run_test(
        "test_adv_24_agenda_view_window_emulation",
        "Frontend Algorithms",
        test_adv_24_agenda_view_window_emulation
    )

    async def test_adv_25_rrule_corrupted_parser_emulation():
        # Python mirror of RRuleParser.parse
        def rrule_parse(rrule_str):
            if not rrule_str:
                return None
            parts = rrule_str.split(";")
            rule = {"freq": None, "interval": 1, "byday": None, "count": None, "until": None}
            for part in parts:
                if "=" not in part:
                    continue
                k, v = part.split("=", 1)
                k = k.strip().upper()
                v = v.strip().upper()
                if k == "FREQ":
                    rule["freq"] = v
                elif k == "INTERVAL":
                    try:
                        rule["interval"] = int(v) or 1
                    except Exception:
                        rule["interval"] = 1
                elif k == "COUNT":
                    try:
                        rule["count"] = int(v)
                    except Exception:
                        pass
            return rule if rule["freq"] else None

        assert rrule_parse("") is None
        assert rrule_parse(";;;;;") is None
        assert rrule_parse("FREQ=") is None
        p1 = rrule_parse("FREQ=WEEKLY;INTERVAL=invalid;COUNT=foo")
        assert p1["freq"] == "WEEKLY"
        assert p1["interval"] == 1
        assert p1["count"] is None

    await runner.run_test(
        "test_adv_25_rrule_corrupted_parser_emulation",
        "Frontend Algorithms",
        test_adv_25_rrule_corrupted_parser_emulation
    )

    # -----------------------------------------------------------------
    # SUMMARY & TEARDOWN
    # -----------------------------------------------------------------
    await runner.close()

    total = len(runner.results)
    passed = sum(1 for r in runner.results if r.passed)
    failed = sum(1 for r in runner.results if not r.passed)

    print(f"\n{BOLD}{CYAN}====================================================================={RESET}")
    print(f"{BOLD}{CYAN}   TIER 5 ADVERSARIAL HARDENING SUMMARY                              {RESET}")
    print(f"{BOLD}{CYAN}====================================================================={RESET}")
    print(f"   Total Adversarial Scenarios : {total}")
    print(f"   Passed                      : {GREEN}{passed}{RESET}")
    print(f"   Failed                      : {RED}{failed}{RESET}")
    print(f"   Pass Rate                   : {GREEN}{passed/total*100:.1f}%{RESET}")
    print(f"{CYAN}---------------------------------------------------------------------{RESET}")

    # Output JSON report
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total": total,
        "passed": passed,
        "failed": failed,
        "pass_rate_pct": round(passed / total * 100, 2),
        "results": [
            {
                "name": r.name,
                "category": r.category,
                "passed": r.passed,
                "duration_ms": round(r.duration_ms, 2),
                "error": r.error
            }
            for r in runner.results
        ]
    }
    with open("tests/tier5_adversarial_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"[OK] Report written to tests/tier5_adversarial_report.json\n")

    if failed > 0:
        sys.exit(1)
    else:
        print(f"{BOLD}{GREEN}[VERDICT: APPROVE] Tier 5 Hardening Passed with 100% Reliability!{RESET}\n")
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
