from typing import Annotated, Literal

from pydantic import Field, StrictInt, field_serializer, field_validator, model_validator

from app.schemas.auth import StrictSchema
from app.schemas.availability import AvailabilityRequest
from app.schemas.tasks import BusinessDate, BusinessTime, Priority, TaskFilters, TaskPayload


class ChatRequest(StrictSchema):
    message: str
    context_id: str | None = Field(default=None, min_length=1, max_length=100)
    selected_task_id: Annotated[StrictInt, Field(gt=0)] | None = None

    @field_validator("message")
    @classmethod
    def message_valid(cls, value):
        value=value.strip()
        if not 1<=len(value)<=2000:
            raise ValueError("Nội dung từ 1 đến 2000 ký tự")
        return value


class Confirmation(StrictSchema):
    context_id: str = Field(min_length=1,max_length=100)
    decision: Literal["confirm","cancel"]


class TaskDelta(StrictSchema):
    title: str | None = None
    description: str | None = Field(default=None,max_length=2000)
    task_date: BusinessDate | None = None
    start_time: BusinessTime | None = None
    end_time: BusinessTime | None = None
    priority: Priority | None = None
    category_name: str | None = Field(default=None,max_length=50)

    @field_serializer("start_time", "end_time", when_used="json")
    def minute_time(self,value):
        return value.strftime("%H:%M") if value is not None else None

    @field_validator("title")
    @classmethod
    def title_valid(cls,value):
        return TaskPayload.title_valid(value) if value is not None else None


class ChatFilters(TaskFilters):
    category_name: str | None = Field(default=None,max_length=50)
    # Internal structured filters use category_name; IDs remain scoped/validated.


class Action(StrictSchema):
    action: Literal["create_task","get_tasks","update_task","delete_task","complete_task","suggest_free_slots","clarify","unsupported"]
    task_id: Annotated[StrictInt, Field(gt=0)] | None = None
    task_query: str | None = Field(default=None,max_length=200)
    reference: Literal["last_task", "recent_results", "last_availability"] | None = None
    fields: TaskDelta = Field(default_factory=TaskDelta)
    filters: ChatFilters = Field(default_factory=ChatFilters)
    availability: AvailabilityRequest = Field(default_factory=AvailabilityRequest)
    missing_fields: list[Literal["title","task_date","start_time","end_time","duration_minutes","priority","category_name","task","changes"]] = Field(default_factory=list)

    @model_validator(mode="after")
    def separate_availability(self):
        if self.availability.model_dump(exclude_unset=True) and self.action not in ("suggest_free_slots", "clarify"):
            raise ValueError("Availability criteria are not task edits")
        if self.reference == "last_availability" and self.action not in ("suggest_free_slots", "clarify"):
            raise ValueError("Availability references never authorize a task action")
        if self.action == "suggest_free_slots" and (self.task_id is not None or self.task_query is not None
                or self.reference not in (None, "last_availability") or self.fields.model_dump(exclude_unset=True)
                or self.filters.model_dump(exclude_unset=True)):
            raise ValueError("Availability is a separate read-only action")
        return self
