from typing import List, Optional
from datetime import datetime, date, time, timedelta
import calendar
import re
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.crud.task_crud import task_crud
from app.crud.task_list_crud import task_list_crud
from app.models.task_model import Task, TaskStep
from app.schemas.task_schema import (
    TaskCreate, TaskUpdate, TaskStepCreate, TaskStepUpdate, ItemReorder
)

class TaskService:
    async def evaluate_auto_complete(self, db: AsyncSession, tasks: List[Task]) -> List[Task]:
        """
        Tự động đánh dấu hoàn thành đối với các mục có auto_complete=True (Sự kiện)
        khi thời gian kết thúc đã qua.
        """
        now = datetime.now()
        today = now.date()
        current_time = now.time()
        changed = False

        for t in tasks:
            if not t.is_completed and getattr(t, "auto_complete", False) and t.due_date:
                should_complete = False
                if t.due_date < today:
                    should_complete = True
                elif t.due_date == today and not t.is_all_day:
                    end_t = t.end_time or t.due_time or t.start_time
                    if end_t and end_t <= current_time:
                        should_complete = True
                if should_complete:
                    t.is_completed = True
                    t.completed_at = now
                    changed = True

        if changed:
            await db.commit()
        return tasks

    async def get_tasks(
        self,
        db: AsyncSession,
        user_id: int,
        list_id: Optional[int] = None,
        view: Optional[str] = None,
        is_completed: Optional[bool] = None,
        due_before: Optional[date] = None,
        due_after: Optional[date] = None
    ) -> List[Task]:
        tasks = await task_crud.get_by_filters(
            db,
            user_id=user_id,
            list_id=list_id,
            view=view,
            is_completed=is_completed,
            due_before=due_before,
            due_after=due_after
        )
        return await self.evaluate_auto_complete(db, tasks)

    async def get_task_by_id(self, db: AsyncSession, task_id: int, user_id: int) -> Task:
        task = await task_crud.get_with_steps(db, task_id=task_id)
        if not task or task.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy công việc này.")
        await self.evaluate_auto_complete(db, [task])
        return task

    async def create_task(self, db: AsyncSession, user_id: int, task_in: TaskCreate) -> Task:
        if not task_in.list_id:
            default_list = await task_list_crud.get_default(db, user_id)
            if default_list:
                task_in.list_id = default_list.id
            else:
                user_lists = await task_list_crud.get_by_user(db, user_id)
                if user_lists:
                    task_in.list_id = user_lists[0]["id"]
                else:
                    from app.schemas.task_schema import TaskListCreate
                    new_list = await task_list_crud.create(
                        db, user_id=user_id,
                        obj_in=TaskListCreate(name="Công việc cá nhân", color="#4285F4"),
                        is_default=True
                    )
                    task_in.list_id = new_list.id

        task = await task_crud.create(db, user_id=user_id, obj_in=task_in)
        await self.evaluate_auto_complete(db, [task])
        return task

    async def update_task(self, db: AsyncSession, task_id: int, user_id: int, task_in: TaskUpdate) -> Task:
        task = await self.get_task_by_id(db, task_id, user_id)
        updated = await task_crud.update(db, db_obj=task, obj_in=task_in)
        await self.evaluate_auto_complete(db, [updated])
        return updated

    async def toggle_complete(self, db: AsyncSession, task_id: int, user_id: int, is_completed: bool) -> Task:
        task = await self.get_task_by_id(db, task_id, user_id)
        updated_task = await task_crud.set_complete(db, db_obj=task, is_completed=is_completed)

        # If completed and task has recurrence, generate the next cycle task!
        if is_completed and task.recurrence_rule:
            next_due_date = self._calculate_next_due_date(task.due_date, task.recurrence_rule)
            if next_due_date is not None:
                next_rrule = self._decrement_count_in_rrule(task.recurrence_rule)
                new_task_in = TaskCreate(
                    title=task.title,
                    note=task.note,
                    location=getattr(task, "location", None),
                    list_id=task.list_id,
                    is_important=task.is_important,
                    is_in_my_day=(next_due_date == date.today()),
                    auto_complete=getattr(task, "auto_complete", False),
                    due_date=next_due_date,
                    due_time=task.due_time,
                    start_time=task.start_time,
                    end_time=task.end_time,
                    duration_minutes=task.duration_minutes,
                    is_all_day=task.is_all_day,
                    color=task.color,
                    reminder_at=None,
                    reminder_minutes=getattr(task, "reminder_minutes", 15),
                    recurrence_rule=next_rrule,
                    steps=[TaskStepCreate(title=s.title, position=s.position) for s in task.steps]
                )
                await task_crud.create(db, user_id=user_id, obj_in=new_task_in)

        return updated_task

    async def toggle_important(self, db: AsyncSession, task_id: int, user_id: int, is_important: bool) -> Task:
        task = await self.get_task_by_id(db, task_id, user_id)
        return await task_crud.set_important(db, db_obj=task, is_important=is_important)

    async def toggle_my_day(self, db: AsyncSession, task_id: int, user_id: int, is_in_my_day: bool) -> Task:
        task = await self.get_task_by_id(db, task_id, user_id)
        return await task_crud.set_my_day(db, db_obj=task, is_in_my_day=is_in_my_day)

    async def delete_task(self, db: AsyncSession, task_id: int, user_id: int) -> None:
        task = await self.get_task_by_id(db, task_id, user_id)
        await task_crud.delete(db, db_obj=task)

    async def reorder_tasks(self, db: AsyncSession, user_id: int, items: List[ItemReorder]) -> None:
        await task_crud.reorder(db, user_id=user_id, items=items)

    # --- Steps ---
    async def add_step(self, db: AsyncSession, task_id: int, user_id: int, step_in: TaskStepCreate) -> TaskStep:
        await self.get_task_by_id(db, task_id, user_id)
        return await task_crud.add_step(db, task_id=task_id, obj_in=step_in)

    async def update_step(self, db: AsyncSession, task_id: int, step_id: int, user_id: int, step_in: TaskStepUpdate) -> TaskStep:
        task = await self.get_task_by_id(db, task_id, user_id)
        step = next((s for s in task.steps if s.id == step_id), None)
        if not step:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bước này.")
        return await task_crud.update_step(db, step_obj=step, obj_in=step_in)

    async def delete_step(self, db: AsyncSession, task_id: int, step_id: int, user_id: int) -> None:
        task = await self.get_task_by_id(db, task_id, user_id)
        step = next((s for s in task.steps if s.id == step_id), None)
        if not step:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bước này.")
        await task_crud.delete_step(db, step_obj=step)

    @staticmethod
    def _parse_rrule_params(rrule_str: str) -> dict:
        params = {}
        for part in rrule_str.split(";"):
            part = part.strip()
            if "=" in part:
                k, v = part.split("=", 1)
                params[k.strip().upper()] = v.strip().upper()
        return params

    @staticmethod
    def _parse_until_date(until_val: str) -> Optional[date]:
        try:
            clean = until_val.replace("-", "")
            if "T" in clean:
                clean = clean.split("T")[0]
            if len(clean) >= 8 and clean[:8].isdigit():
                return date(int(clean[:4]), int(clean[4:6]), int(clean[6:8]))
        except Exception:
            pass
        return None

    @staticmethod
    def _decrement_count_in_rrule(rrule_str: str) -> str:
        parts = rrule_str.split(";")
        new_parts = []
        for p in parts:
            p_strip = p.strip()
            if p_strip.upper().startswith("COUNT="):
                try:
                    cnt = int(p_strip.split("=")[1])
                    new_parts.append(f"COUNT={cnt - 1}")
                except (ValueError, IndexError):
                    new_parts.append(p)
            else:
                new_parts.append(p)
        return ";".join(new_parts)

    def _calculate_next_due_date(self, current_due: Optional[date], rrule_str: str) -> Optional[date]:
        if not rrule_str:
            return None

        base_date = current_due or date.today()
        params = self._parse_rrule_params(rrule_str)
        freq = params.get("FREQ", "DAILY")

        try:
            raw_interval = int(params.get("INTERVAL", 1))
            interval = min(max(1, raw_interval), 1000)
        except (ValueError, TypeError, OverflowError):
            interval = 1

        if "COUNT" in params:
            try:
                count = int(params["COUNT"])
                if count <= 1:
                    return None
            except (ValueError, TypeError):
                pass

        until_date = None
        if "UNTIL" in params:
            until_date = self._parse_until_date(params["UNTIL"])

        next_date: date

        try:
            if freq == "DAILY":
                next_date = base_date + timedelta(days=interval)

            elif freq == "WEEKLY":
                byday_str = params.get("BYDAY")
                if byday_str:
                    day_map = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6}
                    bydays = []
                    for raw_d in byday_str.split(","):
                        d_clean = re.sub(r"^[+-]?\d+", "", raw_d.strip().upper())
                        if d_clean in day_map:
                            bydays.append(day_map[d_clean])
                    bydays = sorted(list(set(bydays)))

                    if bydays:
                        curr_wd = base_date.weekday()
                        future_days_this_week = [d for d in bydays if d > curr_wd]
                        if future_days_this_week:
                            next_wd = future_days_this_week[0]
                            next_date = base_date + timedelta(days=next_wd - curr_wd)
                        else:
                            days_to_next_mon = 7 - curr_wd
                            jump_days = days_to_next_mon + (interval - 1) * 7 + bydays[0]
                            next_date = base_date + timedelta(days=jump_days)
                    else:
                        next_date = base_date + timedelta(days=7 * interval)
                else:
                    next_date = base_date + timedelta(days=7 * interval)

            elif freq == "MONTHLY":
                total_months = (base_date.year * 12 + (base_date.month - 1)) + interval
                target_year = total_months // 12
                if target_year > 9999:
                    return None
                target_month = (total_months % 12) + 1
                max_days = calendar.monthrange(target_year, target_month)[1]
                target_day = min(base_date.day, max_days)
                next_date = date(target_year, target_month, target_day)

            elif freq == "YEARLY":
                target_year = base_date.year + interval
                if target_year > 9999:
                    return None
                target_month = base_date.month
                max_days = calendar.monthrange(target_year, target_month)[1]
                target_day = min(base_date.day, max_days)
                next_date = date(target_year, target_month, target_day)

            else:
                next_date = base_date + timedelta(days=interval)

            if next_date.year > 9999:
                return None
        except (ValueError, OverflowError):
            return None

        if until_date and next_date > until_date:
            return None

        return next_date

task_service = TaskService()
