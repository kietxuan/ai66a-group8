"""Shared overlap check for human CRUD and calendar drag operations."""
from datetime import datetime, timedelta
from fastapi import HTTPException
from app.core.time import BUSINESS_TZ
from app.services.recurrence import aware


async def check_overlap(db, user_id, start, end, exclude=None, allowed=False):
    if allowed or start is None or end is None:
        return
    from app.services.availability import busy_intervals
    start, end = aware(start), aware(end)
    collisions = [item for item in await busy_intervals(db, user_id, start, end, exclude)
                  if item["start"] < end and item["end"] > start]
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
    await check_overlap(db, user_id, start, end, exclude, allowed)
