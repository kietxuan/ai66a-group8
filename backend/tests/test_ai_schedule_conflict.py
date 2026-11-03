import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import HTTPException

from app.ai.agent import PlanifyAgent
from app.ai.confirmation import pending_actions
from app.ai.tool_executor import ToolExecutor
from app.services.task_service import task_service


def test_ai_schedule_conflict_requires_one_explicit_continue(monkeypatch):
    async def scenario():
        user_id, conversation_id = 98531, 7418
        pending_key = (user_id, conversation_id, "schedule")
        pending_actions.take(pending_key)
        db = SimpleNamespace(rollback=AsyncMock())
        created = []

        async def create_task(db, user_id, task_in):
            if not task_in.allow_overlap:
                raise HTTPException(409, detail={
                    "code": "SCHEDULE_CONFLICT", "message": "Khung giờ này trùng lịch.",
                    "items": [{"type": "task", "id": 8, "title": "Business Analytic",
                               "start": "2026-11-04T07:15:00+07:00", "end": "2026-11-04T09:30:00+07:00"}],
                })
            created.append(task_in.title)
            return SimpleNamespace(id=17, title=task_in.title, list_id=None, is_important=False,
                                   is_in_my_day=False, due_date=task_in.due_date,
                                   start_time=task_in.start_time, end_time=task_in.end_time,
                                   auto_complete=False, is_completed=False, is_all_day=False,
                                   duration_minutes=task_in.duration_minutes,
                                   recurrence_rule=None, steps=[])

        monkeypatch.setattr(task_service, "create_task", create_task)
        executor = ToolExecutor(user_id, db, conversation_id=conversation_id, request_text="Tạo công việc học")
        result = await executor.execute("create_task", {
            "title": "Học", "due_date": "2026-11-04", "start_time": "08:00", "end_time": "09:00"
        })
        assert result["code"] == "SCHEDULE_CONFLICT"
        assert result["items"][0]["title"] == "Business Analytic"
        assert "{'code'" not in PlanifyAgent._execution_reply(executor)["content"]
        assert created == []

        agent = PlanifyAgent()
        reply = await agent.chat(user_id, [{"role": "user", "content": "vẫn tiếp tục"}], db,
                                 conversation_id=conversation_id)
        assert "Đã tạo" in reply["content"]
        assert created == ["Học"]

        again = await agent.chat(user_id, [{"role": "user", "content": "vẫn tiếp tục"}], db,
                                 conversation_id=conversation_id)
        assert "hết hạn" in again["content"]
        assert created == ["Học"]

        second = ToolExecutor(user_id, db, conversation_id=conversation_id, request_text="Tạo công việc khác")
        await second.execute("create_task", {
            "title": "Việc khác", "due_date": "2026-11-04", "start_time": "08:00", "end_time": "09:00"
        })
        cancelled = await agent.chat(user_id, [{"role": "user", "content": "hủy"}], db,
                                     conversation_id=conversation_id)
        assert "Đã hủy" in cancelled["content"]
        assert pending_actions.take(pending_key) is None
        assert created == ["Học"]

    asyncio.run(scenario())
