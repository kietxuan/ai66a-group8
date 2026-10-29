from datetime import timezone

from sqlalchemy import select

from app.core.errors import AppError
from app.crud.tasks import conflicts, own_category, own_task
from app.models import Task, User, utcnow

EDITABLE = ("title", "description", "task_date", "start_time", "end_time", "priority", "category_id")


def timestamp(value):
    return value.astimezone(timezone.utc).isoformat()


def serialize(task):
    return {"id": task.id, **{key: (getattr(task, key).isoformat() if key == "task_date"
        else getattr(task, key).strftime("%H:%M") if key in ("start_time", "end_time") and getattr(task, key)
        else getattr(task, key)) for key in EDITABLE}, "status": task.status,
        "created_at": timestamp(task.created_at), "updated_at": timestamp(task.updated_at)}


def preview(task):
    return {key: serialize(task)[key] for key in ("id", "title", "task_date", "start_time", "end_time")}


def signature(tasks):
    return {str(t.id): timestamp(t.updated_at) for t in tasks}


def execute(db, user_id, action, payload=None, task_id=None, expected_version=None,
            approved_conflicts=None):
    """One transaction and one user-row lock for every REST/chat mutation.

    approved_conflicts is backend-owned and never comes from a request schema.
    No AI/network calls occur here. Reads from auth are ended before begin.
    """
    db.rollback()
    with db.begin():
        owner = db.scalar(select(User).where(User.id == user_id).with_for_update())
        if owner is None:
            raise AppError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại")
        task = own_task(db, user_id, task_id) if task_id else None
        if expected_version is not None and timestamp(task.updated_at) != expected_version:
            raise AppError(409, "TASK_CHANGED", "Công việc đã thay đổi. Hãy gửi lại yêu cầu.")
        if action == "delete_task":
            db.delete(task)
            return None, True
        if action == "status":
            if task.status == payload.status:
                return serialize(task), False
            fields = {key: getattr(task, key) for key in EDITABLE}
            check = payload.status == "pending"
        elif action in ("create_task", "update_task"):
            fields = payload.model_dump(exclude={"allow_conflict", "expected_version"})
            own_category(db, user_id, fields["category_id"])
            check = task is None or (task.status == "pending" and any(
                getattr(task, key) != fields[key] for key in ("task_date", "start_time", "end_time")))
        else:
            raise AppError(400, "BUSINESS_RULE_ERROR", "Hành động không được hỗ trợ")
        overlaps = conflicts(db, user_id, fields, task_id) if check else []
        if overlaps:
            current = signature(overlaps)
            new_conflict = approved_conflicts is not None and any(
                approved_conflicts.get(key) != value for key, value in current.items())
            if new_conflict or (approved_conflicts is None and not payload.allow_conflict):
                raise AppError(409, "TASK_CONFLICT", "Công việc trùng lịch với kế hoạch hiện có", {
                    "conflicting_tasks": [preview(t) for t in overlaps], "versions": current})
        if action == "create_task":
            task = Task(user_id=user_id, **fields, status="pending")
            db.add(task)
            changed = True
        elif action == "status":
            task.status = payload.status
            task.updated_at = utcnow()
            changed = True
        else:
            changed = any(getattr(task, key) != value for key, value in fields.items())
            if changed:
                for key, value in fields.items():
                    setattr(task, key, value)
                task.updated_at = utcnow()
        db.flush()
        return serialize(task), changed
