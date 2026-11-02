from unittest import SkipTest as _LegacyProbeSkipped
raise _LegacyProbeSkipped("Historical probe archived: unsafe live DB/provider assumptions. Run backend/tests/regression instead.")

"""
Audit & Bugfix Verification Tests
Tests:
1. Creating custom list in To Do (/lists)
2. Creating time-blocked task with start_time, end_time, duration_minutes, is_all_day
3. Creating recurring task and completing it (verifying next recurring task inherits time fields)
4. AI Agent tool execution for recurring task & time-blocking
"""

import asyncio
import httpx
from datetime import datetime, date, timedelta

BASE_URL = "http://localhost:8000/api/v1"

def unwrap(res):
    j = res.json()
    if isinstance(j, dict) and "data" in j and len(j) <= 3:
        return j["data"]
    return j

async def test_audit_fixes():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Register and login
        email = f"audit_user_{int(datetime.now().timestamp())}@example.com"
        pwd = "AuditPassword123!"
        reg = await client.post("/users/register", json={
            "email": email,
            "nickname": "Audit Tester",
            "password": pwd
        })
        assert reg.status_code == 201, reg.text

        login = await client.post("/auth/login", data={"username": email, "password": pwd})
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        print("[*] 1. Testing Custom List Creation (BUG-03 check)...")
        list_res = await client.post("/lists", json={
            "name": "Dự án Khởi nghiệp",
            "color": "#4F46E5",
            "icon": "🚀"
        }, headers=headers)
        assert list_res.status_code == 201, list_res.text
        custom_list = unwrap(list_res)
        assert custom_list["name"] == "Dự án Khởi nghiệp"
        print(f"   [OK] Created custom list ID {custom_list['id']}")

        print("[*] 2. Testing Task Time-Blocking (start_time, end_time, duration_minutes)...")
        today_str = date.today().isoformat()
        task_res = await client.post("/tasks", json={
            "title": "Họp chiến lược sản phẩm Planify",
            "list_id": custom_list["id"],
            "due_date": today_str,
            "is_all_day": False,
            "start_time": "09:30:00",
            "end_time": "10:30:00",
            "duration_minutes": 60,
            "color": "#4F46E5"
        }, headers=headers)
        assert task_res.status_code == 201, task_res.text
        task = unwrap(task_res)
        assert task["is_all_day"] is False
        assert "09:30" in str(task["start_time"])
        assert "10:30" in str(task["end_time"])
        assert task["duration_minutes"] == 60
        print(f"   [OK] Created time-blocked task ID {task['id']}")

        print("[*] 3. Testing Recurring Task Completion & Next Cycle Generation...")
        rec_task_res = await client.post("/tasks", json={
            "title": "Review báo cáo tuần",
            "list_id": custom_list["id"],
            "due_date": today_str,
            "is_all_day": False,
            "start_time": "15:00:00",
            "end_time": "16:00:00",
            "duration_minutes": 60,
            "recurrence_rule": "FREQ=WEEKLY",
            "color": "#0B8043"
        }, headers=headers)
        assert rec_task_res.status_code == 201, rec_task_res.text
        rec_task = unwrap(rec_task_res)
        assert rec_task["recurrence_rule"] == "FREQ=WEEKLY"

        # Complete recurring task -> should spawn next recurring task
        complete_res = await client.patch(f"/tasks/{rec_task['id']}/complete", json={
            "is_completed": True
        }, headers=headers)
        assert complete_res.status_code == 200

        # Query tasks in list -> should see completed task AND newly spawned uncompleted task
        all_tasks_res = await client.get("/tasks", headers=headers)
        all_tasks = unwrap(all_tasks_res)
        next_cycle_task = next(
            (t for t in all_tasks if t["title"] == "Review báo cáo tuần" and not t["is_completed"]),
            None
        )
        assert next_cycle_task is not None, "Next recurring cycle task was not created!"
        assert next_cycle_task["is_all_day"] is False
        assert "15:00" in str(next_cycle_task["start_time"])
        assert next_cycle_task["recurrence_rule"] == "FREQ=WEEKLY"
        print(f"   [OK] Next recurring task cycle created: ID {next_cycle_task['id']}, due {next_cycle_task['due_date']}")

        print("[*] 4. Testing AI Agent Tool Execution for Recurring & Time-Blocked Tasks...")
        ai_chat_res = await client.post("/ai/chat", json={
            "content": "Hãy lên lịch giúp tôi một việc cần làm lặp lại hàng tuần có tên 'Tập Yoga thứ hai' vào lúc 06:00 sáng đến 07:00 sáng."
        }, headers=headers)
        assert ai_chat_res.status_code == 200, ai_chat_res.text
        ai_reply = unwrap(ai_chat_res)
        print(f"   [AI Agent Response]: {ai_reply['content']}")

        # Verify task was actually created by checking task list
        updated_tasks = unwrap(await client.get("/tasks", headers=headers))
        yoga_task = next((t for t in updated_tasks if "Yoga" in t["title"]), None)
        assert yoga_task is not None, "AI Agent failed to create the Yoga recurring task!"
        assert yoga_task["recurrence_rule"] is not None, "AI Agent did not set recurrence_rule!"
        print(f"   [OK] AI correctly invoked create_task tool: ID {yoga_task['id']}, RRULE={yoga_task['recurrence_rule']}, start={yoga_task['start_time']}")

        print("🎉 ALL AUDIT & BUGFIX VERIFICATION TESTS PASSED 100%!")

if __name__ == "__main__":
    asyncio.run(test_audit_fixes())

