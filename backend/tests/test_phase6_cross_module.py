from unittest import SkipTest as _LegacyProbeSkipped
raise _LegacyProbeSkipped("Historical probe archived: unsafe live DB/provider assumptions. Run backend/tests/regression instead.")

import asyncio
import httpx
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"

def unwrap(res):
    j = res.json()
    if isinstance(j, dict) and "data" in j and len(j) <= 3:
        return j["data"]
    return j

async def test_cross_module_phase6():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=60.0) as client:
        # 1. Register & Login
        email = f"cross_{int(datetime.now().timestamp())}@example.com"
        pwd = "SecretPassword123!"
        reg = await client.post("/users/register", json={
            "email": email,
            "nickname": "Integration Tester",
            "password": pwd
        })
        assert reg.status_code == 201, reg.text

        login = await client.post("/auth/login", data={"username": email, "password": pwd})
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        print("[*] 1. Scenario: AI creates an Event -> Calendar verifies it...")
        ai_event_prompt = "Hãy tạo cho tôi một sự kiện 'Họp chiến lược 2026' bắt đầu từ 2026-11-10T09:00:00 đến 2026-11-10T10:00:00"
        ai_resp = await client.post("/ai/chat", json={"content": ai_event_prompt}, headers=headers)
        assert ai_resp.status_code == 200, ai_resp.text
        ai_msg = unwrap(ai_resp)
        print(f"   [AI Event Response]: {ai_msg['content'][:120]}...")

        # Check calendar endpoint
        events_resp = await client.get("/events?start=2026-11-10T00:00:00&end=2026-11-10T23:59:59", headers=headers)
        assert events_resp.status_code == 200, events_resp.text
        events = unwrap(events_resp)
        assert len(events) >= 1
        assert any("Họp chiến lược" in e["title"] for e in events)
        print("   [OK] Event verified on Calendar!")

        print("[*] 2. Scenario: AI creates a Task -> To Do verifies it...")
        ai_task_prompt = "Tạo việc cần làm 'Hoàn thiện slide thuyết trình' hạn chót ngày 2026-11-10 và đánh dấu quan trọng"
        ai_task_resp = await client.post("/ai/chat", json={"content": ai_task_prompt}, headers=headers)
        assert ai_task_resp.status_code == 200, ai_task_resp.text
        ai_task_msg = unwrap(ai_task_resp)
        print(f"   [AI Task Response]: {ai_task_msg['content'][:120]}...")

        # Check tasks endpoint
        tasks_resp = await client.get("/tasks", headers=headers)
        assert tasks_resp.status_code == 200, tasks_resp.text
        tasks = unwrap(tasks_resp)
        matching_task = next((t for t in tasks if "slide" in t["title"].lower()), None)
        assert matching_task is not None
        assert matching_task["is_important"] is True
        print(f"   [OK] Task ID {matching_task['id']} verified in To Do!")

        print("[*] 3. Scenario: Complete task from Calendar perspective...")
        comp_resp = await client.patch(f"/tasks/{matching_task['id']}/complete", json={"is_completed": True}, headers=headers)
        assert comp_resp.status_code == 200
        assert unwrap(comp_resp)["is_completed"] is True
        print("   [OK] Task completion synced!")

        print("[*] 4. Scenario: Delete list cascades to internal tasks...")
        # Create a custom list with 1 task
        clist = await client.post("/task-lists", json={"name": "Temporary List", "color": "#E67C73", "icon": "🗑️"}, headers=headers)
        assert clist.status_code == 201
        temp_list_id = unwrap(clist)["id"]

        await client.post("/tasks", json={"title": "Task inside temp list", "list_id": temp_list_id}, headers=headers)

        # Delete list
        del_list = await client.delete(f"/task-lists/{temp_list_id}", headers=headers)
        assert del_list.status_code in [200, 204]

        # Verify task is deleted
        tasks_after = unwrap(await client.get("/tasks", headers=headers))
        assert not any(t.get("list_id") == temp_list_id for t in tasks_after)
        print("   [OK] Cascade deletion verified!")

        print("🎉 ALL PHASE 6 CROSS-MODULE TESTS PASSED 100%!")

if __name__ == "__main__":
    asyncio.run(test_cross_module_phase6())
