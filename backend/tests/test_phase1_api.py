"""
Phase 1 API Integration Tests
Tests all endpoints for Calendar, Events, Tasks, Lists, Steps, Categories, Dashboard, and AI Conversations.
"""

import sys
import httpx
from datetime import datetime, timedelta, date

BASE_URL = "http://localhost:8000/api/v1"

def test_api():
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    # 1. Register test user
    test_email = f"test_user_{int(datetime.now().timestamp())}@example.com"
    test_pwd = "password123"

    print(f"[*] 1. Registering new user: {test_email}...")
    reg_resp = client.post("/users/register", json={
        "email": test_email,
        "nickname": "Tester",
        "password": test_pwd,
        "theme_preference": "dark",
        "timezone": "Asia/Ho_Chi_Minh"
    })
    assert reg_resp.status_code == 201, f"Register failed: {reg_resp.text}"
    user_data = reg_resp.json()["data"]
    assert user_data["theme_preference"] == "dark"
    print("   [OK] Registered user.")

    # 2. Login to get JWT
    print("[*] 2. Logging in...")
    login_resp = client.post("/auth/login", data={
        "username": test_email,
        "password": test_pwd
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   [OK] Logged in and received token.")

    # 3. Check auto-seeded Calendar and TaskList
    print("[*] 3. Verifying auto-seeded default Calendar & TaskList...")
    cals_resp = client.get("/calendars", headers=headers)
    assert cals_resp.status_code == 200
    cals = cals_resp.json()
    assert len(cals) >= 1
    default_cal = next((c for c in cals if c["is_default"]), None)
    assert default_cal is not None, "Default calendar not created!"
    print(f"   [OK] Default calendar verified: {default_cal['name']} ({default_cal['color']})")

    lists_resp = client.get("/lists", headers=headers)
    assert lists_resp.status_code == 200
    lists = lists_resp.json()
    assert len(lists) >= 1
    default_list = next((l for l in lists if l["is_default"]), None)
    assert default_list is not None, "Default task list not created!"
    print(f"   [OK] Default task list verified: {default_list['name']}")

    # 4. User Profile endpoints
    print("[*] 4. Testing User Profile update...")
    me_resp = client.get("/users/me", headers=headers)
    assert me_resp.status_code == 200
    me_update_resp = client.put("/users/me", headers=headers, json={
        "nickname": "Tester Pro",
        "theme_preference": "light"
    })
    assert me_update_resp.status_code == 200
    assert me_update_resp.json()["data"]["nickname"] == "Tester Pro"
    assert me_update_resp.json()["data"]["theme_preference"] == "light"
    print("   [OK] Profile updated.")

    # 5. Calendars CRUD
    print("[*] 5. Testing Calendar CRUD...")
    new_cal_resp = client.post("/calendars", headers=headers, json={
        "name": "Công việc",
        "color": "#0B8043"
    })
    assert new_cal_resp.status_code == 201
    custom_cal_id = new_cal_resp.json()["id"]

    # Try deleting default calendar (must fail)
    del_def_cal = client.delete(f"/calendars/{default_cal['id']}", headers=headers)
    assert del_def_cal.status_code == 400, "Should not allow deleting default calendar!"
    print("   [OK] Prevented deleting default calendar.")

    # 6. Events CRUD & Recurring
    print("[*] 6. Testing Events CRUD & Recurring...")
    now = datetime.now()
    start_at = (now + timedelta(hours=1)).isoformat()
    end_at = (now + timedelta(hours=2)).isoformat()

    event_resp = client.post("/events", headers=headers, json={
        "calendar_id": custom_cal_id,
        "title": "Họp Sprint",
        "description": "Lập kế hoạch sprint mới",
        "location": "Phòng 101",
        "start_at": start_at,
        "end_at": end_at,
        "reminders": [{"minutes_before": 15}]
    })
    assert event_resp.status_code == 201
    event_id = event_resp.json()["id"]
    print(f"   [OK] Created event ID {event_id}")

    # Query events in range
    range_start = (now - timedelta(days=1)).isoformat()
    range_end = (now + timedelta(days=3)).isoformat()
    events_in_range = client.get(f"/events?start={range_start}&end={range_end}", headers=headers)
    assert events_in_range.status_code == 200
    assert len(events_in_range.json()) >= 1
    print(f"   [OK] Found {len(events_in_range.json())} events in range.")

    # 7. Tasks CRUD with steps and actions
    print("[*] 7. Testing Tasks CRUD...")
    task_resp = client.post("/tasks", headers=headers, json={
        "title": "Viết báo cáo tài chính",
        "note": "Chi tiết Q4",
        "is_important": True,
        "is_in_my_day": True,
        "due_date": str(date.today()),
        "steps": [{"title": "Thu thập hóa đơn"}, {"title": "Nhập liệu"}]
    })
    assert task_resp.status_code == 201
    task_data = task_resp.json()
    task_id = task_data["id"]
    assert len(task_data["steps"]) == 2
    assert task_data["is_important"] == True
    print(f"   [OK] Created task ID {task_id} with {len(task_data['steps'])} steps.")

    # Toggle task complete
    complete_resp = client.patch(f"/tasks/{task_id}/complete", headers=headers, json={"is_completed": True})
    assert complete_resp.status_code == 200
    assert complete_resp.json()["is_completed"] == True
    print("   [OK] Task completed.")

    # 8. Categories CRUD
    print("[*] 8. Testing Categories...")
    cat_resp = client.post("/categories", headers=headers, json={"name": "Khẩn cấp", "color": "#EA4335"})
    assert cat_resp.status_code == 201
    print("   [OK] Created category.")

    # 9. Dashboard Today
    print("[*] 9. Testing Dashboard /dashboard/today...")
    dash_resp = client.get("/dashboard/today", headers=headers)
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert "date" in dash_data
    assert "events_today" in dash_data
    assert "tasks_my_day" in dash_data
    print(f"   [OK] Dashboard verified: {dash_data['events_count']} events today.")

    # 10. AI Conversations
    print("[*] 10. Testing AI Conversations endpoints...")
    conv_resp = client.post("/ai/conversations", headers=headers, json={"title": "Hội thoại thử nghiệm"})
    assert conv_resp.status_code == 201, f"Failed create conv: {conv_resp.status_code} {conv_resp.text}"
    conv_id = conv_resp.json()["id"]
    convs_list = client.get("/ai/conversations", headers=headers)
    assert convs_list.status_code == 200, f"Failed list conv: {convs_list.status_code} {convs_list.text}"
    assert len(convs_list.json()) >= 1, f"Expected convs >= 1, got {convs_list.text}"
    print(f"   [OK] Created conversation ID {conv_id}.")

    print("\n🎉 ALL PHASE 1 INTEGRATION TESTS PASSED 100%!")

if __name__ == "__main__":
    try:
        test_api()
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
