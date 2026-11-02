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

async def test_todo_phase4():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # 1. Register user
        email = f"phase4_{int(datetime.now().timestamp())}@example.com"
        pwd = "SecretPassword123!"
        reg = await client.post("/users/register", json={
            "email": email,
            "nickname": "Phase 4 Tester",
            "password": pwd
        })
        assert reg.status_code == 201, reg.text

        # 2. Login
        login = await client.post("/auth/login", data={"username": email, "password": pwd})
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Create Custom List
        clist = await client.post("/task-lists", json={"name": "Work Projects", "color": "#8E24AA", "icon": "💼"}, headers=headers)
        assert clist.status_code == 201, clist.text
        list_obj = unwrap(clist)
        list_id = list_obj["id"]

        # 4. Create Task in Custom List with Steps & Recurrence
        task_data = {
            "title": "Weekly Team Sync",
            "list_id": list_id,
            "due_date": "2026-11-01",
            "is_important": True,
            "is_in_my_day": True,
            "recurrence_rule": "FREQ=WEEKLY",
            "steps": [
                {"title": "Prepare agenda"},
                {"title": "Review metrics"}
            ]
        }
        res_t = await client.post("/tasks", json=task_data, headers=headers)
        assert res_t.status_code == 201, res_t.text
        task = unwrap(res_t)
        assert task["title"] == "Weekly Team Sync"
        assert task["is_important"] is True
        assert task["is_in_my_day"] is True
        assert len(task["steps"]) == 2
        step1_id = task["steps"][0]["id"]

        # 5. Complete Step
        s_comp = await client.patch(f"/tasks/{task['id']}/steps/{step1_id}/complete", json={"is_completed": True}, headers=headers)
        assert s_comp.status_code == 200
        step_res = unwrap(s_comp)
        assert step_res["is_completed"] is True

        # 6. Complete Recurring Task -> Verifies automatic generation of next cycle task
        comp = await client.patch(f"/tasks/{task['id']}/complete", json={"is_completed": True}, headers=headers)
        assert comp.status_code == 200
        assert unwrap(comp)["is_completed"] is True

        # Fetch all tasks to verify recurring task generated a new uncompleted task
        all_t = await client.get("/tasks", headers=headers)
        assert all_t.status_code == 200
        tasks = unwrap(all_t)
        assert len(tasks) == 2, f"Expected 2 tasks, got {len(tasks)}"
        active_recurring = [t for t in tasks if not t["is_completed"]]
        assert len(active_recurring) == 1
        assert active_recurring[0]["title"] == "Weekly Team Sync"
        assert str(active_recurring[0]["due_date"]) == "2026-11-08"

        # 7. Test My Day toggle
        md_toggle = await client.patch(f"/tasks/{active_recurring[0]['id']}/my-day", json={"is_in_my_day": True}, headers=headers)
        assert md_toggle.status_code == 200
        assert unwrap(md_toggle)["is_in_my_day"] is True

        # 8. Test Star toggle
        star_toggle = await client.patch(f"/tasks/{active_recurring[0]['id']}/important", json={"is_important": False}, headers=headers)
        assert star_toggle.status_code == 200
        assert unwrap(star_toggle)["is_important"] is False

        # 9. Test Move list (fetch default list to move to)
        lists_res = await client.get("/task-lists", headers=headers)
        default_list = [l for l in unwrap(lists_res) if l.get("is_default")][0]
        move_l = await client.put(f"/tasks/{active_recurring[0]['id']}", json={"title": "Moved Sync", "list_id": default_list["id"]}, headers=headers)
        assert move_l.status_code == 200, move_l.text

        print("🎉 ALL PHASE 4 BACKEND & TO-DO AUTOMATED TESTS PASSED 100%!")

if __name__ == "__main__":
    asyncio.run(test_todo_phase4())
