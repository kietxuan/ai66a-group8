"""Shared overlap check for human CRUD and calendar drag operations."""
from datetime import datetime, timedelta
from fastapi import HTTPException
from app.core.time import BUSINESS_TZ
from app.services.recurrence import aware
from app.services.recurrence import occurrences, parse_rule, parse_until


def checked_occurrences(start, end, rule=None, recurrence_end=None):
    """Finite series: full range (up to 1000 instances); unbounded: next year."""
    if not rule:
        return [(start, end)]
    params = parse_rule(rule)
    until = parse_until(params['UNTIL']) if params.get('UNTIL') else recurrence_end
    if until:
        bound = datetime.max.replace(tzinfo=start.tzinfo)
        upper = aware(until) + timedelta(microseconds=1) if aware(until) < bound else bound
    elif params.get('COUNT'):
        upper = datetime.max.replace(tzinfo=start.tzinfo)
    else:
        upper = start + timedelta(days=366)
    result = []
    for occurrence in occurrences(start, end, rule, start, upper, recurrence_end):
        result.append(occurrence)
        if len(result) > 1000:
            raise HTTPException(422, 'Lịch có quá nhiều lần lặp để kiểm tra trùng giờ. Hãy chọn phạm vi ngắn hơn.')
    return result


async def check_overlap(db, user_id, start, end, exclude=None, allowed=False, rule=None, recurrence_end=None):
    if allowed or start is None or end is None:
        return
    from app.services.availability import busy_intervals
    start, end = aware(start), aware(end)
    planned = checked_occurrences(start, end, rule, recurrence_end)
    if not planned:
        return
    busy = await busy_intervals(db, user_id, planned[0][0], planned[-1][1], exclude)
    collisions = [item for item in busy if any(item['start'] < e and item['end'] > s for s, e in planned)]
    if collisions:
        raise HTTPException(409, detail={
            "code": "SCHEDULE_CONFLICT",
            "message": "Khung giờ này trùng lịch.",
            "items": [{"type": item["type"], "id": item["id"], "title": item["title"],
                       "start": item["start"].isoformat(), "end": item["end"].isoformat()}
                      for item in collisions]
        })


async def check_task_overlap(db, user_id, task, exclude=None, allowed=False):
    if task.is_all_day or not task.due_date or not (task.start_time or task.due_time):
        return
    start = datetime.combine(task.due_date, task.start_time or task.due_time, BUSINESS_TZ)
    end = datetime.combine(task.due_date, task.end_time, BUSINESS_TZ) if task.end_time else start + timedelta(minutes=task.duration_minutes or 60)
    await check_overlap(db, user_id, start, end, exclude, allowed, getattr(task, 'recurrence_rule', None))
