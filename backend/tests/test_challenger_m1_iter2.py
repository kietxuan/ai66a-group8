from unittest import SkipTest as _LegacyProbeSkipped
raise _LegacyProbeSkipped("Historical probe archived: unsafe live DB/provider assumptions. Run backend/tests/regression instead.")

"""
Milestone M1 Iteration 2 Empirical Challenger Stress Harness
Agent: teamwork_challenger_m1_iter2_3

Target:
- DELETE /api/v1/events/{id}
  - scope="this" (single instance cancellation)
  - scope="following" (series cutoff)
  - scope="all" (full cascade deletion)
- Direct PostgreSQL Database Verification (zero orphans)
"""

import asyncio
import sys
import uuid
from datetime import datetime, timedelta
import httpx
from sqlalchemy.future import select

from app.core.database import AsyncSessionLocal
from app.models.event_model import Event

BASE_URL = "http://127.0.0.1:8000/api/v1"

def unwrap(response: httpx.Response):
    data = response.json()
    if isinstance(data, dict) and "data" in data and "code" in data:
        return data["data"]
    return data

async def run_empirical_rechallenge():
    print("======================================================================")
    print("EMPIRICAL RE-CHALLENGE: DELETE /api/v1/events/{id} SCOPES & CASCADE")
    print("======================================================================")
    
    findings = []
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # User 1 (Owner)
        u1_name = f"chal_owner_{uuid.uuid4().hex[:8]}"
        u1_email = f"{u1_name}@example.com"
        u1_pwd = "ChallengerPass123!"
        r1 = await client.post("/users/register", json={"email": u1_email, "password": u1_pwd, "nickname": "Owner"})
        assert r1.status_code == 201, f"Owner register failed: {r1.text}"
        l1 = await client.post("/auth/login", data={"username": u1_email, "password": u1_pwd})
        assert l1.status_code == 200, f"Owner login failed: {l1.text}"
        h1 = {"Authorization": f"Bearer {l1.json()['access_token']}"}

        # User 2 (Attacker / Tenant Isolation check)
        u2_name = f"chal_other_{uuid.uuid4().hex[:8]}"
        u2_email = f"{u2_name}@example.com"
        u2_pwd = "ChallengerPass123!"
        r2 = await client.post("/users/register", json={"email": u2_email, "password": u2_pwd, "nickname": "Other"})
        assert r2.status_code == 201
        l2 = await client.post("/auth/login", data={"username": u2_email, "password": u2_pwd})
        h2 = {"Authorization": f"Bearer {l2.json()['access_token']}"}

        print(f"[*] Authenticated User 1: {u1_email}")
        print(f"[*] Authenticated User 2: {u2_email}")

        # ------------------------------------------------------------------
        # TEST 1: Probe 2 Verification — Delete Instance 3 (scope="this")
        # ------------------------------------------------------------------
        print("\n--- TEST 1: Probe 2 (Delete Instance 3 scope='this') ---")
        ev_start = "2026-11-01T10:00:00"
        ev_end = "2026-11-01T11:00:00"
        create_res = await client.post("/events", json={
            "title": "Challenger Daily Series 10 Occurrences",
            "start_at": ev_start,
            "end_at": ev_end,
            "recurrence_rule": "FREQ=DAILY;COUNT=10"
        }, headers=h1)
        assert create_res.status_code == 201, f"Create event failed: {create_res.text}"
        master_ev = unwrap(create_res)
        master_id = master_ev["id"]
        print(f"[+] Master created: ID={master_id}, start_at={master_ev['start_at']}")

        inst3_str = "2026-11-03T10:00:00"
        del_inst3 = await client.delete(
            f"/events/{master_id}?scope=this&occurrence_date={inst3_str}",
            headers=h1
        )
        assert del_inst3.status_code == 204, f"DELETE instance 3 failed: {del_inst3.status_code}"

        # Verify DB exception tombstone
        async with AsyncSessionLocal() as db:
            stmt = select(Event).where(Event.parent_event_id == master_id)
            rows = (await db.execute(stmt)).scalars().all()
            assert len(rows) == 1, f"Expected exactly 1 exception row, got {len(rows)}"
            tomb3 = rows[0]
            assert tomb3.is_cancelled is True, "Tombstone is_cancelled is not True"
            assert tomb3.is_exception is True, "Tombstone is_exception is not True"
            assert "2026-11-03" in tomb3.original_start.isoformat(), f"Wrong original_start: {tomb3.original_start}"
            tomb3_id = tomb3.id
            print(f"[+] Tombstone verified: ID={tomb3_id}, original_start={tomb3.original_start}")

        # Verify master series is intact (start_at unchanged at 2026-11-01T10:00:00)
        master_check = unwrap(await client.get(f"/events/{master_id}", headers=h1))
        assert master_check["id"] == master_id
        assert "2026-11-01T10:00:00" in master_check["start_at"], f"Master start_at corrupted: {master_check['start_at']}"
        assert master_check["recurrence_rule"] == "FREQ=DAILY;COUNT=10"
        assert master_check["is_exception"] is False
        print("   [PASS] Probe 2 Verified: Instance 3 cancelled, Instance 1 intact!")

        # ------------------------------------------------------------------
        # TEST 2: Idempotency of scope="this" cancellation
        # ------------------------------------------------------------------
        print("\n--- TEST 2: Idempotency of scope='this' ---")
        del_inst3_again = await client.delete(
            f"/events/{master_id}?scope=this&occurrence_date={inst3_str}",
            headers=h1
        )
        assert del_inst3_again.status_code == 204, f"Repeat DELETE failed: {del_inst3_again.status_code}"

        async with AsyncSessionLocal() as db:
            stmt = select(Event).where(Event.parent_event_id == master_id)
            rows_again = (await db.execute(stmt)).scalars().all()
            assert len(rows_again) == 1, f"Expected still 1 exception row, got {len(rows_again)}"
            assert rows_again[0].id == tomb3_id
            print("   [PASS] Idempotent DELETE confirmed: 0 duplicate exception rows created.")

        # ------------------------------------------------------------------
        # TEST 3: Deleting an already rescheduled exception (scope="this")
        # ------------------------------------------------------------------
        print("\n--- TEST 3: Deleting an already rescheduled instance ---")
        inst4_orig = "2026-11-04T10:00:00"
        upd_inst4 = await client.put(f"/events/{master_id}", json={
            "title": "Instance 4 Rescheduled",
            "start_at": "2026-11-04T15:00:00",
            "end_at": "2026-11-04T16:00:00",
            "original_start": inst4_orig,
            "scope": "this"
        }, headers=h1)
        assert upd_inst4.status_code == 200
        inst4_exc = unwrap(upd_inst4)
        inst4_exc_id = inst4_exc["id"]
        assert inst4_exc["is_exception"] is True
        print(f"[+] Instance 4 rescheduled: ID={inst4_exc_id}")

        # Now delete this instance via master_id + occurrence_date
        del_inst4 = await client.delete(
            f"/events/{master_id}?scope=this&occurrence_date={inst4_orig}",
            headers=h1
        )
        assert del_inst4.status_code == 204

        async with AsyncSessionLocal() as db:
            stmt = select(Event).where(Event.id == inst4_exc_id)
            exc4_row = (await db.execute(stmt)).scalars().first()
            assert exc4_row is not None
            assert exc4_row.is_cancelled is True, "Existing exception row was not marked is_cancelled=True"
            print("   [PASS] Rescheduled instance transitioned to is_cancelled=True without duplicate rows.")

        # ------------------------------------------------------------------
        # TEST 4: Delete Instance 1 (the master start date itself with scope="this")
        # ------------------------------------------------------------------
        print("\n--- TEST 4: Delete Instance 1 (Master Start Date) with scope='this' ---")
        del_inst1 = await client.delete(
            f"/events/{master_id}?scope=this&occurrence_date={ev_start}",
            headers=h1
        )
        assert del_inst1.status_code == 204

        master_still = await client.get(f"/events/{master_id}", headers=h1)
        assert master_still.status_code == 200, "Master event was destroyed when deleting instance 1!"

        async with AsyncSessionLocal() as db:
            stmt = select(Event).where(Event.parent_event_id == master_id, Event.original_start == datetime.fromisoformat(ev_start))
            tomb1 = (await db.execute(stmt)).scalars().first()
            assert tomb1 is not None, "Tombstone for Instance 1 was not created"
            assert tomb1.is_cancelled is True
            tomb1_id = tomb1.id
            print(f"[+] Instance 1 tombstone created: ID={tomb1_id}, master remains intact.")
        print("   [PASS] Instance 1 cancellation supported cleanly.")

        # ------------------------------------------------------------------
        # TEST 5: Probe 4B Verification — Series Cutoff via DELETE (scope="following")
        # ------------------------------------------------------------------
        print("\n--- TEST 5: Probe 4B (Series Cutoff via DELETE scope='following') ---")
        ev2_res = await client.post("/events", json={
            "title": "Challenger Series For Cutoff",
            "start_at": "2026-11-01T08:00:00",
            "end_at": "2026-11-01T09:00:00",
            "recurrence_rule": "FREQ=DAILY;COUNT=10"
        }, headers=h1)
        assert ev2_res.status_code == 201
        ev2_id = unwrap(ev2_res)["id"]

        cutoff_date = "2026-11-06T08:00:00"
        del_foll = await client.delete(
            f"/events/{ev2_id}?scope=following&occurrence_date={cutoff_date}",
            headers=h1
        )
        assert del_foll.status_code == 204

        ev2_after = unwrap(await client.get(f"/events/{ev2_id}", headers=h1))
        rec_end = ev2_after["recurrence_end"]
        print(f"[+] recurrence_end after scope='following': {rec_end}")
        assert rec_end is not None, "recurrence_end was not set!"
        # Cutoff should be 2026-11-06T08:00:00 minus 1 second -> 2026-11-06T07:59:59
        assert "2026-11-06" in rec_end and "07:59:59" in rec_end, f"Unexpected recurrence_end: {rec_end}"
        print("   [PASS] Probe 4B Verified: Series correctly cutoff at cutoff_date - 1s.")

        # ------------------------------------------------------------------
        # TEST 6: Probe 5 Verification — Scope="all" Cascade & Zero Orphan Rows
        # ------------------------------------------------------------------
        print("\n--- TEST 6: Probe 5 (scope='all' Cascade Delete & Zero Orphan Rows) ---")
        # Master_id currently has:
        # - tomb3 (instance 3 cancelled)
        # - inst4_exc (instance 4 rescheduled then cancelled)
        # - tomb1 (instance 1 cancelled)
        all_exc_ids = [tomb3_id, inst4_exc_id, tomb1_id]
        print(f"[*] Master {master_id} has 3 child exceptions in DB: {all_exc_ids}")

        del_all = await client.delete(f"/events/{master_id}?scope=all", headers=h1)
        assert del_all.status_code == 204

        # Verify master returns 404
        assert (await client.get(f"/events/{master_id}", headers=h1)).status_code == 404

        # Direct DB SQL Verification: 0 orphan rows
        async with AsyncSessionLocal() as db:
            stmt1 = select(Event).where(Event.parent_event_id == master_id)
            orphans_by_parent = (await db.execute(stmt1)).scalars().all()
            assert len(orphans_by_parent) == 0, f"Found {len(orphans_by_parent)} orphaned rows with parent_event_id={master_id}!"

            stmt2 = select(Event).where(Event.id.in_(all_exc_ids))
            orphans_by_id = (await db.execute(stmt2)).scalars().all()
            assert len(orphans_by_id) == 0, f"Found lingering exception rows: {[r.id for r in orphans_by_id]}!"
            print(f"[+] Direct SQL Verification: 0 rows found for parent_id={master_id} and 0 rows for child IDs {all_exc_ids}")
        print("   [PASS] Probe 5 Verified: Complete cascade with ZERO orphan rows in PostgreSQL.")

        # ------------------------------------------------------------------
        # TEST 7: Delete via Exception ID with scope="all"
        # ------------------------------------------------------------------
        print("\n--- TEST 7: Delete via Exception ID with scope='all' ---")
        ev3 = unwrap(await client.post("/events", json={
            "title": "Series to Delete via Child",
            "start_at": "2026-11-01T12:00:00",
            "end_at": "2026-11-01T13:00:00",
            "recurrence_rule": "FREQ=DAILY;COUNT=5"
        }, headers=h1))
        ev3_id = ev3["id"]

        exc3_res = unwrap(await client.put(f"/events/{ev3_id}", json={
            "title": "Exception of ev3",
            "start_at": "2026-11-02T14:00:00",
            "end_at": "2026-11-02T15:00:00",
            "original_start": "2026-11-02T12:00:00",
            "scope": "this"
        }, headers=h1))
        exc3_id = exc3_res["id"]
        assert exc3_res["parent_event_id"] == ev3_id

        # Calling DELETE on child exception with scope="all"
        del_child_all = await client.delete(f"/events/{exc3_id}?scope=all", headers=h1)
        assert del_child_all.status_code == 204

        # Both child and master must be 404
        assert (await client.get(f"/events/{exc3_id}", headers=h1)).status_code == 404
        assert (await client.get(f"/events/{ev3_id}", headers=h1)).status_code == 404

        async with AsyncSessionLocal() as db:
            stmt = select(Event).where((Event.id == ev3_id) | (Event.parent_event_id == ev3_id) | (Event.id == exc3_id))
            remaining = (await db.execute(stmt)).scalars().all()
            assert len(remaining) == 0, f"Lingering rows after deleting via child with scope='all': {[r.id for r in remaining]}"
        print("   [PASS] Deleting via child exception with scope='all' cleans entire hierarchy.")

        # ------------------------------------------------------------------
        # TEST 8: Adversarial Input & Security Validation
        # ------------------------------------------------------------------
        print("\n--- TEST 8: Adversarial Input & Security Validation ---")
        # 8a: Invalid scope pattern
        bad_scope = await client.delete(f"/events/{ev2_id}?scope=malicious_drop_table", headers=h1)
        assert bad_scope.status_code == 422, f"Expected 422 for bad scope, got {bad_scope.status_code}"
        print("   [PASS] Regex pattern validation rejects invalid scope with 422.")

        # 8b: Tenant isolation (User 2 attempts to delete User 1's event)
        hack_res = await client.delete(f"/events/{ev2_id}?scope=all", headers=h2)
        assert hack_res.status_code == 404, f"Expected 404 for cross-tenant delete, got {hack_res.status_code}"
        print("   [PASS] Cross-tenant isolation verified: User 2 cannot delete User 1's event.")

        # 8c: Non-existent event ID
        not_found_res = await client.delete("/events/99999999?scope=all", headers=h1)
        assert not_found_res.status_code == 404
        print("   [PASS] Non-existent ID returns 404 cleanly.")

    print("\n======================================================================")
    print("ALL EMPIRICAL RE-CHALLENGE TESTS PASSED 100%!")
    print("======================================================================")
    return True

if __name__ == "__main__":
    success = asyncio.run(run_empirical_rechallenge())
    if not success:
        sys.exit(1)
    sys.exit(0)
