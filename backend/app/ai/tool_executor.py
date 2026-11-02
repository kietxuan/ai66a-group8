from datetime import datetime, date, time, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.event_service import event_service
from app.services.task_service import task_service
from app.services.calendar_service import calendar_service
from app.services.task_list_service import task_list_service
from app.services.category_service import category_service
from app.schemas.event_schema import EventCreate, EventUpdate, EventReminderCreate
from app.schemas.task_schema import (
    TaskCreate, TaskUpdate, TaskStepCreate, TaskStepUpdate,
    TaskListCreate, TaskListUpdate
)
from app.schemas.calendar_schema import CalendarCreate, CalendarUpdate
from app.schemas.category_schema import CategoryCreate


def parse_date(val):
    if not val:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    val_str = str(val).strip()
    if not val_str:
        return None
    lower = val_str.lower()
    today = date.today()
    if lower in ("today", "hôm nay", "hom nay"):
        return today
    if lower in ("tomorrow", "ngày mai", "ngay mai"):
        return today + timedelta(days=1)
    if lower in ("ngày kia", "ngay kia"):
        return today + timedelta(days=2)
    if lower in ("yesterday", "hôm qua", "hom qua"):
        return today - timedelta(days=1)
    if "T" in val_str or " " in val_str:
        val_str = val_str.replace("Z", "+00:00")
        return datetime.fromisoformat(val_str).date()
    return date.fromisoformat(val_str)


def parse_time(val):
    if not val:
        return None
    if isinstance(val, time):
        return val
    if isinstance(val, datetime):
        return val.time()
    val_str = str(val).strip()
    if not val_str:
        return None
    if "T" in val_str or " " in val_str:
        val_str = val_str.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(val_str).time()
        except Exception:
            pass
    if len(val_str) == 5:
        val_str += ":00"
    try:
        return time.fromisoformat(val_str)
    except Exception:
        return None


def parse_datetime(val):
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, date):
        return datetime.combine(val, time.min)
    val_str = str(val).strip().replace("Z", "+00:00")
    if not val_str:
        return None
    if "T" not in val_str and " " not in val_str:
        d = parse_date(val_str)
        return datetime.combine(d, time.min)
    return datetime.fromisoformat(val_str)


class ToolExecutor:
    def __init__(self, user_id: int, db: AsyncSession):
        self.user_id = user_id
        self.db = db

    async def execute(self, tool_name: str, arguments: dict) -> dict:
        # Block any security/password tools strictly
        if tool_name in ("change_password", "update_password", "set_admin", "delete_user", "send_otp"):
            return {
                "success": False,
                "error": "Vì lý do bảo mật, AI Agent không được phép thực hiện các thao tác liên quan đến mật khẩu hoặc quyền bảo mật."
            }

        tool_map = {
            # Events
            "create_event": self._create_event,
            "update_event": self._update_event,
            "reschedule_event": self._reschedule_event,
            "delete_event": self._delete_event,
            "list_events": self._list_events,
            "search_events": self._search_events,
            "check_conflicts": self._check_conflicts,
            "find_free_slots": self._find_free_slots,
            # Calendars
            "list_calendars": self._list_calendars,
            "create_calendar": self._create_calendar,
            "update_calendar": self._update_calendar,
            "delete_calendar": self._delete_calendar,
            # Tasks
            "create_task": self._create_task,
            "update_task": self._update_task,
            "complete_task": self._complete_task,
            "delete_task": self._delete_task,
            "list_tasks": self._list_tasks,
            "search_tasks": self._search_tasks,
            "batch_update_tasks": self._batch_update_tasks,
            "schedule_task_on_calendar": self._schedule_task_on_calendar,
            # Task Steps (Subtasks)
            "add_task_step": self._add_task_step,
            "toggle_task_step": self._toggle_task_step,
            "delete_task_step": self._delete_task_step,
            # Task Lists
            "list_task_lists": self._list_task_lists,
            "create_task_list": self._create_task_list,
            "update_task_list": self._update_task_list,
            "delete_task_list": self._delete_task_list,
            # Categories
            "list_categories": self._list_categories,
            "create_category": self._create_category,
            "delete_category": self._delete_category,
            # Summary, Analytics & Auto-Planning
            "get_schedule_summary": self._get_schedule_summary,
            "get_productivity_stats": self._get_productivity_stats,
            "auto_plan_my_day": self._auto_plan_my_day,
        }

        handler = tool_map.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Tool '{tool_name}' không tồn tại."}

        try:
            result = await handler(**(arguments or {}))
            return {"success": True, "data": result}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ==================== HELPERS ====================
    async def _resolve_task(self, task_id: Optional[int] = None, title_query: Optional[str] = None):
        if task_id:
            return await task_service.get_task_by_id(self.db, task_id=int(task_id), user_id=self.user_id)
        if title_query:
            q = title_query.strip().lower()
            all_tasks = await task_service.get_tasks(self.db, user_id=self.user_id, view="all")
            # Exact match first, then substring match (prefer uncompleted)
            for t in all_tasks:
                if (t.title or "").strip().lower() == q:
                    return t
            for t in all_tasks:
                if not t.is_completed and q in (t.title or "").lower():
                    return t
            for t in all_tasks:
                if q in (t.title or "").lower():
                    return t
        raise ValueError("Không tìm thấy công việc phù hợp. Vui lòng cung cấp tên hoặc ID công việc chính xác.")

    async def _resolve_event(self, event_id: Optional[int] = None, title_query: Optional[str] = None):
        if event_id:
            return await event_service.get_event_by_id(self.db, event_id=int(event_id), user_id=self.user_id)
        if title_query:
            q = title_query.strip().lower()
            now = datetime.now()
            evs = await event_service.get_events_in_range(
                self.db, user_id=self.user_id,
                start_at=now - timedelta(days=30),
                end_at=now + timedelta(days=90)
            )
            for e in evs:
                if not e.is_cancelled and (e.title or "").strip().lower() == q:
                    return e
            for e in evs:
                if not e.is_cancelled and q in (e.title or "").lower():
                    return e
        raise ValueError("Không tìm thấy sự kiện phù hợp trên lịch.")

    async def _resolve_list_id(self, list_id: Optional[int] = None, list_name: Optional[str] = None) -> Optional[int]:
        if list_id:
            return int(list_id)
        if list_name:
            q = list_name.strip().lower()
            lists = await task_list_service.get_task_lists(self.db, user_id=self.user_id)
            for l in lists:
                if l["name"].strip().lower() == q or q in l["name"].lower():
                    return l["id"]
        return None

    async def _resolve_calendar_id(self, calendar_id: Optional[int] = None, calendar_name: Optional[str] = None) -> Optional[int]:
        if calendar_id:
            return int(calendar_id)
        if calendar_name:
            q = calendar_name.strip().lower()
            cals = await calendar_service.get_calendars(self.db, user_id=self.user_id)
            for c in cals:
                if c.name.strip().lower() == q or q in c.name.lower():
                    return c.id
        return None

    # ==================== 1. EVENT TOOLS ====================
    async def _create_event(self, title: str, start_at: str, end_at: str = None, **kwargs):
        start_dt = parse_datetime(start_at)
        end_dt = parse_datetime(end_at) if end_at else start_dt + timedelta(hours=1)
        cal_id = await self._resolve_calendar_id(kwargs.get("calendar_id"), kwargs.get("calendar_name"))
        rem_mins = kwargs.get("reminder_minutes")
        reminders = [EventReminderCreate(minutes_before=int(rem_mins))] if rem_mins is not None else None

        event_in = EventCreate(
            title=title,
            start_at=start_dt,
            end_at=end_dt,
            description=kwargs.get("description"),
            location=kwargs.get("location"),
            is_all_day=kwargs.get("is_all_day", False),
            color=kwargs.get("color"),
            recurrence_rule=kwargs.get("recurrence_rule"),
            calendar_id=cal_id,
            reminders=reminders
        )
        created = await event_service.create_event(self.db, user_id=self.user_id, event_in=event_in)
        # Đồng bộ sang bảng Task thống nhất với auto_complete=True (Sự kiện tự động hoàn thành)
        try:
            dur_mins = max(15, int((end_dt - start_dt).total_seconds() // 60))
            await task_service.create_task(
                self.db,
                user_id=self.user_id,
                task_in=TaskCreate(
                    title=title,
                    note=kwargs.get("description"),
                    location=kwargs.get("location"),
                    auto_complete=True,
                    due_date=start_dt.date(),
                    due_time=start_dt.time() if not kwargs.get("is_all_day", False) else None,
                    start_time=start_dt.time() if not kwargs.get("is_all_day", False) else None,
                    end_time=end_dt.time() if not kwargs.get("is_all_day", False) else None,
                    duration_minutes=dur_mins,
                    is_all_day=bool(kwargs.get("is_all_day", False)),
                    color=kwargs.get("color") or "#4F46E5",
                    recurrence_rule=kwargs.get("recurrence_rule")
                )
            )
        except Exception:
            pass
        return {
            "id": created.id,
            "title": created.title,
            "start_at": created.start_at.isoformat(),
            "end_at": created.end_at.isoformat(),
            "location": created.location,
            "calendar_id": created.calendar_id,
            "recurrence_rule": created.recurrence_rule
        }

    async def _update_event(self, event_id: int = None, title_query: str = None, **kwargs):
        target = await self._resolve_event(event_id, title_query)
        if "start_at" in kwargs and kwargs["start_at"]:
            kwargs["start_at"] = parse_datetime(kwargs["start_at"])
        if "end_at" in kwargs and kwargs["end_at"]:
            kwargs["end_at"] = parse_datetime(kwargs["end_at"])
        event_in = EventUpdate(**{k: v for k, v in kwargs.items() if k in EventUpdate.model_fields})
        updated = await event_service.update_event(self.db, event_id=target.id, user_id=self.user_id, event_in=event_in)
        return {
            "id": updated.id,
            "title": updated.title,
            "start_at": updated.start_at.isoformat(),
            "end_at": updated.end_at.isoformat()
        }

    async def _reschedule_event(
        self,
        event_id: int = None,
        title_query: str = None,
        new_start_at: str = None,
        new_end_at: str = None,
        shift_minutes: int = None,
        **kwargs
    ):
        target = await self._resolve_event(event_id, title_query)
        duration = target.end_at - target.start_at
        if new_start_at:
            s_dt = parse_datetime(new_start_at)
            e_dt = parse_datetime(new_end_at) if new_end_at else (s_dt + duration)
        elif shift_minutes is not None:
            delta = timedelta(minutes=int(shift_minutes))
            s_dt = target.start_at + delta
            e_dt = target.end_at + delta
        else:
            raise ValueError("Cần cung cấp new_start_at hoặc shift_minutes để dời lịch.")

        updated = await event_service.update_event(
            self.db, event_id=target.id, user_id=self.user_id,
            event_in=EventUpdate(start_at=s_dt, end_at=e_dt)
        )
        return {
            "id": updated.id,
            "title": updated.title,
            "old_start": target.start_at.isoformat(),
            "new_start": updated.start_at.isoformat(),
            "new_end": updated.end_at.isoformat()
        }

    async def _delete_event(self, event_id: int = None, title_query: str = None, scope: str = "this", **kwargs):
        target = await self._resolve_event(event_id, title_query)
        await event_service.delete_event(self.db, event_id=target.id, user_id=self.user_id, scope=scope or "this")
        return {"deleted_event_id": target.id, "title": target.title}

    async def _list_events(self, start_date: str = None, end_date: str = None, calendar_id: int = None, **kwargs):
        today = date.today()
        start_dt = parse_datetime(start_date) if start_date else datetime.combine(today, time.min)
        if end_date:
            end_dt = parse_datetime(end_date)
            if end_dt.time() == time.min:
                end_dt = datetime.combine(end_dt.date(), time.max)
        else:
            end_dt = start_dt + timedelta(days=7)

        events = await event_service.get_events_in_range(
            self.db, user_id=self.user_id, start_at=start_dt, end_at=end_dt, calendar_id=calendar_id
        )
        return [
            {
                "id": e.id,
                "title": e.title,
                "start_at": e.start_at.isoformat(),
                "end_at": e.end_at.isoformat(),
                "is_all_day": e.is_all_day,
                "location": e.location,
                "recurrence_rule": e.recurrence_rule
            }
            for e in events if not e.is_cancelled
        ]

    async def _search_events(self, query: str, days_window: int = 60, **kwargs):
        q = (query or "").strip().lower()
        today = date.today()
        start_dt = datetime.combine(today - timedelta(days=15), time.min)
        end_dt = datetime.combine(today + timedelta(days=int(days_window or 60)), time.max)
        events = await event_service.get_events_in_range(self.db, user_id=self.user_id, start_at=start_dt, end_at=end_dt)
        matched = [
            {
                "id": e.id,
                "title": e.title,
                "start_at": e.start_at.isoformat(),
                "end_at": e.end_at.isoformat(),
                "location": e.location
            }
            for e in events
            if not e.is_cancelled and (
                q in (e.title or "").lower()
                or q in (e.description or "").lower()
                or q in (e.location or "").lower()
            )
        ]
        return matched

    async def _check_conflicts(self, start_at: str, end_at: str, **kwargs):
        s_dt = parse_datetime(start_at)
        e_dt = parse_datetime(end_at)
        events = await event_service.get_events_in_range(self.db, user_id=self.user_id, start_at=s_dt, end_at=e_dt)
        conflicts = []
        for e in events:
            if e.is_cancelled or e.is_all_day:
                continue
            ev_s = e.start_at.replace(tzinfo=None) if e.start_at.tzinfo else e.start_at
            ev_e = e.end_at.replace(tzinfo=None) if e.end_at.tzinfo else e.end_at
            chk_s = s_dt.replace(tzinfo=None) if s_dt.tzinfo else s_dt
            chk_e = e_dt.replace(tzinfo=None) if e_dt.tzinfo else e_dt
            if ev_s < chk_e and ev_e > chk_s:
                conflicts.append({
                    "type": "event",
                    "id": e.id,
                    "title": e.title,
                    "start_at": e.start_at.isoformat(),
                    "end_at": e.end_at.isoformat()
                })
        return {"has_conflict": len(conflicts) > 0, "conflicts": conflicts}

    async def _find_free_slots(
        self,
        date: str = None,
        duration_minutes: int = 60,
        work_start: str = "08:00",
        work_end: str = "21:00",
        **kwargs
    ):
        target_date = parse_date(date) if date else datetime.now().date()
        w_start = parse_time(work_start) or time(8, 0)
        w_end = parse_time(work_end) or time(21, 0)
        dur = max(15, int(duration_minutes or 60))

        day_start = datetime.combine(target_date, w_start)
        day_end = datetime.combine(target_date, w_end)

        events = await event_service.get_events_in_range(
            self.db, user_id=self.user_id,
            start_at=datetime.combine(target_date, time.min),
            end_at=datetime.combine(target_date, time.max)
        )
        tasks = await task_service.get_tasks(self.db, user_id=self.user_id, view="all")

        busy_intervals = []
        for e in events:
            if e.is_cancelled or e.is_all_day:
                continue
            s = e.start_at.replace(tzinfo=None) if e.start_at.tzinfo else e.start_at
            en = e.end_at.replace(tzinfo=None) if e.end_at.tzinfo else e.end_at
            busy_intervals.append((max(day_start, s), min(day_end, en)))

        for t in tasks:
            if not t.is_completed and t.due_date == target_date and not t.is_all_day and t.start_time:
                s = datetime.combine(target_date, t.start_time)
                en = datetime.combine(target_date, t.end_time) if t.end_time else (s + timedelta(minutes=t.duration_minutes or 60))
                busy_intervals.append((max(day_start, s), min(day_end, en)))

        busy_intervals = [(s, en) for s, en in busy_intervals if en > s]
        busy_intervals.sort(key=lambda x: x[0])

        merged = []
        for s, en in busy_intervals:
            if not merged or s > merged[-1][1]:
                merged.append([s, en])
            else:
                merged[-1][1] = max(merged[-1][1], en)

        free_slots = []
        cursor = day_start
        for s, en in merged:
            if (s - cursor).total_seconds() >= dur * 60:
                free_slots.append({
                    "start": cursor.strftime("%H:%M"),
                    "end": s.strftime("%H:%M"),
                    "duration_minutes": int((s - cursor).total_seconds() // 60)
                })
            cursor = max(cursor, en)

        if (day_end - cursor).total_seconds() >= dur * 60:
            free_slots.append({
                "start": cursor.strftime("%H:%M"),
                "end": day_end.strftime("%H:%M"),
                "duration_minutes": int((day_end - cursor).total_seconds() // 60)
            })

        return {
            "date": str(target_date),
            "requested_duration_minutes": dur,
            "free_slots": free_slots[:8]
        }

    # ==================== 2. CALENDAR TOOLS ====================
    async def _list_calendars(self, **kwargs):
        cals = await calendar_service.get_calendars(self.db, user_id=self.user_id)
        return [{"id": c.id, "name": c.name, "color": c.color, "is_default": c.is_default, "is_visible": c.is_visible} for c in cals]

    async def _create_calendar(self, name: str, color: str = "#4F46E5", **kwargs):
        cal = await calendar_service.create_calendar(
            self.db, user_id=self.user_id,
            calendar_in=CalendarCreate(name=name, color=color or "#4F46E5")
        )
        return {"id": cal.id, "name": cal.name, "color": cal.color}

    async def _update_calendar(self, calendar_id: int = None, name_query: str = None, **kwargs):
        cal_id = await self._resolve_calendar_id(calendar_id, name_query)
        if not cal_id:
            raise ValueError("Không tìm thấy lịch cần cập nhật.")
        upd = await calendar_service.update_calendar(
            self.db, calendar_id=cal_id, user_id=self.user_id,
            calendar_in=CalendarUpdate(**{k: v for k, v in kwargs.items() if k in CalendarUpdate.model_fields})
        )
        return {"id": upd.id, "name": upd.name, "color": upd.color, "is_visible": upd.is_visible}

    async def _delete_calendar(self, calendar_id: int = None, name_query: str = None, **kwargs):
        cal_id = await self._resolve_calendar_id(calendar_id, name_query)
        if not cal_id:
            raise ValueError("Không tìm thấy lịch cần xóa.")
        await calendar_service.delete_calendar(self.db, calendar_id=cal_id, user_id=self.user_id)
        return {"deleted_calendar_id": cal_id}

    # ==================== 3. TASK TOOLS ====================
    async def _create_task(self, title: str, steps: list = None, **kwargs):
        start_time_val = parse_time(kwargs.get("start_time"))
        end_time_val = parse_time(kwargs.get("end_time"))
        list_id_val = await self._resolve_list_id(kwargs.get("list_id"), kwargs.get("list_name"))

        is_all_day_val = kwargs.get("is_all_day")
        if is_all_day_val is None:
            is_all_day_val = False if start_time_val else True

        due_date_val = parse_date(kwargs.get("due_date"))
        if start_time_val and not due_date_val:
            due_date_val = date.today()

        task_in = TaskCreate(
            title=title,
            note=kwargs.get("note"),
            list_id=list_id_val,
            due_date=due_date_val,
            due_time=parse_time(kwargs.get("due_time")),
            start_time=start_time_val,
            end_time=end_time_val,
            duration_minutes=kwargs.get("duration_minutes", 60),
            is_all_day=is_all_day_val,
            color=kwargs.get("color"),
            recurrence_rule=kwargs.get("recurrence_rule"),
            is_important=kwargs.get("is_important", False),
            is_in_my_day=kwargs.get("is_in_my_day", False),
            steps=[TaskStepCreate(title=str(s)) for s in steps] if steps else None
        )
        created = await task_service.create_task(self.db, user_id=self.user_id, task_in=task_in)
        return {
            "id": created.id,
            "title": created.title,
            "list_id": created.list_id,
            "is_important": created.is_important,
            "is_in_my_day": created.is_in_my_day,
            "due_date": str(created.due_date) if created.due_date else None,
            "start_time": str(created.start_time) if created.start_time else None,
            "end_time": str(created.end_time) if created.end_time else None,
            "recurrence_rule": created.recurrence_rule,
            "steps_count": len(created.steps or [])
        }

    async def _update_task(self, task_id: int = None, title_query: str = None, **kwargs):
        target = await self._resolve_task(task_id, title_query)
        if "due_date" in kwargs and kwargs["due_date"]:
            kwargs["due_date"] = parse_date(kwargs["due_date"])
        if "due_time" in kwargs and kwargs["due_time"]:
            kwargs["due_time"] = parse_time(kwargs["due_time"])
        if "start_time" in kwargs and kwargs["start_time"]:
            kwargs["start_time"] = parse_time(kwargs["start_time"])
            if "is_all_day" not in kwargs:
                kwargs["is_all_day"] = False
        if "end_time" in kwargs and kwargs["end_time"]:
            kwargs["end_time"] = parse_time(kwargs["end_time"])
        if "list_name" in kwargs and kwargs["list_name"]:
            resolved_lid = await self._resolve_list_id(None, kwargs.pop("list_name"))
            if resolved_lid:
                kwargs["list_id"] = resolved_lid

        task_in = TaskUpdate(**{k: v for k, v in kwargs.items() if k in TaskUpdate.model_fields})
        updated = await task_service.update_task(self.db, task_id=target.id, user_id=self.user_id, task_in=task_in)
        return {
            "id": updated.id,
            "title": updated.title,
            "due_date": str(updated.due_date) if updated.due_date else None,
            "is_important": updated.is_important,
            "is_in_my_day": updated.is_in_my_day,
            "is_completed": updated.is_completed
        }

    async def _complete_task(self, task_id: int = None, title_query: str = None, is_completed: bool = True, **kwargs):
        target = await self._resolve_task(task_id, title_query)
        updated = await task_service.toggle_complete(
            self.db, task_id=target.id, user_id=self.user_id,
            is_completed=True if is_completed is None else bool(is_completed)
        )
        return {"id": updated.id, "title": updated.title, "is_completed": updated.is_completed}

    async def _delete_task(self, task_id: int = None, title_query: str = None, **kwargs):
        target = await self._resolve_task(task_id, title_query)
        await task_service.delete_task(self.db, task_id=target.id, user_id=self.user_id)
        return {"deleted_task_id": target.id, "title": target.title}

    async def _list_tasks(
        self,
        view: str = None,
        list_id: int = None,
        list_name: str = None,
        is_completed: bool = None,
        search_query: str = None,
        **kwargs
    ):
        resolved_lid = await self._resolve_list_id(list_id, list_name)
        tasks = await task_service.get_tasks(
            self.db, user_id=self.user_id, view=view, list_id=resolved_lid, is_completed=is_completed
        )
        if search_query and search_query.strip():
            q = search_query.strip().lower()
            tasks = [t for t in tasks if q in (t.title or "").lower() or q in (t.note or "").lower()]

        return [
            {
                "id": t.id,
                "title": t.title,
                "is_completed": t.is_completed,
                "is_important": t.is_important,
                "is_in_my_day": t.is_in_my_day,
                "due_date": str(t.due_date) if t.due_date else None,
                "start_time": str(t.start_time)[:5] if t.start_time else None,
                "steps_count": len(t.steps or []),
                "steps_completed": sum(1 for s in (t.steps or []) if s.is_completed)
            }
            for t in tasks
        ]

    async def _search_tasks(self, query: str, **kwargs):
        return await self._list_tasks(view="all", search_query=query)

    async def _batch_update_tasks(self, action: str, task_ids: List[int] = None, **kwargs):
        all_tasks = await task_service.get_tasks(self.db, user_id=self.user_id, view="all")
        today = date.today()
        tomorrow = today + timedelta(days=1)
        affected = 0
        id_set = set(task_ids or [])

        if action == "complete_all_my_day":
            for t in all_tasks:
                if t.is_in_my_day and not t.is_completed:
                    await task_service.toggle_complete(self.db, task_id=t.id, user_id=self.user_id, is_completed=True)
                    affected += 1
        elif action == "reschedule_overdue_to_today":
            for t in all_tasks:
                if not t.is_completed and t.due_date and t.due_date < today:
                    await task_service.update_task(
                        self.db, task_id=t.id, user_id=self.user_id,
                        task_in=TaskUpdate(due_date=today, is_in_my_day=True)
                    )
                    affected += 1
        elif action == "reschedule_overdue_to_tomorrow":
            for t in all_tasks:
                if not t.is_completed and t.due_date and t.due_date < today:
                    await task_service.update_task(
                        self.db, task_id=t.id, user_id=self.user_id,
                        task_in=TaskUpdate(due_date=tomorrow)
                    )
                    affected += 1
        elif action == "add_important_to_my_day":
            for t in all_tasks:
                if not t.is_completed and t.is_important and not t.is_in_my_day:
                    await task_service.toggle_my_day(self.db, task_id=t.id, user_id=self.user_id, is_in_my_day=True)
                    affected += 1
        elif action == "clear_completed":
            for t in all_tasks:
                if t.is_completed:
                    await task_service.delete_task(self.db, task_id=t.id, user_id=self.user_id)
                    affected += 1
        elif action == "complete_by_ids":
            for t in all_tasks:
                if t.id in id_set:
                    await task_service.toggle_complete(self.db, task_id=t.id, user_id=self.user_id, is_completed=True)
                    affected += 1
        elif action == "delete_by_ids":
            for t in all_tasks:
                if t.id in id_set:
                    await task_service.delete_task(self.db, task_id=t.id, user_id=self.user_id)
                    affected += 1

        return {"action": action, "affected_count": affected}

    async def _schedule_task_on_calendar(
        self,
        task_id: int = None,
        title_query: str = None,
        date: str = None,
        start_time: str = None,
        duration_minutes: int = 60,
        **kwargs
    ):
        target = await self._resolve_task(task_id, title_query)
        target_date = parse_date(date) if date else datetime.now().date()
        dur = max(15, int(duration_minutes or target.duration_minutes or 60))

        if start_time:
            s_time = parse_time(start_time)
        else:
            free_res = await self._find_free_slots(date=str(target_date), duration_minutes=dur)
            slots = free_res.get("free_slots") or []
            s_time = parse_time(slots[0]["start"]) if slots else time(9, 0)

        s_dt = datetime.combine(target_date, s_time)
        e_dt = s_dt + timedelta(minutes=dur)

        updated = await task_service.update_task(
            self.db, task_id=target.id, user_id=self.user_id,
            task_in=TaskUpdate(
                due_date=target_date,
                start_time=s_dt.time(),
                end_time=e_dt.time(),
                duration_minutes=dur,
                is_all_day=False,
                is_in_my_day=(target_date == datetime.now().date())
            )
        )
        return {
            "id": updated.id,
            "title": updated.title,
            "due_date": str(updated.due_date),
            "start_time": s_dt.strftime("%H:%M"),
            "end_time": e_dt.strftime("%H:%M"),
            "duration_minutes": dur
        }

    # ==================== 4. SUBTASK (STEP) TOOLS ====================
    async def _add_task_step(
        self,
        task_id: int = None,
        task_title_query: str = None,
        step_title: str = None,
        steps: List[str] = None,
        **kwargs
    ):
        target = await self._resolve_task(task_id, task_title_query)
        to_add = []
        if step_title:
            to_add.append(step_title)
        if steps:
            to_add.extend([str(s) for s in steps if s])
        created_steps = []
        for idx, st in enumerate(to_add):
            s_obj = await task_service.add_step(
                self.db, task_id=target.id, user_id=self.user_id,
                step_in=TaskStepCreate(title=st, position=len(target.steps or []) + idx)
            )
            created_steps.append({"id": s_obj.id, "title": s_obj.title})
        return {"task_id": target.id, "task_title": target.title, "added_steps": created_steps}

    async def _toggle_task_step(
        self,
        task_id: int = None,
        task_title_query: str = None,
        step_id: int = None,
        step_title_query: str = None,
        is_completed: bool = True,
        **kwargs
    ):
        target = await self._resolve_task(task_id, task_title_query)
        target_step = None
        if step_id:
            target_step = next((s for s in (target.steps or []) if s.id == int(step_id)), None)
        elif step_title_query:
            q = step_title_query.strip().lower()
            target_step = next((s for s in (target.steps or []) if q in (s.title or "").lower()), None)
        if not target_step and target.steps:
            target_step = target.steps[0]
        if not target_step:
            raise ValueError("Không tìm thấy bước con (step) trong công việc này.")

        upd = await task_service.update_step(
            self.db, task_id=target.id, step_id=target_step.id, user_id=self.user_id,
            step_in=TaskStepUpdate(is_completed=bool(is_completed))
        )
        return {"task_id": target.id, "step_id": upd.id, "title": upd.title, "is_completed": upd.is_completed}

    async def _delete_task_step(
        self,
        task_id: int = None,
        task_title_query: str = None,
        step_id: int = None,
        step_title_query: str = None,
        **kwargs
    ):
        target = await self._resolve_task(task_id, task_title_query)
        target_step = None
        if step_id:
            target_step = next((s for s in (target.steps or []) if s.id == int(step_id)), None)
        elif step_title_query:
            q = step_title_query.strip().lower()
            target_step = next((s for s in (target.steps or []) if q in (s.title or "").lower()), None)
        if not target_step:
            raise ValueError("Không tìm thấy bước con cần xóa.")
        await task_service.delete_step(self.db, task_id=target.id, step_id=target_step.id, user_id=self.user_id)
        return {"deleted_step_id": target_step.id, "title": target_step.title}

    # ==================== 5. TASK LISTS & CATEGORIES ====================
    async def _list_task_lists(self, **kwargs):
        return await task_list_service.get_task_lists(self.db, user_id=self.user_id)

    async def _create_task_list(self, name: str, icon: str = "📝", color: str = "#4F46E5", **kwargs):
        created = await task_list_service.create_task_list(
            self.db, user_id=self.user_id,
            list_in=TaskListCreate(name=name, icon=icon or "📝", color=color or "#4F46E5")
        )
        return {"id": created.id, "name": created.name, "icon": created.icon, "color": created.color}

    async def _update_task_list(self, list_id: int = None, name_query: str = None, **kwargs):
        lid = await self._resolve_list_id(list_id, name_query)
        if not lid:
            raise ValueError("Không tìm thấy danh sách công việc.")
        upd = await task_list_service.update_task_list(
            self.db, list_id=lid, user_id=self.user_id,
            list_in=TaskListUpdate(**{k: v for k, v in kwargs.items() if k in TaskListUpdate.model_fields})
        )
        return {"id": upd.id, "name": upd.name, "icon": upd.icon, "color": upd.color}

    async def _delete_task_list(self, list_id: int = None, name_query: str = None, **kwargs):
        lid = await self._resolve_list_id(list_id, name_query)
        if not lid:
            raise ValueError("Không tìm thấy danh sách công việc cần xóa.")
        await task_list_service.delete_task_list(self.db, list_id=lid, user_id=self.user_id)
        return {"deleted_list_id": lid}

    async def _list_categories(self, **kwargs):
        cats = await category_service.get_categories(self.db, user_id=self.user_id)
        return [{"id": c.id, "name": c.name, "color": c.color} for c in cats]

    async def _create_category(self, name: str, color: str = "#10B981", **kwargs):
        cat = await category_service.create_category(
            self.db, user_id=self.user_id,
            cat_in=CategoryCreate(name=name, color=color or "#10B981")
        )
        return {"id": cat.id, "name": cat.name, "color": cat.color}

    async def _delete_category(self, category_id: int = None, name_query: str = None, **kwargs):
        cats = await category_service.get_categories(self.db, user_id=self.user_id)
        target = None
        if category_id:
            target = next((c for c in cats if c.id == int(category_id)), None)
        elif name_query:
            q = name_query.strip().lower()
            target = next((c for c in cats if q in c.name.lower()), None)
        if not target:
            raise ValueError("Không tìm thấy nhãn phân loại.")
        await category_service.delete_category(self.db, cat_id=target.id, user_id=self.user_id)
        return {"deleted_category_id": target.id, "name": target.name}

    # ==================== 6. SUMMARY, STATS & AUTO-PLAN ====================
    async def _get_schedule_summary(self, date_str: str = None, **kwargs):
        raw_date = date_str or kwargs.get("date")
        target_date = parse_date(raw_date) if raw_date else date.today()
        start_dt = datetime.combine(target_date, time.min)
        end_dt = datetime.combine(target_date, time.max)

        events = await event_service.get_events_in_range(self.db, user_id=self.user_id, start_at=start_dt, end_at=end_dt)
        my_day_tasks = await task_service.get_tasks(self.db, user_id=self.user_id, view="my_day")
        overdue_tasks = await task_service.get_tasks(self.db, user_id=self.user_id, due_before=target_date - timedelta(days=1), is_completed=False)
        free_info = await self._find_free_slots(date=str(target_date), duration_minutes=60)

        return {
            "date": str(target_date),
            "events": [
                {
                    "id": e.id,
                    "title": e.title,
                    "time": "Cả ngày" if e.is_all_day else f"{e.start_at.strftime('%H:%M')} - {e.end_at.strftime('%H:%M')}",
                    "location": e.location
                }
                for e in events if not e.is_cancelled
            ],
            "my_day_tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "is_completed": t.is_completed,
                    "is_important": t.is_important,
                    "start_time": str(t.start_time)[:5] if t.start_time else None
                }
                for t in my_day_tasks
            ],
            "overdue_tasks": [
                {"id": t.id, "title": t.title, "due_date": str(t.due_date)}
                for t in overdue_tasks
            ],
            "free_slots": free_info.get("free_slots", [])[:4]
        }

    async def _get_productivity_stats(self, **kwargs):
        today = date.today()
        all_tasks = await task_service.get_tasks(self.db, user_id=self.user_id, view="all")
        total = len(all_tasks)
        completed = sum(1 for t in all_tasks if t.is_completed)
        pending = total - completed
        overdue = sum(1 for t in all_tasks if not t.is_completed and t.due_date and t.due_date < today)
        important_pending = sum(1 for t in all_tasks if not t.is_completed and t.is_important)
        my_day_pending = sum(1 for t in all_tasks if not t.is_completed and t.is_in_my_day)
        rate = round((completed / total * 100), 1) if total > 0 else 0.0

        return {
            "total_tasks": total,
            "completed_tasks": completed,
            "pending_tasks": pending,
            "completion_rate_percent": rate,
            "overdue_tasks": overdue,
            "important_pending_tasks": important_pending,
            "my_day_pending_tasks": my_day_pending
        }

    async def _auto_plan_my_day(self, max_tasks: int = 5, assign_time_blocks: bool = True, **kwargs):
        today = date.today()
        all_tasks = await task_service.get_tasks(self.db, user_id=self.user_id, view="all")
        uncompleted = [t for t in all_tasks if not t.is_completed]

        # Score tasks by urgency & importance
        def priority_score(t):
            score = 0
            if t.is_in_my_day:
                score += 100
            if t.due_date:
                if t.due_date < today:
                    score += 80
                elif t.due_date == today:
                    score += 70
            if t.is_important:
                score += 50
            return score

        uncompleted.sort(key=priority_score, reverse=True)
        selected = uncompleted[:max(1, int(max_tasks or 5))]

        planned_items = []
        free_res = await self._find_free_slots(date=str(today), duration_minutes=60)
        free_slots = free_res.get("free_slots", [])

        slot_Cursor = None
        if free_slots:
            h, m = map(int, free_slots[0]["start"].split(":"))
            slot_Cursor = datetime.combine(today, time(h, m))

        for t in selected:
            updates = {"is_in_my_day": True}
            if not t.due_date or t.due_date < today:
                updates["due_date"] = today

            if assign_time_blocks and (t.is_all_day or not t.start_time) and slot_Cursor:
                dur = t.duration_minutes or 60
                end_cursor = slot_Cursor + timedelta(minutes=dur)
                if end_cursor.hour < 22:
                    updates["is_all_day"] = False
                    updates["start_time"] = slot_Cursor.time()
                    updates["end_time"] = end_cursor.time()
                    updates["duration_minutes"] = dur
                    slot_Cursor = end_cursor + timedelta(minutes=15)  # 15m break between tasks

            upd = await task_service.update_task(
                self.db, task_id=t.id, user_id=self.user_id,
                task_in=TaskUpdate(**updates)
            )
            planned_items.append({
                "id": upd.id,
                "title": upd.title,
                "start_time": str(upd.start_time)[:5] if upd.start_time else None,
                "end_time": str(upd.end_time)[:5] if upd.end_time else None,
                "is_important": upd.is_important
            })

        return {
            "date": str(today),
            "planned_count": len(planned_items),
            "planned_tasks": planned_items
        }
