"""Deterministic availability snapshot. Never writes, reserves or calls the AI."""
from datetime import datetime
from zoneinfo import ZoneInfo

from app.crud.tasks import conflicts

VN = ZoneInfo("Asia/Ho_Chi_Minh")
LIMIT = 3


def now_in_vietnam():
    return datetime.now(VN)


def minutes(value):
    return value.hour * 60 + value.minute


def clock(value):
    return f"{value // 60:02}:{value % 60:02}"


def free_slots(start, end, duration, busy):
    """Earliest non-overlapping duration-sized choices; merge clipped blockers.

    Taking a fourth result is enough to know whether further choices exist.
    Adjacent intervals are busy continuously, but a slot may touch a boundary.
    """
    cursor = start
    gaps = []
    for left, right in sorted(busy):
        left, right = max(start, left), min(end, right)
        if left >= right:
            continue
        if left > cursor:
            gaps.append((cursor, left))
        cursor = max(cursor, right)
    if cursor < end:
        gaps.append((cursor, end))
    slots = []
    for left, right in gaps:
        while left + duration <= right:
            slots.append((left, left + duration))
            if len(slots) > LIMIT:
                return slots[:LIMIT], True
            left += duration
    return slots, False


def suggest(db, uid, criteria, now):
    """Caller validates non-past date, ordered same-day bounds and duration fit."""
    start, end = minutes(criteria.start_time), minutes(criteria.end_time)
    if criteria.task_date == now.date():
        # Do not offer an already elapsed fraction of the current minute.
        current = now.hour * 60 + now.minute + bool(now.second or now.microsecond)
        start = max(start, current)
    slots, has_more = [], False
    if start < end:
        # Exactly the same user/status/time policy as mutation conflict checks.
        blockers = conflicts(db, uid, {"task_date": criteria.task_date,
            "start_time": criteria.start_time, "end_time": criteria.end_time})
        busy = [(minutes(t.start_time), minutes(t.end_time)) for t in blockers]
        slots, has_more = free_slots(start, end, criteria.duration_minutes, busy)
    return {"criteria": criteria.model_dump(mode="json"),
        "effective_start_time": clock(start) if start < end else None,
        "checked_at": now.isoformat(),
        "slots": [{"task_date": criteria.task_date.isoformat(),
            "start_time": clock(left), "end_time": clock(right)} for left, right in slots],
        "has_more": has_more}
