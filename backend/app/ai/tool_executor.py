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
from app.ai.confirmation import pending_actions
from app.core.time import local_now, business_today, BUSINESS_TZ
from app.ai.tools import TOOLS
from app.ai.scheduling import constrain_creation, fold
import re


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
    today = business_today()
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
    except (ValueError, TypeError):
        raise ValueError('Giờ không hợp lệ. Vui lòng dùng HH:MM trong khoảng 00:00–23:59.')


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
    def __init__(self, user_id: int, db: AsyncSession, conversation_id=None, request_text=None):
        self.user_id = user_id
        self.db = db
        self.context_key = (user_id, conversation_id)
        self.executions = []
        self.confirmed_action = None
        self.confirmed_overlap_action = None
        self.pending_snapshot = None
        self.request_text = request_text

    @staticmethod
    def _validate_arguments(name, arguments):
        schema = next((t['function']['parameters'] for t in TOOLS if t['function']['name'] == name), None)
        if schema is None:
            return
        properties = schema.get('properties', {})
        unknown = set(arguments) - set(properties) - {'_snapshot', 'confirmed'}
        if unknown:
            raise ValueError('Thông tin công cụ không hợp lệ: ' + ', '.join(sorted(unknown)) + '. Chưa thực hiện thao tác.')
        for key in schema.get('required', []):
            if arguments.get(key) is None:
                raise ValueError(f'Thiếu thông tin bắt buộc: {key}. Chưa thực hiện thao tác.')
        for key, value in arguments.items():
            if key not in properties or value is None:
                continue
            spec = properties[key]
            kind = spec.get('type')
            valid = {'string': isinstance(value, str), 'integer': type(value) is int,
                     'boolean': type(value) is bool, 'array': isinstance(value, list),
                     'object': isinstance(value, dict), 'number': type(value) in (int, float)}
            if kind in valid and not valid[kind]:
                raise ValueError(f'Thông tin {key} sai kiểu dữ liệu. Chưa thực hiện thao tác.')
            if 'enum' in spec and value not in spec['enum']:
                raise ValueError(f'Giá trị {key} chưa được hỗ trợ. Chưa thực hiện thao tác.')
            if kind == 'array':
                item_kind = spec.get('items', {}).get('type')
                if (item_kind == 'string' and any(not isinstance(item, str) for item in value)) or (item_kind == 'integer' and any(type(item) is not int for item in value)):
                    raise ValueError(f'Danh sách {key} chứa giá trị không hợp lệ.')

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

        try:
            if not isinstance(arguments, dict):
                raise ValueError('Thông tin công cụ phải là một object hợp lệ. Chưa thực hiện thao tác.')
            request = fold(re.sub(r'''["“”'‘’][^"“”'‘’]*["“”'‘’]''', '', self.request_text or ''))
            read_request = re.match(r'^(?:hay\s+)?(?:xem|liet ke|tim|cho toi biet|hom nay toi co|toi co|co nhung|thong ke|bao cao)\b', request)
            asks_write = re.search(r'\b(?:tao|them|xoa|sua|doi|danh dau|sap xep|lap ke hoach|dat lich|len lich)\b', request)
            if read_request and not asks_write and not tool_name.startswith(('list_', 'get_', 'search_', 'find_', 'check_')):
                raise ValueError('Bạn đang yêu cầu xem thông tin, nên mình không thực hiện thay đổi dữ liệu.')
            self._validate_arguments(tool_name, arguments)
            arguments = constrain_creation(tool_name, arguments, self.request_text)
            tool_name, arguments = self._normalize_creation(tool_name, dict(arguments))
            tool_name, arguments = await self._normalize_event_action(tool_name, arguments)
            if self.confirmed_overlap_action == (tool_name, arguments):
                arguments = {**arguments, "allow_overlap": True}
            handler = tool_map.get(tool_name)
            if not handler:
                raise ValueError(f"Tool '{tool_name}' không tồn tại.")
            # Normalized aliases must also be idempotent within the same agent turn.
            if not tool_name.startswith(("list_", "get_", "search_", "find_", "check_")):
                for name, args, previous in self.executions:
                    if name == tool_name and args == arguments:
                        return previous
            destructive = tool_name.startswith("delete_") or (tool_name == "batch_update_tasks" and (arguments or {}).get("action") in ("clear_completed", "delete_by_ids"))
            if destructive and self.confirmed_action != (tool_name, arguments):
                frozen, label = await self._prepare_delete(tool_name, dict(arguments or {}))
                frozen["_snapshot"] = await self._delete_snapshot(tool_name, frozen)
                pending_actions.put(self.context_key, tool_name, frozen)
                result = {"success": False, "requires_confirmation": True, "error": f"Xác nhận xóa {label}? Trả lời 'xác nhận xóa' hoặc 'hủy'. Danh sách/lịch bị xóa sẽ xóa cả dữ liệu bên trong."}
                self.executions.append((tool_name, arguments, result))
                return result
            if destructive:
                from app.services.write_lock import lock_owner
                await lock_owner(self.db, self.user_id)
                snapshot = (arguments or {}).get("_snapshot")
                if snapshot != await self._delete_snapshot(tool_name, arguments):
                    raise ValueError("Dữ liệu đã thay đổi sau khi hỏi xác nhận. Vui lòng yêu cầu xóa lại.")
            result = await handler(**(arguments or {}))
            result = {"success": True, "data": result}
        except Exception as e:
            from fastapi import HTTPException
            detail = e.detail if isinstance(e, HTTPException) else None
            if isinstance(detail, dict) and detail.get("code") == "SCHEDULE_CONFLICT":
                pending_actions.put((*self.context_key, "schedule"), tool_name, arguments)
                result = {"success": False, "code": "SCHEDULE_CONFLICT",
                          "error": detail.get("message", "Khung giờ này trùng lịch."),
                          "items": detail.get("items", [])}
            else:
                result = {"success": False, "error": str(detail) if detail is not None else str(e)}
            await self.db.rollback()
        self.executions.append((tool_name, arguments, result))
        return result

    @staticmethod
    def _normalize_creation(name, args):
        """Match the unified form: ordinary calendar activities are scheduled Tasks.

        Explicit calendar groups and multi-day events still need the legacy Event model.
        Never create a second record merely to make an item visible in another view.
        """
        if name != "create_event" or args.get("calendar_id") or args.get("calendar_name"):
            return name, args
        from app.services.recurrence import aware
        if not args.get("start_at"):
            raise ValueError("Bạn muốn bắt đầu vào ngày nào và lúc mấy giờ?")
        start = aware(parse_datetime(args.get("start_at")))
        end = aware(parse_datetime(args["end_at"])) if args.get("end_at") else start + timedelta(days=1) if args.get("is_all_day") else start + timedelta(hours=1)
        if end <= start:
            raise ValueError("Giờ kết thúc phải sau giờ bắt đầu.")
        all_day = bool(args.get("is_all_day", False))
        if (not all_day and start.date() != end.date()) or (all_day and (start.time() != time.min or end != start + timedelta(days=1))):
            return name, args
        normalized = {
            "title": args.get("title"), "note": args.get("description"),
            "location": args.get("location"), "due_date": start.date().isoformat(),
            "is_all_day": all_day, "auto_complete": True,
            "is_in_my_day": start.date() == business_today(),
            "recurrence_rule": args.get("recurrence_rule"), "color": args.get("color"),
        }
        if not all_day:
            normalized.update(start_time=start.time().isoformat(), end_time=end.time().isoformat(),
                              duration_minutes=int((end - start).total_seconds() // 60))
        if "reminder_minutes" in args:
            normalized["reminder_minutes"] = args["reminder_minutes"]
        return "create_task", normalized

    async def _normalize_event_action(self, name, args):
        """Resolve unified event Tasks without confusing their IDs with legacy Event IDs."""
        if name in {"update_event", "reschedule_event", "delete_event"} and args.get("event_id") and args.get("task_id"):
            raise ValueError("Chỉ chọn một loại ID: task_id cho To Do hoặc event_id cho sự kiện thuộc nhóm lịch.")
        if name not in {"update_event", "reschedule_event", "delete_event"} or args.get("event_id"):
            return name, args
        target = None
        if args.get("task_id"):
            target = await self._resolve_task(task_id=args["task_id"])
        elif args.get("title_query"):
            from sqlalchemy import select
            from app.models.event_model import Event
            tasks = await task_service.get_tasks(self.db, user_id=self.user_id, view="all")
            candidates = [t for t in tasks if t.due_date]
            q = args["title_query"].strip().lower()
            if not q or not any(q in t.title.lower() for t in candidates):
                return name, args
            legacy = (await self.db.execute(select(Event).where(Event.user_id == self.user_id, Event.is_cancelled == False))).scalars().all()
            candidates += list(legacy)
            matches = [t for t in candidates if t.title.strip().lower() == q]
            matches = matches or [t for t in candidates if q in t.title.lower()]
            if len(matches) != 1:
                raise ValueError("Có nhiều mục trùng tên. Vui lòng chọn đúng loại mục và ID (task_id cho To Do, event_id cho sự kiện thuộc nhóm lịch).")
            from app.models.task_model import Task
            if not isinstance(matches[0], Task):
                return name, args
            target = matches[0]
        if target is None:
            return name, args
        if target.recurrence_rule and any(args.get(key) for key in ("scope", "original_start", "occurrence_date")):
            raise ValueError("Mục này dùng chu kỳ công việc To Do, không dùng phạm vi lặp của nhóm lịch. Vui lòng chỉnh đúng công việc theo task_id.")
        if name == "delete_event":
            return "delete_task", {"task_id": target.id}
        updates = {key: value for key, value in args.items() if key in TaskUpdate.model_fields}
        if "description" in args:
            updates["note"] = args["description"]
        start_raw = args.get("new_start_at") if name == "reschedule_event" else args.get("start_at")
        end_raw = args.get("new_end_at") if name == "reschedule_event" else args.get("end_at")
        if start_raw or end_raw or name == "reschedule_event":
            from app.services.recurrence import aware
            if not target.due_date:
                raise ValueError("Mục này chưa có ngày; vui lòng chọn ngày thực hiện.")
            old_start = datetime.combine(target.due_date, target.start_time or target.due_time or time.min, BUSINESS_TZ)
            old_end = datetime.combine(target.due_date, target.end_time, BUSINESS_TZ) if target.end_time else old_start + timedelta(days=1) if target.is_all_day else old_start + timedelta(minutes=target.duration_minutes)
            start = aware(parse_datetime(start_raw)) if start_raw else old_start
            if name == "reschedule_event" and not start_raw:
                if args.get("shift_minutes") is None:
                    raise ValueError("Cần cung cấp thời gian mới hoặc số phút muốn dời.")
                start += timedelta(minutes=int(args["shift_minutes"]))
            end = aware(parse_datetime(end_raw)) if end_raw else start + (old_end - old_start)
            all_day = updates.get("is_all_day", target.is_all_day)
            if end <= start or (not all_day and end.date() != start.date()) or (all_day and (start.time() != time.min or end != start + timedelta(days=1))):
                raise ValueError("Khung giờ To Do phải nằm trong cùng một ngày và kết thúc sau bắt đầu.")
            updates.update(due_date=start.date().isoformat(), is_in_my_day=start.date() == business_today(), is_all_day=all_day,
                           start_time=None if all_day else start.time().isoformat(), end_time=None if all_day else end.time().isoformat())
        return "update_task", {"task_id": target.id, **updates}

    async def _delete_snapshot(self, name, args):
        from sqlalchemy import select
        from app.models.task_model import Task, TaskStep, TaskList
        from app.models.event_model import Event
        from app.models.calendar_model import Calendar
        from app.models.category_model import Category
        mapping = {"delete_task": (Task, "task_id"), "delete_event": (Event, "event_id"), "delete_task_list": (TaskList, "list_id"), "delete_calendar": (Calendar, "calendar_id"), "delete_category": (Category, "category_id")}
        def snapshot(rows):
            return sorted((r.id, str(getattr(r, "updated_at", None)), getattr(r, "title", getattr(r, "name", "")), getattr(r, "is_completed", None)) for r in rows)
        if name == "delete_task_step":
            rows = (await self.db.execute(select(TaskStep).join(Task).where(TaskStep.id == args.get("step_id"), Task.user_id == self.user_id))).scalars().all()
            return snapshot(rows)
        if name == "batch_update_tasks":
            rows = (await self.db.execute(select(Task).where(Task.id.in_(args.get("task_ids") or []), Task.user_id == self.user_id))).scalars().all()
            return snapshot(rows)
        model, key = mapping[name]
        rows = (await self.db.execute(select(model).where(model.id == args.get(key), model.user_id == self.user_id))).scalars().all()
        result = snapshot(rows)
        if name in {"delete_task_list", "delete_calendar"}:
            child = Task if name == "delete_task_list" else Event
            parent = Task.list_id if child is Task else Event.calendar_id
            children = (await self.db.execute(select(child).where(parent == args.get(key), child.user_id == self.user_id))).scalars().all()
            result += snapshot(children)
        return result

    async def _prepare_delete(self, name, args):
        if name == "delete_task":
            target = await self._resolve_task(args.get("task_id"), args.get("title_query"))
            return {"task_id": target.id}, target.title
        if name == "delete_event":
            target = await self._resolve_event(args.get("event_id"), args.get("title_query"))
            return {"event_id": target.id, "scope": args.get("scope", "this"), "occurrence_date": args.get("occurrence_date")}, target.title
        if name == "delete_task_list":
            target_id = await self._resolve_list_id(args.get("list_id"), args.get("name_query"))
            target = await task_list_service.get_task_list_by_id(self.db, target_id, self.user_id)
            return {"list_id": target.id}, target.name
        if name == "delete_calendar":
            target_id = await self._resolve_calendar_id(args.get("calendar_id"), args.get("name_query"))
            target = await calendar_service.get_calendar_by_id(self.db, target_id, self.user_id)
            return {"calendar_id": target.id}, target.name
        if name == "delete_task_step":
            target = await self._resolve_task(args.get("task_id"), args.get("task_title_query"))
            matches = [s for s in target.steps if s.id == args.get("step_id") or (args.get("step_title_query") and args["step_title_query"].lower() in s.title.lower())]
            if len(matches) != 1:
                raise ValueError("Cần chọn chính xác ID bước con cần xóa.")
            return {"task_id": target.id, "step_id": matches[0].id}, matches[0].title
        if name == "delete_category":
            cats = await category_service.get_categories(self.db, self.user_id)
            matches = [c for c in cats if c.id == args.get("category_id") or (args.get("name_query") and args["name_query"].lower() in c.name.lower())]
            if len(matches) != 1:
                raise ValueError("Cần chọn chính xác ID nhãn cần xóa.")
            return {"category_id": matches[0].id}, matches[0].name
        tasks = await task_service.get_tasks(self.db, self.user_id, view="all")
        ids = [t.id for t in tasks if (t.is_completed if args.get("action") == "clear_completed" else t.id in (args.get("task_ids") or []))]
        if not ids:
            raise ValueError("Không có công việc phù hợp để xóa.")
        return {"action": "delete_by_ids", "task_ids": ids}, f"{len(ids)} công việc (IDs {ids})"

    # ==================== HELPERS ====================
    async def _resolve_task(self, task_id: Optional[int] = None, title_query: Optional[str] = None):
        if task_id:
            return await task_service.get_task_by_id(self.db, task_id=int(task_id), user_id=self.user_id)
        if title_query:
            q = title_query.strip().lower()
            all_tasks = await task_service.get_tasks(self.db, user_id=self.user_id, view="all")
            matches = [t for t in all_tasks if (t.title or "").strip().lower() == q]
            matches = matches or [t for t in all_tasks if q in (t.title or "").lower()]
            if len(matches) == 1:
                return matches[0]
            if matches:
                raise ValueError(f"Có nhiều công việc phù hợp. Vui lòng chọn ID: {[(t.id, t.title) for t in matches]}.")
        raise ValueError("Không tìm thấy công việc phù hợp. Vui lòng cung cấp tên hoặc ID công việc chính xác.")

    async def _resolve_event(self, event_id: Optional[int] = None, title_query: Optional[str] = None):
        if event_id:
            return await event_service.get_event_by_id(self.db, event_id=int(event_id), user_id=self.user_id)
        if title_query:
            q = title_query.strip().lower()
            now = local_now()
            evs = await event_service.get_events_in_range(
                self.db, user_id=self.user_id,
                start_at=now - timedelta(days=30),
                end_at=now + timedelta(days=90)
            )
            matches = [e for e in evs if not e.is_cancelled and (e.title or "").strip().lower() == q]
            matches = matches or [e for e in evs if not e.is_cancelled and q in (e.title or "").lower()]
            if len(matches) == 1:
                return matches[0]
            if matches:
                raise ValueError(f"Có nhiều sự kiện phù hợp, hãy chọn ID: {[(e.id, e.title) for e in matches]}.")
        raise ValueError("Không tìm thấy sự kiện phù hợp trên lịch.")

    async def _resolve_list_id(self, list_id: Optional[int] = None, list_name: Optional[str] = None) -> Optional[int]:
        if list_id:
            return int(list_id)
        if list_name:
            q = list_name.strip().lower()
            lists = await task_list_service.get_task_lists(self.db, user_id=self.user_id)
            matches = [l for l in lists if q == l["name"].strip().lower()] or [l for l in lists if q in l["name"].lower()]
            if len(matches) != 1:
                raise ValueError("Tên danh sách không rõ ràng; vui lòng cung cấp ID.")
            return matches[0]["id"]
        return None

    async def _resolve_calendar_id(self, calendar_id: Optional[int] = None, calendar_name: Optional[str] = None) -> Optional[int]:
        if calendar_id:
            return int(calendar_id)
        if calendar_name:
            q = calendar_name.strip().lower()
            cals = await calendar_service.get_calendars(self.db, user_id=self.user_id)
            matches = [c for c in cals if c.name.strip().lower() == q] or [c for c in cals if q in c.name.lower()]
            if len(matches) != 1:
                raise ValueError("Tên lịch không rõ ràng; vui lòng cung cấp ID.")
            return matches[0].id
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
            reminders=reminders,
            allow_overlap=kwargs.get("allow_overlap", False)
        )
        created = await event_service.create_event(self.db, user_id=self.user_id, event_in=event_in)
        return {
            "id": created.id,
            "item_type": "event",
            "title": created.title,
            "start_at": created.start_at.isoformat(),
            "end_at": created.end_at.isoformat(),
            "is_all_day": created.is_all_day,
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
            event_in=EventUpdate(start_at=s_dt, end_at=e_dt, original_start=parse_datetime(kwargs.get("original_start")), scope=kwargs.get("scope", "this"), allow_overlap=kwargs.get("allow_overlap", False))
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
        await event_service.delete_event(self.db, event_id=target.id, user_id=self.user_id, scope=scope or "this", occurrence_date=parse_datetime(kwargs.get("occurrence_date")))
        return {"deleted_event_id": target.id, "title": target.title}

    async def _list_events(self, start_date: str = None, end_date: str = None, calendar_id: int = None, **kwargs):
        today = business_today()
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
        from app.services.recurrence import expand_event_rows
        events = expand_event_rows(events, start_dt, end_dt)
        result = [
            {
                "id": e.id,
                "item_type": "event",
                "title": e.title,
                "description": e.description,
                "start_at": e.start_at.isoformat(),
                "end_at": e.end_at.isoformat(),
                "is_all_day": e.is_all_day,
                "location": e.location,
                "recurrence_rule": e.recurrence_rule
            }
            for e in events if not e.is_cancelled
        ]
        if calendar_id is None:
            from app.services.recurrence import aware
            lo, hi = aware(start_dt), aware(end_dt)
            tasks = await task_service.get_tasks(self.db, user_id=self.user_id, due_after=lo.date(), due_before=hi.date())
            for task in tasks:
                start = datetime.combine(task.due_date, time.min if task.is_all_day else task.start_time or task.due_time or time.min, BUSINESS_TZ)
                end = start + timedelta(days=1) if task.is_all_day else datetime.combine(task.due_date, task.end_time, BUSINESS_TZ) if task.end_time else start + timedelta(minutes=task.duration_minutes)
                if start < hi and end > lo:
                    result.append({"id": task.id, "task_id": task.id, "item_type": "task", "title": task.title,
                                   "description": task.note, "location": task.location, "start_at": start.isoformat(),
                                   "end_at": end.isoformat(), "is_all_day": task.is_all_day,
                                   "is_completed": task.is_completed, "recurrence_rule": task.recurrence_rule})
        return sorted(result, key=lambda item: parse_datetime(item["start_at"]).timestamp())

    async def _search_events(self, query: str, days_window: int = 60, **kwargs):
        q = (query or "").strip().lower()
        today = business_today()
        start_dt = datetime.combine(today - timedelta(days=15), time.min)
        end_dt = datetime.combine(today + timedelta(days=int(days_window or 60)), time.max)
        events = await self._list_events(start_date=start_dt.isoformat(), end_date=end_dt.isoformat())
        return [e for e in events if any(q in (e.get(field) or "").lower() for field in ("title", "description", "location"))]

    async def _check_conflicts(self, start_at: str, end_at: str, **kwargs):
        from app.services.availability import busy_intervals
        rows = await busy_intervals(self.db, self.user_id, parse_datetime(start_at), parse_datetime(end_at))
        conflicts = [{"type": r["type"], "id": r["id"], "title": r["title"], "start_at": r["start"].isoformat(), "end_at": r["end"].isoformat()} for r in rows]
        return {"has_conflict": bool(conflicts), "conflicts": conflicts}

    async def _find_free_slots(self, date: str = None, duration_minutes: int = 60, work_start: str = "08:00", work_end: str = "21:00", **kwargs):
        from app.services.availability import busy_intervals, free_intervals
        target_date = parse_date(date) if date else business_today()
        w_start, w_end = parse_time(work_start), parse_time(work_end)
        dur = int(duration_minutes)
        if not w_start or not w_end or w_end <= w_start or not 1 <= dur <= 1440:
            raise ValueError("Cần khung giờ và thời lượng hợp lệ trong cùng một ngày.")
        start = datetime.combine(target_date, w_start, BUSINESS_TZ)
        end = datetime.combine(target_date, w_end, BUSINESS_TZ)
        rows = await busy_intervals(self.db, self.user_id, start, end)
        slots = [{"start": s.strftime("%H:%M"), "end": e.strftime("%H:%M"), "duration_minutes": int((e-s).total_seconds() // 60)}
                 for s, e in free_intervals(start, end, rows) if (e-s).total_seconds() >= dur * 60]
        return {"date": str(target_date), "requested_duration_minutes": dur, "free_slots": slots[:8]}

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
        start_time_val = parse_time(kwargs.get("start_time") or kwargs.get("due_time"))
        end_time_val = parse_time(kwargs.get("end_time"))
        list_id_val = await self._resolve_list_id(kwargs.get("list_id"), kwargs.get("list_name"))

        is_all_day_val = kwargs.get("is_all_day")
        if is_all_day_val is None:
            is_all_day_val = False if start_time_val else True

        due_date_val = parse_date(kwargs.get("due_date"))
        if start_time_val and not due_date_val:
            raise ValueError("Bạn muốn đặt công việc vào ngày nào?")

        task_in = TaskCreate(
            title=title,
            note=kwargs.get("note"),
            location=kwargs.get("location"),
            auto_complete=kwargs.get("auto_complete", False),
            reminder_minutes=kwargs.get("reminder_minutes", 15),
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
            is_in_my_day=kwargs.get("is_in_my_day", due_date_val == business_today()),
            steps=[TaskStepCreate(title=str(s)) for s in steps] if steps else None,
            allow_overlap=kwargs.get("allow_overlap", False)
        )
        created = await task_service.create_task(self.db, user_id=self.user_id, task_in=task_in)
        return {
            "id": created.id,
            "item_type": "task",
            "title": created.title,
            "list_id": created.list_id,
            "is_important": created.is_important,
            "is_in_my_day": created.is_in_my_day,
            "due_date": str(created.due_date) if created.due_date else None,
            "start_time": str(created.start_time) if created.start_time else None,
            "end_time": str(created.end_time) if created.end_time else None,
            "auto_complete": created.auto_complete,
            "is_completed": created.is_completed,
            "is_all_day": created.is_all_day,
            "duration_minutes": created.duration_minutes,
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

        payload = {k: v for k, v in kwargs.items() if k in TaskUpdate.model_fields}
        if not payload:
            raise ValueError('Chưa có nội dung thay đổi hợp lệ để cập nhật công việc.')
        task_in = TaskUpdate(**payload)
        updated = await task_service.update_task(self.db, task_id=target.id, user_id=self.user_id, task_in=task_in)
        return {
            "id": updated.id,
            "item_type": "task",
            "title": updated.title,
            "due_date": str(updated.due_date) if updated.due_date else None,
            "start_time": str(updated.start_time) if updated.start_time else None,
            "end_time": str(updated.end_time) if updated.end_time else None,
            "auto_complete": updated.auto_complete,
            "recurrence_rule": updated.recurrence_rule,
            "is_important": updated.is_important,
            "is_in_my_day": updated.is_in_my_day,
            "is_completed": updated.is_completed
        }

    async def _complete_task(self, task_id: int = None, title_query: str = None, is_completed: bool = True, **kwargs):
        target = await self._resolve_task(task_id, title_query)
        updated = await task_service.toggle_complete(
            self.db, task_id=target.id, user_id=self.user_id,
            is_completed=True if is_completed is None else bool(is_completed),
            allow_overlap=kwargs.get("allow_overlap", False)
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
        today = business_today()
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
        target_date = parse_date(date) if date else local_now().date()
        dur = max(15, int(duration_minutes or target.duration_minutes or 60))

        if start_time:
            s_time = parse_time(start_time)
        else:
            free_res = await self._find_free_slots(date=str(target_date), duration_minutes=dur)
            slots = free_res.get("free_slots") or []
            if not slots:
                raise ValueError("Không có khung giờ trống đủ dài. Vui lòng chọn thời gian khác.")
            s_time = parse_time(slots[0]["start"])

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
                is_in_my_day=(target_date == local_now().date()),
                allow_overlap=kwargs.get("allow_overlap", False)
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
        if not step_id and not step_title_query and len(target.steps or []) == 1:
            target_step = target.steps[0]
        if step_title_query and len([s for s in target.steps if step_title_query.lower() in s.title.lower()]) != 1:
            raise ValueError("Có nhiều bước phù hợp; cần ID bước con chính xác.")
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
        if step_title_query and len([s for s in target.steps if step_title_query.lower() in s.title.lower()]) != 1:
            raise ValueError("Có nhiều bước phù hợp; cần ID bước con chính xác.")
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
        target_date = parse_date(raw_date) if raw_date else business_today()
        start_dt = datetime.combine(target_date, time.min)
        end_dt = datetime.combine(target_date, time.max)

        events = await event_service.get_events_in_range(self.db, user_id=self.user_id, start_at=start_dt, end_at=end_dt)
        from app.services.recurrence import expand_event_rows
        events = expand_event_rows(events, start_dt, end_dt)
        scheduled_tasks = await task_service.get_tasks(self.db, user_id=self.user_id, due_after=target_date, due_before=target_date)
        my_day_tasks = await task_service.get_tasks(self.db, user_id=self.user_id, view="my_day") if target_date == business_today() else []
        overdue_tasks = await task_service.get_tasks(self.db, user_id=self.user_id, due_before=target_date - timedelta(days=1), is_completed=False)
        free_info = await self._find_free_slots(date=str(target_date), duration_minutes=60)

        return {
            "date": str(target_date),
            "events": [
                {
                    "id": e.id,
                    "title": e.title,
                    "time": "Cả ngày" if e.is_all_day else f"{e.start_at.astimezone(BUSINESS_TZ).strftime('%H:%M')} - {e.end_at.astimezone(BUSINESS_TZ).strftime('%H:%M')}",
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
            "scheduled_tasks": [
                {"id": t.id, "title": t.title, "due_date": str(t.due_date),
                 "start_time": str(t.start_time) if t.start_time else None,
                 "end_time": str(t.end_time) if t.end_time else None, "is_completed": t.is_completed}
                for t in scheduled_tasks
            ],
            "overdue_tasks": [
                {"id": t.id, "title": t.title, "due_date": str(t.due_date)}
                for t in overdue_tasks
            ],
            "free_slots": free_info.get("free_slots", [])[:4]
        }

    async def _get_productivity_stats(self, **kwargs):
        today = business_today()
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
        today = business_today()
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
        free_res = await self._find_free_slots(date=str(today), duration_minutes=1)
        free_slots = free_res.get("free_slots", [])

        slots = [[datetime.combine(today, parse_time(s["start"]), BUSINESS_TZ), datetime.combine(today, parse_time(s["end"]), BUSINESS_TZ)] for s in free_slots]

        for t in selected:
            from app.services.write_lock import lock_owner
            from app.services.availability import busy_intervals
            await lock_owner(self.db, self.user_id)
            updates = {"is_in_my_day": True}
            if not t.due_date or t.due_date < today:
                updates["due_date"] = today

            if assign_time_blocks and (t.is_all_day or not t.start_time):
                dur = t.duration_minutes or 60
                fit = next((slot for slot in slots if slot[0] + timedelta(minutes=dur) <= slot[1]), None)
                if fit:
                    slot_Cursor = fit[0]
                    end_cursor = slot_Cursor + timedelta(minutes=dur)
                    busy = await busy_intervals(self.db, self.user_id, slot_Cursor, end_cursor, exclude=("task", t.id))
                    if busy:
                        # The earlier free-slot snapshot is stale; never write an overlapping block.
                        await self.db.rollback()
                        continue
                    updates["is_all_day"] = False
                    updates["due_date"] = today
                    updates["start_time"] = slot_Cursor.time()
                    updates["end_time"] = end_cursor.time()
                    updates["duration_minutes"] = dur
                    fit[0] = end_cursor + timedelta(minutes=15)

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
