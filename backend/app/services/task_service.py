from app.services.write_lock import serialized_write
from typing import List, Optional
from datetime import datetime, date, time, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from sqlalchemy import select
from app.core.time import business_today, local_now, BUSINESS_TZ
from app.services.recurrence import occurrences, parse_rule, parse_until, is_task_overdue
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
        now = local_now()
        today = now.date()
        changed = False
        from app.services.write_lock import lock_owner
        owners = {t.user_id for t in tasks if
            (t.is_in_my_day and t.my_day_date != today) or
            (t.auto_complete and is_task_overdue(t, now))}
        for owner in sorted(owners):
            await lock_owner(db, owner)

        evaluated = list(tasks)
        seen = {t.id for t in tasks}
        # Bound transaction size; further expired cycles are handled on the next tick/read.
        transitions = 0
        for t in evaluated:
            if t.is_in_my_day and t.my_day_date != today:
                t.is_in_my_day = False
                t.my_day_date = None
                changed = True
            if t.auto_complete and is_task_overdue(t, now) and transitions < 1000:
                await self._complete_transition(db, t.id, t.user_id, True)
                transitions += 1
                changed = True
                # Include existing successors too: a retry must not create duplicates.
                from sqlalchemy.orm import selectinload
                successor = (await db.execute(select(Task).where(
                    Task.recurrence_source_id == t.id, Task.user_id == t.user_id
                ).options(selectinload(Task.steps)))).scalars().first()
                if successor is not None and successor.id not in seen:
                    seen.add(successor.id)
                    evaluated.append(successor)

        if changed:
            await db.commit()
            # Server-generated updated_at must be loaded before async response serialization.
            for task in evaluated:
                await db.refresh(task, attribute_names=["updated_at", "completed_at", "is_completed"])
        return evaluated

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
        if due_before and due_after and due_after > due_before:
            raise HTTPException(422, "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.")
        # Catch up before applying a date/view filter, otherwise old series are invisible.
        candidates = await task_crud.get_by_filters(db, user_id=user_id, is_completed=False, due_before=business_today())
        await self.evaluate_auto_complete(db, [t for t in candidates if t.auto_complete])
        tasks = await task_crud.get_by_filters(
            db,
            user_id=user_id,
            list_id=list_id,
            view=view,
            is_completed=is_completed,
            due_before=due_before,
            due_after=due_after
        )
        # Re-query after catch-up so successors obey the requested filters and ordering.
        await self.evaluate_auto_complete(db, tasks)
        return await task_crud.get_by_filters(
            db, user_id=user_id, list_id=list_id, view=view, is_completed=is_completed,
            due_before=due_before, due_after=due_after
        )

    async def get_task_by_id(self, db: AsyncSession, task_id: int, user_id: int) -> Task:
        task = await task_crud.get_with_steps(db, task_id=task_id)
        if not task or task.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy công việc này.")
        await self.evaluate_auto_complete(db, [task])
        return task

    @serialized_write
    async def create_task(self, db: AsyncSession, user_id: int, task_in: TaskCreate) -> Task:
        task_in = self._validate_schedule(task_in)
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

        await self._check_list(db, task_in.list_id, user_id)
        task = await task_crud.create(db, user_id=user_id, obj_in=task_in)
        await self.evaluate_auto_complete(db, [task])
        return task

    @serialized_write
    async def update_task(self, db: AsyncSession, task_id: int, user_id: int, task_in: TaskUpdate) -> Task:
        task = await self.get_task_by_id(db, task_id, user_id)
        if "list_id" in task_in.model_fields_set:
            await self._check_list(db, task_in.list_id, user_id)
        payload = task_in.model_dump(exclude_unset=True)
        completed = payload.pop("is_completed", None)
        merged = {key: getattr(task, key) for key in TaskCreate.model_fields if key != "steps"}
        merged.update(payload)
        from pydantic import ValidationError
        try:
            validated = self._validate_schedule(TaskCreate(**merged), explicit_all_day=payload.get("is_all_day") is True)
        except ValidationError:
            raise HTTPException(422, "Dữ liệu công việc không hợp lệ.")
        for key in ("due_time", "start_time", "end_time", "duration_minutes", "is_all_day"):
            payload[key] = getattr(validated, key)
        task_in = TaskUpdate(**payload)
        updated = await task_crud.update(db, db_obj=task, obj_in=task_in)
        if completed is not None:
            updated = await self.toggle_complete(db, task_id, user_id, completed)
        await self.evaluate_auto_complete(db, [updated])
        return updated

    @serialized_write
    async def toggle_complete(self, db: AsyncSession, task_id: int, user_id: int, is_completed: bool) -> Task:
        task = await self._complete_transition(db, task_id, user_id, is_completed)
        await db.commit()
        return await task_crud.get_with_steps(db, task.id)

    async def _complete_transition(self, db, task_id, user_id, is_completed):
        # The lock covers the state transition and successor insert, including simultaneous retries.
        from sqlalchemy.orm import selectinload
        task = (await db.execute(select(Task).where(Task.id == task_id, Task.user_id == user_id)
            .options(selectinload(Task.steps)).with_for_update().execution_options(populate_existing=True))).scalars().first()
        if not task:
            raise HTTPException(404, "Không tìm thấy công việc này.")
        if task.is_completed == is_completed:
            return task
        task.is_completed = is_completed
        task.completed_at = local_now() if is_completed else None

        # If completed and task has recurrence, generate the next cycle task!
        existing = (await db.execute(select(Task.id).where(Task.recurrence_source_id == task.id))).first()
        if is_completed and task.recurrence_rule and not existing:
            next_due_date = self._calculate_next_due_date(
                task.due_date, task.recurrence_rule,
                time.min if task.is_all_day else task.start_time or task.due_time or time.min
            )
            if next_due_date is not None:
                next_rrule = self._decrement_count_in_rrule(task.recurrence_rule)
                new_task_in = TaskCreate(
                    title=task.title,
                    note=task.note,
                    location=getattr(task, "location", None),
                    list_id=task.list_id,
                    is_important=task.is_important,
                    is_in_my_day=(next_due_date == business_today()),
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
                await task_crud.create(db, user_id=user_id, obj_in=new_task_in, commit=False, recurrence_source_id=task.id)

        await db.flush()
        return task

    async def _check_list(self, db, list_id, user_id):
        parent = await task_list_crud.get(db, id=list_id) if list_id else None
        if not parent or parent.user_id != user_id:
            raise HTTPException(404, "Không tìm thấy danh sách này.")

    @staticmethod
    def _validate_schedule(task, explicit_all_day=None):
        if task.location and len(task.location) > 300:
            raise HTTPException(422, "Địa điểm tối đa 300 ký tự.")
        if task.duration_minutes is None or not 1 <= task.duration_minutes <= 1440:
            raise HTTPException(422, "Thời lượng phải từ 1 đến 1440 phút.")
        if task.reminder_minutes is not None and not 0 <= task.reminder_minutes <= 10080:
            raise HTTPException(422, "Thời gian nhắc không hợp lệ.")
        explicit = ("is_all_day" in task.model_fields_set and task.is_all_day) if explicit_all_day is None else explicit_all_day
        if explicit:
            task.start_time = task.end_time = task.due_time = None
        elif task.start_time or task.due_time or task.end_time:
            task.is_all_day = False
            if not task.due_date:
                raise HTTPException(422, "Công việc có giờ phải có ngày thực hiện.")
        if task.end_time and task.start_time:
            if task.end_time <= task.start_time:
                raise HTTPException(422, "Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.")
            task.duration_minutes = int((datetime.combine(date.min, task.end_time) - datetime.combine(date.min, task.start_time)).total_seconds() // 60)
            task.due_time = task.start_time
        elif task.start_time or task.due_time:
            clock = task.start_time or task.due_time
            if clock.hour * 60 + clock.minute + task.duration_minutes >= 1440:
                raise HTTPException(422, "Khung giờ công việc phải kết thúc trong cùng ngày.")
        if task.is_all_day is None:
            raise HTTPException(422, "Cần trạng thái cả ngày hợp lệ.")
        if task.recurrence_rule and task.due_date:
            start = datetime.combine(task.due_date, time.min if task.is_all_day else task.start_time or task.due_time or time.min, BUSINESS_TZ)
            if start < datetime.max.replace(tzinfo=BUSINESS_TZ) and next(occurrences(
                start, start + timedelta(microseconds=1), task.recurrence_rule,
                start, start + timedelta(microseconds=1)
            ), None) is None:
                raise HTTPException(422, "Ngày bắt đầu phải khớp chu kỳ lặp và không được sau UNTIL.")
        return task

    @serialized_write
    async def toggle_important(self, db: AsyncSession, task_id: int, user_id: int, is_important: bool) -> Task:
        task = await self.get_task_by_id(db, task_id, user_id)
        return await task_crud.set_important(db, db_obj=task, is_important=is_important)

    @serialized_write
    async def toggle_my_day(self, db: AsyncSession, task_id: int, user_id: int, is_in_my_day: bool) -> Task:
        task = await self.get_task_by_id(db, task_id, user_id)
        return await task_crud.set_my_day(db, db_obj=task, is_in_my_day=is_in_my_day)

    @serialized_write
    async def delete_task(self, db: AsyncSession, task_id: int, user_id: int) -> None:
        task = await self.get_task_by_id(db, task_id, user_id)
        await task_crud.delete(db, db_obj=task)

    @serialized_write
    async def reorder_tasks(self, db: AsyncSession, user_id: int, items: List[ItemReorder]) -> None:
        await task_crud.reorder(db, user_id=user_id, items=items)

    # --- Steps ---
    @serialized_write
    async def add_step(self, db: AsyncSession, task_id: int, user_id: int, step_in: TaskStepCreate) -> TaskStep:
        await self.get_task_by_id(db, task_id, user_id)
        return await task_crud.add_step(db, task_id=task_id, obj_in=step_in)

    @serialized_write
    async def update_step(self, db: AsyncSession, task_id: int, step_id: int, user_id: int, step_in: TaskStepUpdate) -> TaskStep:
        task = await self.get_task_by_id(db, task_id, user_id)
        step = next((s for s in task.steps if s.id == step_id), None)
        if not step:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bước này.")
        return await task_crud.update_step(db, step_obj=step, obj_in=step_in)

    @serialized_write
    async def delete_step(self, db: AsyncSession, task_id: int, step_id: int, user_id: int) -> None:
        task = await self.get_task_by_id(db, task_id, user_id)
        step = next((s for s in task.steps if s.id == step_id), None)
        if not step:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bước này.")
        await task_crud.delete_step(db, step_obj=step)

    @staticmethod
    def _parse_rrule_params(rrule_str: str) -> dict:
        return parse_rule(rrule_str)

    @staticmethod
    def _parse_until_date(until_val: str) -> Optional[date]:
        return parse_until(until_val).date()

    @staticmethod
    def _decrement_count_in_rrule(rrule_str: str) -> str:
        parts = parse_rule(rrule_str)
        if "COUNT" in parts:
            count = int(parts["COUNT"])
            if count <= 1:
                raise ValueError("Chu kỳ COUNT đã hết, không được tạo successor.")
            parts["COUNT"] = str(count - 1)
        return ";".join(f"{key}={value}" for key, value in parts.items())

    def _calculate_next_due_date(self, current_due: Optional[date], rrule_str: str, start_clock: Optional[time] = None) -> Optional[date]:
        if not rrule_str:
            return None
        params = parse_rule(rrule_str)
        # COUNT on a Task is the remaining count, including the current Task.
        # Do not pass it to the range search, which starts after this occurrence.
        if int(params.pop("COUNT", "2")) <= 1:
            return None
        start = datetime.combine(current_due or business_today(), start_clock or time.min, BUSINESS_TZ)
        if start.date() == date.max:
            return None
        rule = ";".join(f"{key}={value}" for key, value in params.items())
        next_occurrence = next(occurrences(
            start, start + timedelta(microseconds=1), rule,
            start + timedelta(microseconds=1), datetime.max.replace(tzinfo=BUSINESS_TZ)
        ), None)
        return next_occurrence[0].date() if next_occurrence else None

task_service = TaskService()
