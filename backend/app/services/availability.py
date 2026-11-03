from datetime import datetime, timedelta
from app.core.time import BUSINESS_TZ
from app.crud.event_crud import event_crud
from app.crud.task_crud import task_crud
from app.services.recurrence import aware, occurrences

async def busy_intervals(db, user_id, start, end, exclude=None):
    start, end = aware(start), aware(end)
    if end <= start:
        raise ValueError("Kết thúc phải sau bắt đầu.")
    rows = await event_crud.get_by_range(db, user_id, start, end)
    exceptions = {}
    for row in rows:
        if row.parent_event_id and row.original_start:
            exceptions.setdefault(row.parent_event_id, set()).add(aware(row.original_start))
    result = []
    for row in rows:
        if row.is_all_day or row.is_cancelled or exclude == ("event", row.id):
            continue
        for s, e in occurrences(row.start_at, row.end_at, row.recurrence_rule, start, end, row.recurrence_end):
            if not row.is_exception and s in exceptions.get(row.id, set()):
                continue
            result.append({"type": "event", "id": row.id, "title": row.title, "start": s, "end": e})
    # Recurring Tasks materialize their next Task only after completion. Their
    # future dates are not yet stored or shown in To Do/Calendar, so only the
    # concrete due_date of each active Task can occupy a time slot.
    tasks = await task_crud.get_by_filters(
        db, user_id, is_completed=False, due_after=start.date(), due_before=end.date()
    )
    for task in tasks:
        clock = task.start_time or task.due_time
        if task.is_all_day or not task.due_date or not clock or exclude == ("task", task.id):
            continue
        s = datetime.combine(task.due_date, clock, BUSINESS_TZ)
        e = datetime.combine(task.due_date, task.end_time, BUSINESS_TZ) if task.end_time else s + timedelta(minutes=task.duration_minutes or 60)
        if s < end and e > start:
            result.append({"type": "task", "id": task.id, "title": task.title, "start": s, "end": e})
    return result

def free_intervals(start, end, busy):
    start, end = aware(start), aware(end)
    intervals = sorted((max(start, item["start"]), min(end, item["end"])) for item in busy if item["start"] < end and item["end"] > start)
    cursor = start
    for s, e in intervals:
        if s > cursor:
            yield cursor, s
        cursor = max(cursor, e)
    if cursor < end:
        yield cursor, end
