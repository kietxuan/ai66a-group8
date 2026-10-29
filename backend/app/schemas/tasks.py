import re
from datetime import date, datetime, time
from typing import Annotated, Literal

from pydantic import BeforeValidator, Field, StrictBool, StrictInt, field_serializer, field_validator, model_validator

from app.schemas.auth import StrictSchema


def parse_date(value):
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Ngày phải có định dạng YYYY-MM-DD")
    return date.fromisoformat(value)


def parse_time(value):
    if isinstance(value, time) and not value.tzinfo and value.second == value.microsecond == 0:
        return value
    if not isinstance(value, str) or not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", value):
        raise ValueError("Giờ phải có định dạng HH:MM (00:00–23:59)")
    return time.fromisoformat(value)


BusinessDate = Annotated[date, BeforeValidator(parse_date)]
BusinessTime = Annotated[time, BeforeValidator(parse_time)]
Priority = Literal["low", "medium", "high"]
Status = Literal["pending", "completed"]


class TaskPayload(StrictSchema):
    title: str
    description: str | None = Field(default=None, max_length=2000)
    task_date: BusinessDate
    start_time: BusinessTime | None = None
    end_time: BusinessTime | None = None
    priority: Priority = "medium"
    category_id: Annotated[StrictInt, Field(gt=0)] | None = None
    allow_conflict: StrictBool = False
    expected_version: str | None = Field(default=None, min_length=1, max_length=64)

    @field_serializer("start_time", "end_time", when_used="json")
    def minute_time(self, value):
        return value.strftime("%H:%M") if value is not None else None

    @field_validator("title")
    @classmethod
    def title_valid(cls, value):
        value = value.strip()
        if not 1 <= len(value) <= 200:
            raise ValueError("Tiêu đề từ 1 đến 200 ký tự")
        return value

    @model_validator(mode="after")
    def time_pair(self):
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("Cần cả giờ bắt đầu và kết thúc, hoặc để cả ngày")
        if self.start_time and self.end_time <= self.start_time:
            raise ValueError("Giờ kết thúc phải sau giờ bắt đầu; không hỗ trợ qua đêm")
        return self


class StatusPayload(StrictSchema):
    status: Status
    allow_conflict: StrictBool = False
    expected_version: str | None = Field(default=None, min_length=1, max_length=64)


class TaskFilters(StrictSchema):
    task_date: BusinessDate | None = None
    date_from: BusinessDate | None = None
    date_to: BusinessDate | None = None
    status: Status | None = None
    priority: Priority | None = None
    category_id: int | None = Field(default=None, gt=0)
    search: str | None = None
    all_day: bool | None = None
    start_time: BusinessTime | None = None
    end_time: BusinessTime | None = None

    @field_serializer("start_time", "end_time", when_used="json")
    def minute_time(self, value):
        return value.strftime("%H:%M") if value is not None else None

    @field_validator("search")
    @classmethod
    def search_valid(cls, value):
        if value is None:
            return None
        value = value.strip()
        if len(value) > 200:
            raise ValueError("Tìm kiếm tối đa 200 ký tự")
        return value or None

    @model_validator(mode="after")
    def ranges(self):
        if self.task_date and (self.date_from or self.date_to):
            raise ValueError("Không kết hợp ngày đơn và khoảng ngày")
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc")
        return self
