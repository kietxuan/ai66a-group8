"""Optimistic concurrency checks for edits from a stale browser tab."""
from datetime import datetime, timezone
from fastapi import HTTPException


def require_current_revision(item, expected: str | None) -> None:
    if expected is None:
        return
    try:
        supplied = datetime.fromisoformat(expected.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, "Phiên bản dữ liệu không hợp lệ.")
    current = item.updated_at or item.created_at
    def utc(value):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    if current is None or utc(current) != utc(supplied):
        raise HTTPException(409, "Dữ liệu đã thay đổi ở nơi khác. Hãy tải lại mục trước khi lưu.")
