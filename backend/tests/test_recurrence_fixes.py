"""
Recurrence Engine & Exception Handling Verification Suite
Milestone M1 Verification:
1. Month-end & leap-year date math overflow fixes (Jan 31 -> Feb 28/29, Feb 29 -> Feb 28, INTERVAL, BYDAY, COUNT, UNTIL)
2. Recurring task completion cycle generation with clamped dates and limit enforcement
3. Task position updates and reorder persistence to PostgreSQL
4. Recurring event exception handling (scope="this" creates exception without altering master start)
5. Recurring event series split (scope="following" caps master recurrence_end and starts new series)
6. Recurring event single-instance deletion (scope="this" creates cancelled exception, preserving master series)
7. Recurring event full deletion (scope="all" deletes master series and cascades)
"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import httpx
from datetime import datetime, date, timedelta
from app.services.task_service import task_service

BASE_URL = "http://localhost:8000/api/v1"

def unwrap(res):
    j = res.json()
    if isinstance(j, dict) and "data" in j and len(j) <= 3:
        return j["data"]
    return j

def run_unit_tests():
    print("[*] Running Unit Tests for Recurrence Math...")

    # 1. Jan 31 + FREQ=MONTHLY -> Feb 28 (non-leap year)
    d1 = task_service._calculate_next_due_date(date(2026, 1, 31), "FREQ=MONTHLY")
    assert d1 == date(2026, 2, 28), f"Expected 2026-02-28, got {d1}"
    print("   [OK] Jan 31 non-leap year -> Feb 28 clamped successfully")

    # 2. Jan 31 + FREQ=MONTHLY -> Feb 29 (leap year 2024)
    d2 = task_service._calculate_next_due_date(date(2024, 1, 31), "FREQ=MONTHLY")
    assert d2 == date(2024, 2, 29), f"Expected 2024-02-29, got {d2}"
    print("   [OK] Jan 31 leap year 2024 -> Feb 29 clamped successfully")

    # 3. Mar 31 + FREQ=MONTHLY -> Apr 30
    d3 = task_service._calculate_next_due_date(date(2026, 3, 31), "FREQ=MONTHLY")
    assert d3 == date(2026, 4, 30), f"Expected 2026-04-30, got {d3}"
    print("   [OK] Mar 31 -> Apr 30 clamped successfully")

    # 4. Feb 29 (leap year 2024) + FREQ=YEARLY -> Feb 28, 2025
    d4 = task_service._calculate_next_due_date(date(2024, 2, 29), "FREQ=YEARLY")
    assert d4 == date(2025, 2, 28), f"Expected 2025-02-28, got {d4}"
    print("   [OK] Feb 29 leap year -> Feb 28 next year clamped successfully")

    # 5. Feb 29 (leap year 2024) + FREQ=YEARLY;INTERVAL=4 -> Feb 29, 2028
    d5 = task_service._calculate_next_due_date(date(2024, 2, 29), "FREQ=YEARLY;INTERVAL=4")
    assert d5 == date(2028, 2, 29), f"Expected 2028-02-29, got {d5}"
    print("   [OK] Feb 29 + INTERVAL=4 -> Feb 29, 2028 successfully")

    # 6. INTERVAL=2 with FREQ=WEEKLY -> 14 days
    d6 = task_service._calculate_next_due_date(date(2026, 11, 1), "FREQ=WEEKLY;INTERVAL=2")
    assert d6 == date(2026, 11, 15), f"Expected 2026-11-15, got {d6}"
    print("   [OK] FREQ=WEEKLY;INTERVAL=2 advances by 14 days")

    # 7. BYDAY: Monday Nov 2, 2026 + BYDAY=MO,WE,FR -> Wednesday Nov 4, 2026
    d7 = task_service._calculate_next_due_date(date(2026, 11, 2), "FREQ=WEEKLY;BYDAY=MO,WE,FR")
    assert d7 == date(2026, 11, 4), f"Expected 2026-11-04, got {d7}"
    print("   [OK] BYDAY=MO,WE,FR advances within week (Mon -> Wed)")

    # 8. BYDAY: Friday Nov 6, 2026 + BYDAY=MO,WE,FR -> Monday Nov 9, 2026
    d8 = task_service._calculate_next_due_date(date(2026, 11, 6), "FREQ=WEEKLY;BYDAY=MO,WE,FR")
    assert d8 == date(2026, 11, 9), f"Expected 2026-11-09, got {d8}"
    print("   [OK] BYDAY=MO,WE,FR advances to next week (Fri -> Mon)")

    # 9. COUNT limit: COUNT=1 returns None
    d9 = task_service._calculate_next_due_date(date(2026, 11, 2), "FREQ=DAILY;COUNT=1")
    assert d9 is None, f"Expected None for COUNT=1, got {d9}"
    print("   [OK] COUNT=1 returns None (last occurrence)")

    # 10. UNTIL limit: UNTIL passed returns None
    d10 = task_service._calculate_next_due_date(date(2026, 11, 2), "FREQ=DAILY;UNTIL=20261102")
    assert d10 is None, f"Expected None for passed UNTIL, got {d10}"
    print("   [OK] UNTIL passed returns None")

    # 11. Astronomical INTERVAL clamping: INTERVAL=9999999999999999999999999 clamped to 1000
    d11 = task_service._calculate_next_due_date(date(2026, 1, 1), "FREQ=DAILY;INTERVAL=9999999999999999999999999")
    assert d11 == date(2026, 1, 1) + timedelta(days=1000), f"Expected +1000 days, got {d11}"
    print("   [OK] Astronomical INTERVAL safely clamped to 1000 without OverflowError")

    # 12. Year > 9999 protection returns None
    d12 = task_service._calculate_next_due_date(date(9500, 1, 1), "FREQ=YEARLY;INTERVAL=1000")
    assert d12 is None, f"Expected None for year > 9999, got {d12}"
    print("   [OK] Year > 9999 gracefully returns None without ValueError or 500")

    # 13. Malformed INTERVAL fallback to 1
    d13 = task_service._calculate_next_due_date(date(2026, 1, 1), "FREQ=DAILY;INTERVAL=invalid_interval")
    assert d13 == date(2026, 1, 2), f"Expected 2026-01-02, got {d13}"
    print("   [OK] Malformed INTERVAL gracefully defaults to interval=1")

    print("🎉 All Unit Tests Passed 100%!\n")

async def test_integration():
    print("[*] Running Integration Tests via HTTP API...")
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Register and login unique user
        uid = int(datetime.now().timestamp())
        email = f"recur_user_{uid}@example.com"
        pwd = "RecurrencePass123!"

        reg = await client.post("/users/register", json={
            "email": email,
            "nickname": "Recurrence Tester",
            "password": pwd
        })
        assert reg.status_code == 201, reg.text

        login = await client.post("/auth/login", data={"username": email, "password": pwd})
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # ---------------------------------------------------------
        # Check 1: Recurring Task Month-End Clamping in Live Flow
        # ---------------------------------------------------------
        print("[*] 1. Live Task Month-End Recurrence (Jan 31 -> Feb 28)...")
        task_res = await client.post("/tasks", json={
            "title": "Báo cáo tài chính tháng",
            "due_date": "2026-01-31",
            "recurrence_rule": "FREQ=MONTHLY"
        }, headers=headers)
        assert task_res.status_code == 201, task_res.text
        task_jan = unwrap(task_res)

        complete_res = await client.patch(f"/tasks/{task_jan['id']}/complete", json={
            "is_completed": True
        }, headers=headers)
        assert complete_res.status_code == 200

        all_tasks = unwrap(await client.get("/tasks", headers=headers))
        task_feb = next((t for t in all_tasks if t["title"] == "Báo cáo tài chính tháng" and not t["is_completed"]), None)
        assert task_feb is not None, "Next monthly task cycle was not created!"
        assert task_feb["due_date"] == "2026-02-28", f"Expected 2026-02-28, got {task_feb['due_date']}"
        print(f"   [OK] Task next due date correctly clamped to: {task_feb['due_date']}")

        # ---------------------------------------------------------
        # Check 2: Task COUNT Limit Live Flow
        # ---------------------------------------------------------
        print("[*] 2. Live Task Recurrence COUNT Limit...")
        task_cnt = unwrap(await client.post("/tasks", json={
            "title": "Uống thuốc theo toa 2 ngày",
            "due_date": "2026-11-01",
            "recurrence_rule": "FREQ=DAILY;COUNT=2"
        }, headers=headers))

        # Complete 1st occurrence -> should spawn 2nd occurrence with COUNT=1
        await client.patch(f"/tasks/{task_cnt['id']}/complete", json={"is_completed": True}, headers=headers)
        tasks_list = unwrap(await client.get("/tasks", headers=headers))
        task_cnt2 = next((t for t in tasks_list if t["title"] == "Uống thuốc theo toa 2 ngày" and not t["is_completed"]), None)
        assert task_cnt2 is not None, "Second occurrence was not spawned!"
        assert "COUNT=1" in task_cnt2["recurrence_rule"], f"Expected COUNT=1 in {task_cnt2['recurrence_rule']}"

        # Complete 2nd occurrence -> COUNT=1, so NO 3rd occurrence should be spawned
        await client.patch(f"/tasks/{task_cnt2['id']}/complete", json={"is_completed": True}, headers=headers)
        tasks_list_after = unwrap(await client.get("/tasks", headers=headers))
        task_cnt3 = next((t for t in tasks_list_after if t["title"] == "Uống thuốc theo toa 2 ngày" and not t["is_completed"]), None)
        assert task_cnt3 is None, "Recurrence did not terminate after COUNT reached!"
        print("   [OK] COUNT limit successfully terminated task series after 2 cycles")

        # ---------------------------------------------------------
        # Check 3: Task Position Updates & Reorder Persistence
        # ---------------------------------------------------------
        print("[*] 3. Task Position Updates & Persistence...")
        t1 = unwrap(await client.post("/tasks", json={"title": "Task One"}, headers=headers))
        t2 = unwrap(await client.post("/tasks", json={"title": "Task Two"}, headers=headers))

        # Update via PUT /tasks/{id}
        put_res = await client.put(f"/tasks/{t1['id']}", json={"position": 10}, headers=headers)
        assert put_res.status_code == 200, put_res.text
        assert unwrap(put_res)["position"] == 10

        # Update via PATCH /tasks/{id}/position
        patch_res = await client.patch(f"/tasks/{t2['id']}/position", json={"position": 5}, headers=headers)
        assert patch_res.status_code == 200, patch_res.text
        assert unwrap(patch_res)["position"] == 5

        # Reorder via PUT /tasks/reorder
        reorder_res = await client.put("/tasks/reorder", json={
            "items": [
                {"id": t1["id"], "position": 1},
                {"id": t2["id"], "position": 2}
            ]
        }, headers=headers)
        assert reorder_res.status_code == 204

        # Verify ordering in GET /tasks
        tasks_ordered = unwrap(await client.get("/tasks", headers=headers))
        pos_t1 = next(t["position"] for t in tasks_ordered if t["id"] == t1["id"])
        pos_t2 = next(t["position"] for t in tasks_ordered if t["id"] == t2["id"])
        assert pos_t1 == 1 and pos_t2 == 2, f"Reorder did not persist! t1={pos_t1}, t2={pos_t2}"
        print("   [OK] Task positions persisted and returned in correct order")

        # ---------------------------------------------------------
        # Check 4: Recurring Event Exception Update (scope="this")
        # ---------------------------------------------------------
        print("[*] 4. Recurring Event Exception (scope='this')...")
        ev_start = "2026-11-02T09:00:00"
        ev_end = "2026-11-02T10:00:00"
        master_res = await client.post("/events", json={
            "title": "Họp phòng ban hàng tuần",
            "start_at": ev_start,
            "end_at": ev_end,
            "recurrence_rule": "FREQ=WEEKLY"
        }, headers=headers)
        assert master_res.status_code == 201, master_res.text
        master_ev = unwrap(master_res)
        master_id = master_ev["id"]

        # Update occurrence on Nov 9 with scope="this"
        inst_original_start = "2026-11-09T09:00:00"
        inst_new_start = "2026-11-09T14:00:00"
        inst_new_end = "2026-11-09T15:00:00"

        upd_this_res = await client.put(f"/events/{master_id}", json={
            "title": "Họp phòng ban (đổi giờ chiều)",
            "start_at": inst_new_start,
            "end_at": inst_new_end,
            "original_start": inst_original_start,
            "scope": "this"
        }, headers=headers)
        assert upd_this_res.status_code == 200, upd_this_res.text
        exc_ev = unwrap(upd_this_res)

        assert exc_ev["is_exception"] is True, "Event is not marked as exception!"
        assert exc_ev["parent_event_id"] == master_id, f"Expected parent_event_id {master_id}, got {exc_ev['parent_event_id']}"
        assert exc_ev["title"] == "Họp phòng ban (đổi giờ chiều)"
        assert "14:00:00" in exc_ev["start_at"]
        assert "09:00:00" in exc_ev["original_start"]

        # Verify master event is UNCHANGED
        master_check = unwrap(await client.get(f"/events/{master_id}", headers=headers))
        assert master_check["title"] == "Họp phòng ban hàng tuần"
        assert "09:00:00" in master_check["start_at"]
        print(f"   [OK] Exception created (ID {exc_ev['id']}) while preserving master event (ID {master_id})")

        # ---------------------------------------------------------
        # Check 5: Recurring Event Series Split (scope="following")
        # ---------------------------------------------------------
        print("[*] 5. Recurring Event Series Split (scope='following')...")
        ev2_res = await client.post("/events", json={
            "title": "Standup hàng ngày",
            "start_at": "2026-11-01T08:30:00",
            "end_at": "2026-11-01T09:00:00",
            "recurrence_rule": "FREQ=DAILY"
        }, headers=headers)
        ev2_master = unwrap(ev2_res)
        ev2_id = ev2_master["id"]

        # Split series starting at Nov 10
        split_date = "2026-11-10T08:30:00"
        split_res = await client.put(f"/events/{ev2_id}", json={
            "title": "Standup chuyển sang 08:45",
            "start_at": "2026-11-10T08:45:00",
            "end_at": "2026-11-10T09:15:00",
            "original_start": split_date,
            "scope": "following"
        }, headers=headers)
        assert split_res.status_code == 200, split_res.text
        new_series = unwrap(split_res)

        assert new_series["title"] == "Standup chuyển sang 08:45"
        assert "08:45:00" in new_series["start_at"]
        assert new_series["is_exception"] is False
        assert new_series["parent_event_id"] is None

        # Verify old series recurrence_end was capped
        ev2_capped = unwrap(await client.get(f"/events/{ev2_id}", headers=headers))
        assert ev2_capped["recurrence_end"] is not None, "Parent series recurrence_end was not capped!"
        print(f"   [OK] Series split: Parent {ev2_id} capped at {ev2_capped['recurrence_end']}, new series {new_series['id']} started")

        # ---------------------------------------------------------
        # Check 6: Recurring Event Delete Single Instance (scope="this")
        # ---------------------------------------------------------
        print("[*] 6. Recurring Event Delete Single Instance (scope='this') with occurrence_date & alias...")
        ev3_res = await client.post("/events", json={
            "title": "Lớp học Ngoại ngữ",
            "start_at": "2026-11-05T18:00:00",
            "end_at": "2026-11-05T19:30:00",
            "recurrence_rule": "FREQ=WEEKLY"
        }, headers=headers)
        ev3_master = unwrap(ev3_res)
        ev3_id = ev3_master["id"]

        # 6a. Delete occurrence on 2026-11-19 via occurrence_date query param
        target_occ1 = "2026-11-19T18:00:00"
        del_this_res = await client.delete(f"/events/{ev3_id}?scope=this&occurrence_date={target_occ1}", headers=headers)
        assert del_this_res.status_code == 204

        # Master event MUST STILL EXIST
        master_still_exists = await client.get(f"/events/{ev3_id}", headers=headers)
        assert master_still_exists.status_code == 200, "Master event was wrongly deleted by scope='this'!"

        from app.core.database import AsyncSessionLocal
        from app.models.event_model import Event
        from sqlalchemy.future import select

        async with AsyncSessionLocal() as db_session:
            stmt = select(Event).where(Event.parent_event_id == ev3_id, Event.is_cancelled == True)
            cancelled_rows = (await db_session.execute(stmt)).scalars().all()
            assert len(cancelled_rows) == 1, f"Expected 1 cancelled exception, got {len(cancelled_rows)}"
            assert cancelled_rows[0].is_exception is True
            orig_str = cancelled_rows[0].original_start.isoformat()
            assert "2026-11-19" in orig_str and "18:00:00" in orig_str, f"Wrong original_start: {orig_str}"
            tombstone1_id = cancelled_rows[0].id
            print(f"   [OK] Master {ev3_id} preserved; cancelled exception ID {tombstone1_id} recorded for original_start={orig_str}")

        # 6b. Delete occurrence on 2026-11-26 via original_start alias query param
        target_occ2 = "2026-11-26T18:00:00"
        del_alias_res = await client.delete(f"/events/{ev3_id}?scope=this&original_start={target_occ2}", headers=headers)
        assert del_alias_res.status_code == 204

        async with AsyncSessionLocal() as db_session:
            stmt = select(Event).where(Event.parent_event_id == ev3_id, Event.is_cancelled == True).order_by(Event.id.asc())
            cancelled_rows = (await db_session.execute(stmt)).scalars().all()
            assert len(cancelled_rows) == 2, f"Expected 2 cancelled exceptions, got {len(cancelled_rows)}"
            orig2_str = cancelled_rows[1].original_start.isoformat()
            assert "2026-11-26" in orig2_str and "18:00:00" in orig2_str, f"Wrong original_start for alias: {orig2_str}"
            tombstone2_id = cancelled_rows[1].id
            print(f"   [OK] original_start alias accepted; cancelled exception ID {tombstone2_id} recorded for {orig2_str}")

        # 6c. Verify GET /events range query returns the cancelled exception tombstones
        range_res = await client.get("/events?start=2026-11-15T00:00:00&end=2026-11-30T23:59:59", headers=headers)
        assert range_res.status_code == 200, range_res.text
        events_in_range = unwrap(range_res)
        tombstones_found = [e for e in events_in_range if e.get("parent_event_id") == ev3_id and e.get("is_cancelled") is True]
        assert len(tombstones_found) == 2, f"Expected 2 tombstones in GET /events range query, found {len(tombstones_found)}"
        print(f"   [OK] GET /events range query successfully returned {len(tombstones_found)} cancelled exception tombstones for client RRULE suppression")

        # 6d. Create a rescheduled instance (scope='this' via PUT) to also test non-cancelled exception
        resched_res = await client.put(f"/events/{ev3_id}", json={
            "title": "Lớp học Ngoại ngữ (Đổi giờ)",
            "start_at": "2026-12-03T19:00:00",
            "end_at": "2026-12-03T20:30:00",
            "original_start": "2026-12-03T18:00:00",
            "scope": "this"
        }, headers=headers)
        assert resched_res.status_code == 200
        resched_exc = unwrap(resched_res)
        resched_exc_id = resched_exc["id"]
        assert resched_exc["is_exception"] is True
        print(f"   [OK] Rescheduled exception ID {resched_exc_id} created")

        # ---------------------------------------------------------
        # Check 7: Event Delete All (scope="all") Cascading
        # ---------------------------------------------------------
        print("[*] 7. Event Delete All (scope='all') Cascading...")
        del_all_res = await client.delete(f"/events/{ev3_id}?scope=all", headers=headers)
        assert del_all_res.status_code == 204

        master_gone = await client.get(f"/events/{ev3_id}", headers=headers)
        assert master_gone.status_code == 404, "Master event was not deleted by scope='all'!"

        # Confirm 0 lingering exception rows in DB for this parent
        async with AsyncSessionLocal() as db_session:
            stmt = select(Event).where(
                (Event.parent_event_id == ev3_id) | (Event.id.in_([tombstone1_id, tombstone2_id, resched_exc_id]))
            )
            lingering = (await db_session.execute(stmt)).scalars().all()
            assert len(lingering) == 0, f"Defect 2 failed: Found {len(lingering)} lingering exception rows in DB: {[r.id for r in lingering]}"
            print(f"   [OK] Verified 0 lingering exception rows in DB after scope='all' delete (no ghost events)")

        print("🎉 ALL INTEGRATION TESTS PASSED 100%!")

async def main():
    run_unit_tests()
    await test_integration()

if __name__ == "__main__":
    asyncio.run(main())
