"""Shared input validation; output schemas deliberately retain legacy compatibility."""
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, field_validator, ValidationInfo
import re


class InputValidation(BaseModel):
    @field_validator("is_completed", "is_important", "is_in_my_day", "is_all_day", "auto_complete", "is_visible", "notify_enabled", "position", "duration_minutes", "notify_minutes_before", check_fields=False)
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("Trường này không được null.")
        return value

    @field_validator("recurrence_rule", check_fields=False)
    @classmethod
    def valid_rule(cls, value):
        if value is None:
            return value
        parts = dict(p.upper().split("=", 1) for p in value.split(";") if "=" in p)
        if parts.get("FREQ") not in {"DAILY", "WEEKLY", "MONTHLY", "YEARLY"} or set(parts) - {"FREQ", "INTERVAL", "COUNT", "UNTIL", "BYDAY", "BYMONTHDAY"}:
            raise ValueError("Chu kỳ lặp chưa được hỗ trợ.")
        for key in ("INTERVAL", "COUNT"):
            if key in parts and (not parts[key].isdigit() or not 1 <= int(parts[key]) <= 1000000):
                raise ValueError("Chu kỳ lặp không hợp lệ.")
        if "COUNT" in parts and "UNTIL" in parts:
            raise ValueError("Chỉ chọn COUNT hoặc UNTIL, không đồng thời cả hai.")
        if "BYDAY" in parts and any(not re.fullmatch(r"[+-]?[1-5]?(MO|TU|WE|TH|FR|SA|SU)", day) for day in parts["BYDAY"].split(",")):
            raise ValueError("Ngày lặp không hợp lệ.")
        if "BYMONTHDAY" in parts and any(not day.isdigit() or not 1 <= int(day) <= 31 for day in parts["BYMONTHDAY"].split(",")):
            raise ValueError("Ngày trong tháng không hợp lệ.")
        if "UNTIL" in parts:
            datetime.fromisoformat(parts["UNTIL"].replace("Z", "+00:00"))
        return value.upper()
    @field_validator("title", "name", "nickname", check_fields=False)
    @classmethod
    def nonblank(cls, value):
        if value is None or not value.strip():
            raise ValueError("Không được để trống.")
        return value.strip()

    @field_validator("password", "new_password", check_fields=False)
    @classmethod
    def password_length(cls, value):
        if len(value) < 8 or len(value.encode("utf-8")) > 72:
            raise ValueError("Mật khẩu phải có ít nhất 8 ký tự và không quá 72 bytes UTF-8.")
        return value

    @field_validator("timezone", check_fields=False)
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, TypeError, ValueError):
            raise ValueError("Múi giờ không hợp lệ.")
        return value

    @field_validator("theme_preference", check_fields=False)
    @classmethod
    def valid_theme(cls, value):
        if value not in {"light", "dark", "system"}:
            raise ValueError("Giao diện không hợp lệ.")
        return value

    @field_validator("start_at", "end_at", "recurrence_end", "original_start", "reminder_at", check_fields=False)
    @classmethod
    def aware_datetime(cls, value, info: ValidationInfo):
        if value is None and info.field_name in {"start_at", "end_at"}:
            raise ValueError("Cần ngày giờ hợp lệ.")
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            # Existing UI uses datetime-local for reminders; interpret it in business time.
            return value.replace(tzinfo=ZoneInfo("Asia/Ho_Chi_Minh"))
        return value
