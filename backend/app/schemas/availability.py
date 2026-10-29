"""Read-only scheduling criteria, separate from editable task fields."""
from typing import Annotated

from pydantic import Field, StrictInt, field_serializer

from app.schemas.auth import StrictSchema
from app.schemas.tasks import BusinessDate, BusinessTime

Duration = Annotated[StrictInt, Field(ge=1, le=1439)]


class AvailabilityRequest(StrictSchema):
    # Partial criteria are retained only in the existing TTL-scoped chat draft.
    task_date: BusinessDate | None = None
    duration_minutes: Duration | None = None
    start_time: BusinessTime | None = None
    end_time: BusinessTime | None = None

    @field_serializer("start_time", "end_time", when_used="json")
    def minute_time(self, value):
        return value.strftime("%H:%M") if value is not None else None


class AvailabilityCriteria(AvailabilityRequest):
    task_date: BusinessDate
    duration_minutes: Duration
    start_time: BusinessTime
    end_time: BusinessTime


class FreeSlot(StrictSchema):
    task_date: BusinessDate
    start_time: str
    end_time: str
