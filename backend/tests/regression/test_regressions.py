"""Run only against the disposable stack in docker-compose.test.yml; no provider/email calls."""
import os
import asyncio
import json
import unittest
from datetime import datetime, date, timedelta, time
from unittest.mock import AsyncMock, patch
from sqlalchemy import select, text
from sqlalchemy.engine import make_url
from httpx import ASGITransport, AsyncClient

expected_url = os.environ.get("TEST_DATABASE_URL", "")
if not expected_url or expected_url != os.environ.get("DATABASE_URL") or not make_url(expected_url).database.endswith("_test"):
    raise RuntimeError("Set DATABASE_URL=TEST_DATABASE_URL to a dedicated *_test PostgreSQL database.")

from main import app
from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.core.redis import redis_client
from app.core.security import hash_password
from app.models.user_model import User
from app.models.task_model import Task, TaskList
from app.models.calendar_model import Calendar
from app.models.event_model import Event
from app.services.task_service import task_service
from app.services.auth_service import auth_service
from app.services.user_service import user_service
from app.schemas.task_schema import TaskCreate
from app.schemas.user_schema import UserCreate
from app.ai.agent import planify_agent
from app.ai.tool_executor import ToolExecutor
from app.ai.confirmation import pending_actions


class RegressionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.email_patch = patch("app.helper.otp._send_email_sync", side_effect=AssertionError("Real email forbidden in tests"))
        self.email_patch.start()
        self.provider_patch = patch.object(planify_agent, "_call_groq", side_effect=AssertionError("Real provider forbidden in tests"))
        self.provider_patch.start()
        self.client = AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test")
        await redis_client.connect()
        await redis_client.redis.flushdb()  # Isolated Redis container, never the running app's Redis.
        async with AsyncSessionLocal() as db:
            current = (await db.execute(text("select current_database()"))).scalar()
            self.assertEqual(current, make_url(expected_url).database)
            await db.execute(text("TRUNCATE users CASCADE"))
            password = await hash_password("QaPassword123!")
            self.users = []
            for label in ("a", "b"):
                user = User(email=f"qa.{label}@example.com", nickname=label, password_hashed=password, notify_enabled=False)
                db.add(user)
                await db.flush()
                cal = Calendar(user_id=user.id, name="Default", is_default=True)
                task_list = TaskList(user_id=user.id, name="Default", is_default=True)
                db.add_all([cal, task_list])
                await db.flush()
                self.users.append((user.id, cal.id, task_list.id))
            await db.commit()
        self.headers = []
        for label in ("a", "b"):
            response = await self.client.post("/api/v1/auth/login", json={"email": f"qa.{label}@example.com", "password": "QaPassword123!"})
            self.assertEqual(response.status_code, 200, response.text)
            self.headers.append({"Authorization": f"Bearer {response.json()['access_token']}"})
        pending_actions.actions.clear()

    async def asyncTearDown(self):
        await self.client.aclose()
        await redis_client.close()
        await engine.dispose()
        self.provider_patch.stop()
        self.email_patch.stop()

    async def request(self, method, path, user=0, expected=200, **kwargs):
        response = await self.client.request(method, "/api/v1" + path, headers=self.headers[user], **kwargs)
        self.assertEqual(response.status_code, expected, response.text)
        return response.json() if response.content else None

    async def task(self, **kwargs):
        return await self.request("POST", "/tasks", expected=201, json={"title": "Test task", **kwargs})

    async def event(self, **kwargs):
        return await self.request("POST", "/events", expected=201, json={"title": "Test event", "start_at": "2030-01-01T09:00:00+07:00", "end_at": "2030-01-01T10:00:00+07:00", **kwargs})

    async def test_registration_requires_proof_on_both_routes(self):
        for path in ("/auth/register", "/users/register"):
            await self.request("POST", path, expected=400, json={"email": "new@example.com", "nickname": "New", "password": "QaPassword123!"})
        await redis_client.redis.set("verified-token:verify-email:new@example.com", "one-use-proof", ex=60)
        user = await self.request("POST", "/auth/register", expected=201, json={"email": "new@example.com", "nickname": "New", "password": "QaPassword123!", "verified_token": "one-use-proof"})
        self.assertEqual(user["data"]["email"], "new@example.com")
        async with AsyncSessionLocal() as db:
            self.assertIsNone(await redis_client.redis.get("verified-token:verify-email:new@example.com"))
            new_id = user["data"]["id"]
            self.assertIsNotNone((await db.execute(select(TaskList).where(TaskList.user_id == new_id))).scalar())
            self.assertIsNotNone((await db.execute(select(Calendar).where(Calendar.user_id == new_id))).scalar())

    async def test_password_profile_and_invalid_inputs(self):
        for password in ("short", "ậ" * 25):
            await self.request("POST", "/auth/register", expected=422, json={"email": "new@example.com", "nickname": "New", "password": password})
        for payload in ({"timezone": "Bad/Timezone"}, {"nickname": " "}, {"theme_preference": "pink"}, {"notify_minutes_before": -1}):
            await self.request("PUT", "/users/me", expected=422, json=payload)
        await self.request("GET", "/users", expected=403)
        for body in ("{", "[]", '{"email":[],"password":{}}'):
            response = await self.client.post("/api/v1/auth/login", content=body, headers={"Content-Type": "application/json"})
            self.assertIn(response.status_code, (400, 401, 422), response.text)

    async def test_password_change_revokes_tokens(self):
        await self.request("PUT", "/users/me/password", json={"current_password": "QaPassword123!", "new_password": "NewPassword123!"})
        await self.request("GET", "/users/me", expected=401)
        await self.request("GET", "/users/me", user=1)

    async def test_inactive_user_token_rejected(self):
        async with AsyncSessionLocal() as db:
            user = await db.get(User, self.users[0][0]); user.is_activate = False
            await db.commit()
        await self.request("GET", "/tasks", expected=401)

    async def test_otp_transport_failure_cooldown_attempts_and_replay(self):
        self.assertEqual((await self.client.post("/api/v1/otp/verify?email=x@example.com&otp=123456")).status_code, 422)
        with patch("app.services.auth_service.send_email", new=AsyncMock(return_value=False)):
            await self.request("POST", "/otp/send", expected=503, json={"email": "new@example.com"})
        self.assertIsNone(await redis_client.redis.get("otp:verify-email:new@example.com"))
        await self.request("POST", "/otp/send", expected=429, json={"email": "new@example.com"})
        key = "otp:verify-email:new@example.com"
        await redis_client.redis.set(key, json.dumps({"code": "123456", "attempts": 0}), ex=120)
        await self.request("POST", "/otp/verify", expected=400, json={"email": "new@example.com", "otp": "000000"})
        self.assertLessEqual(await redis_client.redis.ttl(key), 120)
        results = await asyncio.gather(*[self.client.post("/api/v1/otp/verify", json={"email": "new@example.com", "otp": "123456"}) for _ in range(2)])
        self.assertEqual(sum(r.status_code == 200 for r in results), 1)
        await self.request("POST", "/otp/verify", expected=400, json={"email": "new@example.com", "otp": "123456"})

    async def test_foreign_parent_assignment_and_ownership(self):
        await self.request("POST", "/tasks", expected=404, json={"title": "Foreign", "list_id": self.users[1][2]})
        await self.request("POST", "/events", expected=404, json={"title": "Foreign", "calendar_id": self.users[1][1], "start_at": "2030-01-01T09:00+07:00", "end_at": "2030-01-01T10:00+07:00"})
        task = await self.task(); event = await self.event()
        for path in (f"/tasks/{task['id']}", f"/events/{event['id']}"):
            await self.request("GET", path, user=1, expected=404)
            await self.request("DELETE", path, user=1, expected=404)
        await self.request("PUT", f"/tasks/{task['id']}", expected=404, json={"list_id": self.users[1][2]})
        await self.request("PUT", f"/events/{event['id']}", expected=404, json={"calendar_id": self.users[1][1]})
        await self.request("POST", "/tasks/batch", expected=404, json={"action": "move_list", "task_ids": [task["id"]], "list_id": self.users[1][2]})

    async def test_task_validation_and_all_day(self):
        for payload in ({"title": "  "}, {"title": "x" * 501}, {"location": "x" * 301}, {"duration_minutes": -1}, {"reminder_minutes": -1}, {"start_time": "11:00", "end_time": "10:00", "is_all_day": False}):
            await self.request("POST", "/tasks", expected=422, json={"title": "Task", **payload})
        task = await self.task(due_date="2030-01-01", start_time="09:00", end_time="10:00", is_all_day=False)
        await self.request("PUT", f"/tasks/{task['id']}", expected=422, json={"start_time": "11:00"})
        updated = await self.request("PUT", f"/tasks/{task['id']}", json={"is_all_day": True})
        self.assertIsNone(updated["start_time"]); self.assertIsNone(updated["end_time"]); self.assertIsNone(updated["due_time"])
        await self.request("GET", "/tasks?due_after=2030-02-01&due_before=2030-01-01", expected=422)

    async def test_task_crud_steps_lists_search_and_batch(self):
        task_list = await self.request("POST", "/task-lists", expected=201, json={"name": "QA list", "color": "#123456"})
        task = await self.task(title="Alpha", list_id=task_list["id"], steps=[{"title": "Step one"}])
        step = task["steps"][0]
        await self.request("PUT", f"/tasks/{task['id']}/steps/{step['id']}", json={"is_completed": True})
        await self.request("DELETE", f"/tasks/{task['id']}/steps/{step['id']}", expected=204)
        found = await self.request("GET", "/tasks?search=Alpha"); self.assertEqual(len(found), 1)
        await self.request("POST", "/tasks/batch", json={"action": "important", "task_ids": [task["id"]]})
        found = await self.request("GET", "/tasks?view=important"); self.assertEqual(len(found), 1)
        await self.request("DELETE", f"/task-lists/{task_list['id']}", expected=204)
        await self.request("GET", f"/tasks/{task['id']}", expected=404)
        await self.request("DELETE", f"/task-lists/{self.users[0][2]}", expected=400)

    async def test_completion_retry_concurrency_and_reopen_is_idempotent(self):
        task = await self.task(due_date="2030-01-01", recurrence_rule="FREQ=DAILY;COUNT=2", steps=[{"title": "Child"}])
        results = await asyncio.gather(*[self.client.patch(f"/api/v1/tasks/{task['id']}/complete", headers=self.headers[0], json={"is_completed": True}) for _ in range(4)])
        self.assertTrue(all(r.status_code == 200 for r in results), [r.text for r in results])
        await self.request("PATCH", f"/tasks/{task['id']}/complete", json={"is_completed": False})
        await self.request("PUT", f"/tasks/{task['id']}", json={"is_completed": True})
        tasks = await self.request("GET", "/tasks")
        self.assertEqual(len(tasks), 2)
        successor = next(t for t in tasks if t["id"] != task["id"])
        self.assertEqual(successor["due_date"], "2030-01-02")
        self.assertEqual(len(successor["steps"]), 1)
        await self.request("PATCH", f"/tasks/{successor['id']}/complete", json={"is_completed": True})
        self.assertEqual(len(await self.request("GET", "/tasks")), 2)

    async def test_auto_complete_generates_one_successor(self):
        from app.core.time import business_today
        yesterday = business_today() - timedelta(days=1)
        await self.task(due_date=str(yesterday), recurrence_rule="FREQ=DAILY;COUNT=2", auto_complete=True)
        tasks = await self.request("GET", "/tasks")
        self.assertEqual(len(tasks), 2)
        self.assertEqual(sum(t["is_completed"] for t in tasks), 1)

    async def test_my_day_expiration(self):
        task = await self.task(is_in_my_day=True)
        async with AsyncSessionLocal() as db:
            row = await db.get(Task, task["id"]); row.my_day_date = date(2000, 1, 1)
            await db.commit()
        self.assertEqual(await self.request("GET", "/tasks?view=my_day"), [])

    async def test_events_validation_range_and_calendars(self):
        await self.request("POST", "/events", expected=422, json={"title": " ", "start_at": "2030-01-01T10:00+07:00", "end_at": "2030-01-01T09:00+07:00"})
        await self.request("POST", "/events", expected=422, json={"title": "Event", "start_at": "2030-01-01T10:00+07:00", "end_at": "2030-01-01T09:00+07:00"})
        event = await self.event()
        updated = await self.request("PUT", f"/events/{event['id']}", json={"start_at": "2030-01-02T12:00+07:00"})
        self.assertIn("13:00", updated["end_at"])
        events = await self.request("GET", "/events?start=2030-01-02T00:00&end=2030-01-03T00:00"); self.assertEqual(len(events), 1)
        await self.request("GET", "/events?start=2030-01-03&end=2030-01-01", expected=422)
        cal = await self.request("POST", "/calendars", expected=201, json={"name": "QA calendar"})
        await self.request("DELETE", f"/calendars/{cal['id']}", expected=204)
        await self.request("DELETE", f"/calendars/{self.users[0][1]}", expected=400)

    async def test_recurring_event_split_and_cancelled_exception(self):
        event = await self.event(recurrence_rule="FREQ=DAILY", recurrence_end="2030-02-01T00:00+07:00")
        await self.request("PUT", f"/events/{event['id']}", expected=422, json={"title": "No anchor"})
        exception = await self.request("PUT", f"/events/{event['id']}", json={"scope": "this", "original_start": "2030-01-02T09:00+07:00", "start_at": "2030-01-02T11:00+07:00", "end_at": "2030-01-02T12:00+07:00"})
        await self.request("DELETE", f"/events/{exception['id']}", expected=204)
        cancelled = await self.request("GET", f"/events/{exception['id']}"); self.assertTrue(cancelled["is_cancelled"])
        split = await self.request("PUT", f"/events/{event['id']}", json={"scope": "following", "original_start": "2030-01-03T09:00+07:00", "start_at": "2030-01-03T11:00+07:00", "end_at": "2030-01-03T12:00+07:00"})
        self.assertGreater(datetime.fromisoformat(split["recurrence_end"]), datetime.fromisoformat(split["start_at"]))
        self.assertEqual(datetime.fromisoformat(split["recurrence_end"]), datetime.fromisoformat(event["recurrence_end"]))

    async def test_ai_confirmation_ambiguity_negation_and_scope(self):
        task = await self.task(title="Report")
        async with AsyncSessionLocal() as db:
            executor = ToolExecutor(self.users[0][0], db, 99)
            result = await executor.execute("delete_task", {"task_id": task["id"], "confirmed": True})
            self.assertTrue(result.get("requires_confirmation"))
            self.assertIsNotNone(await db.get(Task, task["id"]))
            # Another conversation/user cannot confirm this action.
            result = await planify_agent.chat(self.users[1][0], [{"role": "user", "content": "xác nhận xóa"}], db, conversation_id=99)
            self.assertIn("Không có", result["content"])
            result = await planify_agent.chat(self.users[0][0], [{"role": "user", "content": "xác nhận xóa"}], db, conversation_id=99)
            self.assertIn("Đã thực hiện", result["content"])
        await self.request("GET", f"/tasks/{task['id']}", expected=404)
        await self.task(title="Report"); await self.task(title="Report")
        async with AsyncSessionLocal() as db:
            executor = ToolExecutor(self.users[0][0], db)
            result = await executor.execute("delete_task", {"title_query": "Report"})
            self.assertFalse(result["success"]); self.assertIn("nhiều", result["error"])
            result = await planify_agent.chat(self.users[0][0], [{"role": "user", "content": "Do not delete task Report"}], db)
            self.assertIsNone(result["tool_calls"])
        self.assertEqual(len(await self.request("GET", "/tasks")), 2)

    async def test_ai_provider_failure_after_write_never_replays(self):
        responses = [{"tool_calls": [{"id": "qa1", "function": {"name": "create_task", "arguments": json.dumps({"title": "Only once"})}}]}, RuntimeError("Provider 429")]
        with patch.object(settings, "AI_API_KEY", "mock-only"), patch.object(planify_agent, "_call_groq", new=AsyncMock(side_effect=responses)):
            async with AsyncSessionLocal() as db:
                response = await planify_agent.chat(self.users[0][0], [{"role": "user", "content": "Tạo task 'Only once'"}], db)
                self.assertIn("không chạy lại", response["content"])
        self.assertEqual(len(await self.request("GET", "/tasks")), 1)

    async def test_ai_event_has_no_unlinked_task_twin(self):
        async with AsyncSessionLocal() as db:
            result = await ToolExecutor(self.users[0][0], db).execute("create_event", {"title": "Single event", "start_at": "2030-01-01T09:00+07:00", "end_at": "2030-01-01T10:00+07:00"})
            self.assertTrue(result["success"], result)
        self.assertEqual(await self.request("GET", "/tasks"), [])
        self.assertEqual(len(await self.request("GET", "/events?start=2030-01-01&end=2030-01-02")), 1)

    async def test_admin_bootstrap_never_deletes_or_changes_existing_users(self):
        import admin
        async with AsyncSessionLocal() as db:
            user = await db.get(User, self.users[1][0]); user.is_developer = True
            await db.commit()
            old_hash = user.password_hashed
            with patch.object(admin, "admin_useremail", user.email), patch.object(admin, "admin_password", "DifferentPassword123!"):
                await admin.create_admin_user(db)
            await db.refresh(user)
            self.assertEqual(user.password_hashed, old_hash)
            self.assertIsNotNone(await db.get(User, self.users[0][0]))

    async def test_availability_includes_tasks_recurrence_exceptions_and_timezone(self):
        await self.task(due_date="2030-01-03", start_time="10:00", end_time="11:00", is_all_day=False)
        master = await self.event(recurrence_rule="FREQ=DAILY")
        async with AsyncSessionLocal() as db:
            executor = ToolExecutor(self.users[0][0], db)
            conflicts = await executor.execute("check_conflicts", {"start_at": "2030-01-03T02:30:00Z", "end_at": "2030-01-03T03:30:00Z"})
            self.assertTrue(conflicts["success"], conflicts)
            self.assertEqual({row["type"] for row in conflicts["data"]["conflicts"]}, {"event", "task"})
            free = await executor.execute("find_free_slots", {"date": "2030-01-03", "work_start": "08:00", "work_end": "12:00", "duration_minutes": 60})
            self.assertEqual([(slot["start"], slot["end"]) for slot in free["data"]["free_slots"]], [("08:00", "09:00"), ("11:00", "12:00")])
        await self.request("DELETE", f"/events/{master['id']}?scope=this&occurrence_date=2030-01-03T09:00%2B07:00", expected=204)
        async with AsyncSessionLocal() as db:
            free = await ToolExecutor(self.users[0][0], db).execute("find_free_slots", {"date": "2030-01-03", "work_start": "08:00", "work_end": "12:00", "duration_minutes": 60})
            self.assertEqual(free["data"]["free_slots"][0]["end"], "10:00")

    async def test_auto_plan_never_crosses_busy_interval_or_free_slot_end(self):
        from app.core.time import business_today
        day = str(business_today())
        await self.event(start_at=f"{day}T09:00+07:00", end_at=f"{day}T12:00+07:00")
        await self.task(title="Plan one", duration_minutes=60)
        await self.task(title="Plan two", duration_minutes=60)
        async with AsyncSessionLocal() as db:
            result = await ToolExecutor(self.users[0][0], db).execute("auto_plan_my_day", {"max_tasks": 2})
            self.assertTrue(result["success"], result)
        tasks = await self.request("GET", "/tasks")
        intervals = sorted((t["start_time"], t["end_time"]) for t in tasks)
        for start, end in intervals:
            self.assertTrue(end <= "09:00:00" or start >= "12:00:00", intervals)
        self.assertLessEqual(intervals[0][1], intervals[1][0])

    async def test_confirmation_expiry_replay_and_changed_target(self):
        task = await self.task(title="Delete target")
        async with AsyncSessionLocal() as db:
            executor = ToolExecutor(self.users[0][0], db, 88)
            await executor.execute("delete_task", {"task_id": task["id"]})
        await self.request("PUT", f"/tasks/{task['id']}", json={"title": "Changed after confirmation"})
        async with AsyncSessionLocal() as db:
            executor = ToolExecutor(self.users[0][0], db, 88)
            result = await planify_agent.chat(self.users[0][0], [{"role": "user", "content": "xác nhận xóa"}], db, conversation_id=88)
            self.assertIn("thay đổi", result["content"])
            result = await planify_agent.chat(self.users[0][0], [{"role": "user", "content": "xác nhận xóa"}], db, conversation_id=88)
            self.assertIn("Không có", result["content"])
            await executor.execute("delete_task", {"task_id": task["id"]})
            pending_actions.actions[executor.context_key] = (0, "delete_task", {"task_id": task["id"]})
            result = await planify_agent.chat(self.users[0][0], [{"role": "user", "content": "xác nhận xóa"}], db, conversation_id=88)
            self.assertIn("hết hạn", result["content"])
        await self.request("GET", f"/tasks/{task['id']}")

    async def test_recurring_count_split_and_exception_update_do_not_duplicate(self):
        master = await self.event(recurrence_rule="FREQ=DAILY;COUNT=5")
        first = await self.request("PUT", f"/events/{master['id']}", json={"scope": "this", "original_start": "2030-01-02T09:00+07:00", "title": "Override"})
        second = await self.request("PUT", f"/events/{master['id']}", json={"scope": "this", "original_start": "2030-01-02T09:00+07:00", "title": "Override again"})
        self.assertEqual(first["id"], second["id"])
        split = await self.request("PUT", f"/events/{master['id']}", json={"scope": "following", "original_start": "2030-01-03T09:00+07:00", "start_at": "2030-01-03T11:00+07:00", "end_at": "2030-01-03T12:00+07:00"})
        self.assertEqual(split["recurrence_rule"], "FREQ=DAILY;COUNT=3")

    async def test_chat_api_history_ownership_confirmation_and_rate_limit(self):
        task = await self.task(title="Delete from chat")
        conv = await self.request("POST", "/ai/conversations", expected=201, json={"title": "QA chat"})
        await self.request("GET", f"/ai/conversations/{conv['id']}", user=1, expected=404)
        reply = await self.request("POST", f"/ai/conversations/{conv['id']}/messages", json={"content": "Xóa công việc 'Delete from chat'"})
        self.assertIn("Xác nhận xóa", reply["content"])
        await self.request("GET", f"/tasks/{task['id']}")
        reply = await self.request("POST", f"/ai/conversations/{conv['id']}/messages", json={"content": "xác nhận xóa"})
        await self.request("GET", f"/tasks/{task['id']}", expected=404)
        await redis_client.redis.set(f"ratelimit:ai:{self.users[0][0]}", 30, ex=60)
        await self.request("POST", "/ai/chat", expected=429, json={"content": "Xin chào"})
        await self.request("DELETE", f"/ai/conversations/{conv['id']}", expected=204)

    async def test_existing_ai_tools_happy_paths_and_ownership(self):
        async with AsyncSessionLocal() as db:
            executor = ToolExecutor(self.users[0][0], db, 71)
            async def tool(name, arguments=None):
                result = await executor.execute(name, arguments or {})
                self.assertTrue(result["success"], (name, result))
                return result["data"]
            task_list = await tool("create_task_list", {"name": "Tool list"})
            cal = await tool("create_calendar", {"name": "Tool calendar"})
            category = await tool("create_category", {"name": "Tool category"})
            task = await tool("create_task", {"title": "Tool task", "list_id": task_list["id"]})
            await tool("update_task", {"task_id": task["id"], "is_important": True})
            await tool("add_task_step", {"task_id": task["id"], "step_title": "Tool step"})
            await tool("toggle_task_step", {"task_id": task["id"], "is_completed": True})
            await tool("complete_task", {"task_id": task["id"], "is_completed": True})
            await tool("complete_task", {"task_id": task["id"], "is_completed": False})
            await tool("schedule_task_on_calendar", {"task_id": task["id"], "date": "2030-01-03", "start_time": "15:00", "duration_minutes": 30})
            await tool("update_task_list", {"list_id": task_list["id"], "name": "Renamed list"})
            await tool("update_calendar", {"calendar_id": cal["id"], "name": "Renamed calendar"})
            event = await tool("create_event", {"title": "Tool event", "calendar_id": cal["id"], "start_at": "2030-01-03T09:00+07:00", "end_at": "2030-01-03T10:00+07:00"})
            await tool("update_event", {"event_id": event["id"], "title": "Renamed event"})
            await tool("reschedule_event", {"event_id": event["id"], "shift_minutes": 30})
            for name, arguments in [("list_tasks", {}), ("search_tasks", {"query": "Tool"}), ("list_task_lists", {}), ("list_calendars", {}), ("list_categories", {}), ("get_productivity_stats", {}), ("get_schedule_summary", {"date": "2030-01-03"}), ("list_events", {"start_date": "2030-01-03", "end_date": "2030-01-04"}), ("search_events", {"query": "Tool"}), ("batch_update_tasks", {"action": "complete_by_ids", "task_ids": [task["id"]]})]:
                await tool(name, arguments)
            foreign = await executor.execute("update_calendar", {"calendar_id": self.users[1][1], "name": "No"})
            self.assertFalse(foreign["success"])
            self.assertFalse((await executor.execute("change_password", {}))["success"])

    async def test_invalid_nullable_fields_return_validation_errors_not_500(self):
        task = await self.task()
        event = await self.event()
        for field in ("is_completed", "is_important", "is_all_day", "duration_minutes", "position"):
            await self.request("PUT", f"/tasks/{task['id']}", expected=422, json={field: None})
        for field in ("start_at", "end_at", "title", "is_all_day"):
            await self.request("PUT", f"/events/{event['id']}", expected=422, json={field: None})
        await self.request("POST", "/tasks", expected=422, json={"title": "Invalid recurrence", "recurrence_rule": "FREQ=DAILY;INTERVAL=0"})
        await self.request("POST", "/calendars", expected=422, json={"name": " "})

    async def test_local_agent_never_claims_success_when_tool_fails(self):
        with patch.object(ToolExecutor, "_create_task", new=AsyncMock(side_effect=ValueError("QA write rejected"))):
            async with AsyncSessionLocal() as db:
                response = await planify_agent.chat(self.users[0][0], [{"role": "user", "content": "Tạo task 'Rejected'"}], db)
                self.assertIn("QA write rejected", response["content"])
                self.assertNotIn("thành công", response["content"])

    async def test_local_edit_delete_and_missing_time_never_fall_through_to_create(self):
        async with AsyncSessionLocal() as db:
            for message in ("Xóa sự kiện 'Meeting'", "Sửa việc cần làm 'Report'", "Tạo sự kiện 'Meeting'", "Tạo sự kiện 'Meeting' ngày mai"):
                result = await planify_agent.chat(self.users[0][0], [{"role": "user", "content": message}], db)
                self.assertFalse(any(call.get("result", {}).get("success") for call in (result["tool_calls"] or [])), (message, result))
        self.assertEqual(await self.request("GET", "/tasks"), [])
        self.assertEqual(await self.request("GET", "/events?start=2020-01-01&end=2035-01-01"), [])

    async def test_local_quoted_title_and_read_only_overdue_question_cannot_mutate_existing_task(self):
        task = await self.task(title="Hoàn thành báo cáo", due_date="2020-01-01")
        async with AsyncSessionLocal() as db:
            await planify_agent.chat(self.users[0][0], [{"role": "user", "content": "Tạo task 'Hoàn thành báo cáo'"}], db)
            await planify_agent.chat(self.users[0][0], [{"role": "user", "content": "Hôm nay còn việc quá hạn không?"}], db)
        original = await self.request("GET", f"/tasks/{task['id']}")
        self.assertFalse(original["is_completed"])
        self.assertEqual(original["due_date"], "2020-01-01")
        self.assertEqual(len(await self.request("GET", "/tasks")), 2)

    async def test_health_and_dashboard_categories(self):
        self.assertEqual((await self.client.get("/health")).status_code, 200)
        await self.request("GET", "/dashboard/today")
        await self.request("GET", "/dashboard/stats")
        category = await self.request("POST", "/categories", expected=201, json={"name": "QA", "color": "#123456"})
        await self.request("DELETE", f"/categories/{category['id']}", user=1, expected=404)
        await self.request("DELETE", f"/categories/{category['id']}", expected=204)

    async def test_dashboard_counts_recurring_events_and_vietnam_completion_day(self):
        from app.core.time import business_today
        today = business_today()
        yesterday = today - timedelta(days=1)
        await self.event(start_at=f"{yesterday}T09:00+07:00", end_at=f"{yesterday}T10:00+07:00", recurrence_rule="FREQ=DAILY")
        task = await self.task()
        async with AsyncSessionLocal() as db:
            row = await db.get(Task, task["id"])
            row.is_completed = True
            row.completed_at = datetime.fromisoformat(f"{today}T00:30:00+07:00")
            await db.commit()
        result = await self.request("GET", "/dashboard/stats")
        self.assertEqual(result["summary"]["events_today_count"], 1)
        self.assertEqual(result["summary"]["completed_today_count"], 1)
        result = await self.request("GET", "/dashboard/today")
        self.assertEqual(result["events_count"], 1)
        self.assertEqual(result["tasks_completed_today_count"], 1)

    async def test_full_export_range_and_admin_routes(self):
        await self.event()
        rows = await self.request("GET", "/events?start=0001-01-01T00:00:00Z&end=9999-12-31T23:59:59Z")
        self.assertEqual(len(rows), 1)
        for method, path in [("GET", "/dev/system-info"), ("GET", "/dev/health"), ("PATCH", "/dev/set-admin?email=qa.b@example.com")]:
            await self.request(method, path, expected=403)

    async def test_all_protected_route_shapes_reject_missing_authentication(self):
        import re
        paths = app.openapi()["paths"]
        checked = 0
        for path, operations in paths.items():
            if not path.startswith("/api/v1/") or path.startswith(("/api/v1/auth/", "/api/v1/otp/")) or path == "/api/v1/users/register":
                continue
            resolved = re.sub(r"\{[^}]+\}", "1", path)
            for method in operations:
                if method not in ("get", "post", "put", "patch", "delete"):
                    continue
                response = await self.client.request(method, resolved, json={})
                self.assertEqual(response.status_code, 401, (method, path, response.text))
                checked += 1
        self.assertGreater(checked, 40)


if __name__ == "__main__":
    unittest.main(verbosity=2)
