import asyncio
import sys
import uuid
from datetime import datetime, timedelta
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"

def unwrap(response: httpx.Response):
    data = response.json()
    if isinstance(data, dict) and "data" in data and "code" in data:
        return data["data"]
    return data

async def run_probes():
    print("======================================================================")
    print("EMPIRICAL CHALLENGER PROBES: EVENT RECURRENCE & TASK POSITION ORDERING")
    print("======================================================================")
    
    findings = []
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # 1. Register test user
        uid = uuid.uuid4().hex[:8]
        email = f"challenger_{uid}@example.com"
        password = "Password123!"
        
        reg_res = await client.post("/users/register", json={
            "email": email,
            "password": password,
            "nickname": "Challenger Prober"
        })
        assert reg_res.status_code == 201, f"Register failed: {reg_res.text}"
        
        login_res = await client.post("/auth/login", data={
            "username": email,
            "password": password
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"[*] Authenticated as {email}")
        
        # ------------------------------------------------------------------
        # PROBE 1: Create a recurring event series (10 occurrences)
        # ------------------------------------------------------------------
        print("\n--- PROBE 1: Create Recurring Event (10 occurrences) ---")
        ev_start = "2026-11-01T10:00:00"
        ev_end = "2026-11-01T11:00:00"
        create_res = await client.post("/events", json={
            "title": "Daily Standup 10 Days",
            "start_at": ev_start,
            "end_at": ev_end,
            "recurrence_rule": "FREQ=DAILY;COUNT=10"
        }, headers=headers)
        assert create_res.status_code == 201, f"Failed to create event: {create_res.text}"
        master_ev = unwrap(create_res)
        master_id = master_ev["id"]
        print(f"[+] Master event created: ID={master_id}, start_at={master_ev['start_at']}, recurrence={master_ev['recurrence_rule']}")
        
        # ------------------------------------------------------------------
        # PROBE 2: Delete instance 3 (scope="this")
        # Instance 3 is 2026-11-03T10:00:00
        # ------------------------------------------------------------------
        print("\n--- PROBE 2: Delete Instance 3 (scope='this') ---")
        inst3_date_str = "2026-11-03T10:00:00"
        
        # Attempt via DELETE endpoint with occurrence_date query param
        del_res = await client.delete(
            f"/events/{master_id}?scope=this&occurrence_date={inst3_date_str}",
            headers=headers
        )
        print(f"[DEBUG] DELETE /events/{master_id}?scope=this&occurrence_date={inst3_date_str} -> status {del_res.status_code}")
        
        # Check DB directly to see what exception row was recorded
        from app.core.database import AsyncSessionLocal
        from app.models.event_model import Event
        from sqlalchemy.future import select
        
        async with AsyncSessionLocal() as db_session:
            stmt = select(Event).where(Event.parent_event_id == master_id)
            rows = (await db_session.execute(stmt)).scalars().all()
            print(f"[DEBUG] Found {len(rows)} exception rows in DB for parent {master_id}")
            for r in rows:
                print(f"       Exception row: id={r.id}, is_cancelled={r.is_cancelled}, is_exception={r.is_exception}, start_at={r.start_at}, original_start={r.original_start}")
                
            if len(rows) == 0:
                findings.append("PROBE 2 FAILURE: No cancelled exception row was created on DELETE with scope='this'.")
            else:
                target_row = rows[-1]
                orig_start_str = target_row.original_start.isoformat() if target_row.original_start else ""
                start_at_str = target_row.start_at.isoformat() if target_row.start_at else ""
                print(f"[+] Target cancelled row original_start: {orig_start_str}")
                
                # Check whether instance 3 (2026-11-03) was cancelled or if instance 1 (2026-11-01) was cancelled
                if "2026-11-03" in orig_start_str or "2026-11-03" in start_at_str:
                    print("   [PASS] Instance 3 successfully cancelled with correct original_start!")
                else:
                    msg = (
                        f"PROBE 2 BUG: DELETE /events/{master_id}?scope=this&occurrence_date={inst3_date_str} "
                        f"failed to pass occurrence_date to backend logic! Exception row was created for "
                        f"original_start={orig_start_str} (Instance 1) instead of Instance 3 (2026-11-03)."
                    )
                    print(f"   [FAIL] {msg}")
                    findings.append(msg)
                    
        # Also test if original_start param is supported on DELETE
        del_orig_res = await client.delete(
            f"/events/{master_id}?scope=this&original_start={inst3_date_str}",
            headers=headers
        )
        print(f"[DEBUG] DELETE /events/{master_id}?scope=this&original_start={inst3_date_str} -> status {del_orig_res.status_code}")
        async with AsyncSessionLocal() as db_session:
            stmt = select(Event).where(Event.parent_event_id == master_id)
            rows = (await db_session.execute(stmt)).scalars().all()
            print(f"[DEBUG] Now found {len(rows)} exception rows in DB for parent {master_id}")
            for r in rows:
                print(f"       Exception row: id={r.id}, is_cancelled={r.is_cancelled}, original_start={r.original_start}")
                
        # Compare with PUT /events/{master_id} with is_cancelled=True
        print("\n[*] Comparing DELETE behavior with PUT /events/{id} with is_cancelled=True...")
        put_cancel_res = await client.put(f"/events/{master_id}", json={
            "is_cancelled": True,
            "original_start": inst3_date_str,
            "scope": "this"
        }, headers=headers)
        print(f"[DEBUG] PUT /events/{master_id} with is_cancelled=True -> status {put_cancel_res.status_code}")
        if put_cancel_res.status_code == 200:
            put_exc = unwrap(put_cancel_res)
            print(f"       PUT created exception: id={put_exc['id']}, is_cancelled={put_exc['is_cancelled']}, original_start={put_exc['original_start']}")
            if "2026-11-03" in str(put_exc.get("original_start")):
                print("   [NOTE] PUT /events/{id} correctly accepts original_start, but DELETE /events/{id} fails to accept occurrence_date/original_start!")
                
        # Confirm master still exists
        master_check = await client.get(f"/events/{master_id}", headers=headers)
        assert master_check.status_code == 200, "Master event was deleted by scope='this'!"
        print("   [PASS] Master series preserved.")

        # ------------------------------------------------------------------
        # PROBE 3: Update instance 5 with custom title and time (scope="this")
        # Instance 5 is 2026-11-05T10:00:00
        # ------------------------------------------------------------------
        print("\n--- PROBE 3: Update Instance 5 (scope='this') ---")
        inst5_orig = "2026-11-05T10:00:00"
        inst5_new_start = "2026-11-05T14:30:00"
        inst5_new_end = "2026-11-05T15:30:00"
        inst5_title = "Instance 5 Rescheduled Afternoon"
        
        upd_res = await client.put(f"/events/{master_id}", json={
            "title": inst5_title,
            "start_at": inst5_new_start,
            "end_at": inst5_new_end,
            "original_start": inst5_orig,
            "scope": "this"
        }, headers=headers)
        assert upd_res.status_code == 200, f"Update instance 5 failed: {upd_res.text}"
        exc5 = unwrap(upd_res)
        print(f"[+] Update instance 5 returned: ID={exc5['id']}, title='{exc5['title']}', start_at={exc5['start_at']}, orig={exc5.get('original_start')}")
        
        assert exc5["is_exception"] is True, "Instance 5 is not marked as exception!"
        assert exc5["parent_event_id"] == master_id, "parent_event_id mismatch!"
        assert exc5["title"] == inst5_title
        assert "14:30" in exc5["start_at"]
        assert "2026-11-05" in exc5["original_start"]
        
        # Confirm master untouched
        master_after_upd = unwrap(await client.get(f"/events/{master_id}", headers=headers))
        assert master_after_upd["title"] == "Daily Standup 10 Days"
        assert "10:00:00" in master_after_upd["start_at"]
        print("   [PASS] Instance 5 exception created, master event untouched.")

        # ------------------------------------------------------------------
        # PROBE 4: Split series at instance 7 (scope="following")
        # Instance 7 is 2026-11-07T10:00:00
        # ------------------------------------------------------------------
        print("\n--- PROBE 4: Series Split at Instance 7 (scope='following') ---")
        inst7_orig = "2026-11-07T10:00:00"
        inst7_new_start = "2026-11-07T11:00:00"
        inst7_new_end = "2026-11-07T12:00:00"
        split_title = "Standup Day 7 onwards (delayed)"
        
        split_res = await client.put(f"/events/{master_id}", json={
            "title": split_title,
            "start_at": inst7_new_start,
            "end_at": inst7_new_end,
            "original_start": inst7_orig,
            "scope": "following"
        }, headers=headers)
        assert split_res.status_code == 200, f"Series split failed: {split_res.text}"
        new_series = unwrap(split_res)
        print(f"[+] New series returned: ID={new_series['id']}, title='{new_series['title']}', start_at={new_series['start_at']}")
        
        assert new_series["id"] != master_id
        assert new_series["is_exception"] is False
        assert new_series["parent_event_id"] is None
        assert "11:00:00" in new_series["start_at"]
        
        # Verify parent master recurrence_end capped
        master_after_split = unwrap(await client.get(f"/events/{master_id}", headers=headers))
        rec_end = master_after_split["recurrence_end"]
        print(f"[+] Parent series recurrence_end: {rec_end}")
        assert rec_end is not None, "Parent recurrence_end was NOT capped!"
        assert "2026-11-07" in rec_end, f"Parent recurrence_end expected around 2026-11-07, got {rec_end}"
        print("   [PASS] Series split capped parent recurrence_end and created new series.")

        # Test DELETE scope="following" behavior
        print("\n--- PROBE 4B: Series Cutoff via DELETE (scope='following') ---")
        # Create another event to test DELETE scope='following'
        ev_test_split = unwrap(await client.post("/events", json={
            "title": "Daily Standup For Delete Following",
            "start_at": "2026-11-01T08:00:00",
            "end_at": "2026-11-01T09:00:00",
            "recurrence_rule": "FREQ=DAILY;COUNT=10"
        }, headers=headers))
        del_foll_id = ev_test_split["id"]
        
        # Try to delete following from 2026-11-05
        cutoff_date = "2026-11-05T08:00:00"
        del_foll_res = await client.delete(
            f"/events/{del_foll_id}?scope=following&occurrence_date={cutoff_date}",
            headers=headers
        )
        print(f"[DEBUG] DELETE /events/{del_foll_id}?scope=following&occurrence_date={cutoff_date} -> status {del_foll_res.status_code}")
        ev_foll_check = unwrap(await client.get(f"/events/{del_foll_id}", headers=headers))
        foll_rec_end = ev_foll_check["recurrence_end"]
        print(f"[DEBUG] recurrence_end after DELETE following: {foll_rec_end}")
        if foll_rec_end and "2026-11-05" in foll_rec_end:
            print("   [PASS] recurrence_end correctly capped at cutoff_date!")
        else:
            msg = (
                f"PROBE 4B BUG: DELETE /events/{del_foll_id}?scope=following&occurrence_date={cutoff_date} "
                f"did not receive cutoff_date (it was ignored by FastAPI router) and capped recurrence_end at "
                f"{foll_rec_end} (event start_at minus 1s), wiping out the entire series!"
            )
            print(f"   [FAIL] {msg}")
            findings.append(msg)

        # ------------------------------------------------------------------
        # PROBE 5: Delete parent series (scope="all") cascading check
        # ------------------------------------------------------------------
        print("\n--- PROBE 5: Delete Parent Series (scope='all') Cascading ---")
        del_all_res = await client.delete(f"/events/{master_id}?scope=all", headers=headers)
        assert del_all_res.status_code == 204
        
        # Master should return 404
        m_gone = await client.get(f"/events/{master_id}", headers=headers)
        assert m_gone.status_code == 404, f"Master event {master_id} still exists after scope='all'!"
        
        # DB check for exception rows
        async with AsyncSessionLocal() as db_session:
            stmt = select(Event).where(Event.parent_event_id == master_id)
            orphans = (await db_session.execute(stmt)).scalars().all()
            assert len(orphans) == 0, f"Found {len(orphans)} orphaned exception rows after cascade delete!"
        print(f"   [PASS] Master {master_id} and all associated exception rows cleanly deleted.")

        # ------------------------------------------------------------------
        # PROBE 6: Stress-Test Task Position Updates
        # - Batch reordering with 50 tasks
        # - Non-contiguous position values
        # - Negative positions
        # ------------------------------------------------------------------
        print("\n--- PROBE 6: Task Position Updates & Reordering Stress Test ---")
        
        # Create a custom task list
        list_res = await client.post("/task-lists", json={
            "name": "Stress Test List",
            "color": "#10B981"
        }, headers=headers)
        test_list = unwrap(list_res)
        list_id = test_list["id"]
        
        # 6A: Create 50 tasks
        print("[*] Creating 50 tasks in batch...")
        task_ids = []
        for i in range(50):
            t_res = await client.post("/tasks", json={
                "title": f"Task #{i+1:02d}",
                "list_id": list_id,
                "position": i
            }, headers=headers)
            assert t_res.status_code == 201, f"Failed creating task #{i}: {t_res.text}"
            task_ids.append(unwrap(t_res)["id"])
        print(f"[+] Successfully created 50 tasks (IDs: {task_ids[0]}..{task_ids[-1]})")
        
        # 6B: Batch reorder 50 tasks in reverse order (50 down to 1)
        print("[*] Testing Batch Reorder of 50 tasks (Reversed: pos 0..49 inverted)...")
        reversed_items = [{"id": task_ids[i], "position": 49 - i} for i in range(50)]
        reorder_res = await client.put("/tasks/reorder", json={"items": reversed_items}, headers=headers)
        assert reorder_res.status_code == 204, f"PUT /tasks/reorder failed: {reorder_res.text}"
        
        # Verify order from GET /tasks?list_id=list_id
        tasks_res = unwrap(await client.get(f"/tasks?list_id={list_id}", headers=headers))
        assert len(tasks_res) == 50, f"Expected 50 tasks, got {len(tasks_res)}"
        expected_ids = list(reversed(task_ids))
        actual_ids = [t["id"] for t in tasks_res]
        assert actual_ids == expected_ids, f"Ordering mismatch! Expected {expected_ids[:5]}..., got {actual_ids[:5]}..."
        print("   [PASS] 50-task batch reordering persisted and verified successfully.")
        
        # 6C: Non-contiguous position values
        print("[*] Testing Non-Contiguous Positions (e.g. 10, 50, 100, 9999, 100000)...")
        non_contig = [10, 50, 100, 500, 9999]
        nc_items = [{"id": task_ids[i], "position": non_contig[i]} for i in range(5)]
        nc_reorder_res = await client.put("/tasks/reorder", json={"items": nc_items}, headers=headers)
        assert nc_reorder_res.status_code == 204
        
        # Verify persistence for these 5 tasks
        for idx, pos in enumerate(non_contig):
            t_obj = unwrap(await client.get(f"/tasks/{task_ids[idx]}", headers=headers))
            assert t_obj["position"] == pos, f"Task {task_ids[idx]} position expected {pos}, got {t_obj['position']}"
        print("   [PASS] Non-contiguous position values correctly persisted.")
        
        # 6D: Negative position values
        print("[*] Testing Negative Positions (e.g. -500, -100, -50, -10, -5)...")
        neg_positions = [-500, -100, -50, -10, -5]
        neg_items = [{"id": task_ids[i], "position": neg_positions[i]} for i in range(5)]
        neg_res = await client.put("/tasks/reorder", json={"items": neg_items}, headers=headers)
        assert neg_res.status_code == 204, f"PUT /tasks/reorder with negative positions failed: {neg_res.text}"
        
        # Verify order in GET /tasks?list_id=list_id
        tasks_res_neg = unwrap(await client.get(f"/tasks?list_id={list_id}", headers=headers))
        top_5_ids = [t["id"] for t in tasks_res_neg[:5]]
        top_5_positions = [t["position"] for t in tasks_res_neg[:5]]
        print(f"[DEBUG] Top 5 tasks positions: {top_5_positions}")
        assert top_5_positions == neg_positions, f"Expected {neg_positions}, got {top_5_positions}"
        assert top_5_ids == task_ids[:5], f"Expected {task_ids[:5]}, got {top_5_ids}"
        print("   [PASS] Negative positions accepted, persisted, and ordered correctly in ascending order.")
        
        # 6E: Single task position updates via PATCH and PUT
        print("[*] Testing Single Task Position Updates via PATCH and PUT...")
        p_res = await client.patch(f"/tasks/{task_ids[0]}/position", json={"position": -999}, headers=headers)
        assert p_res.status_code == 200
        assert unwrap(p_res)["position"] == -999
        
        put_t_res = await client.put(f"/tasks/{task_ids[1]}", json={"position": 888888}, headers=headers)
        assert put_t_res.status_code == 200
        assert unwrap(put_t_res)["position"] == 888888
        print("   [PASS] Single task position updates via PATCH and PUT verified.")

    print("\n======================================================================")
    print("CHALLENGE FINDINGS SUMMARY:")
    if findings:
        print(f"❌ {len(findings)} CRITICAL BUGS / VULNERABILITIES FOUND:")
        for idx, f in enumerate(findings, 1):
            print(f"  {idx}. {f}")
        return False
    else:
        print("✅ ALL PROBES PASSED WITH ZERO FAILURES!")
        return True

if __name__ == "__main__":
    success = asyncio.run(run_probes())
    if not success:
        sys.exit(1)
    sys.exit(0)
