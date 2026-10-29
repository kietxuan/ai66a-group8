"""Public read contracts: no ownership/password/token fields in responses."""
from typing import Annotated, Generic, Literal, TypeVar
from pydantic import BaseModel, Field
from app.schemas.auth import StrictSchema
from app.schemas.tasks import BusinessDate, Priority, Status
from app.schemas.chat import Action
from app.schemas.availability import AvailabilityCriteria, FreeSlot

T = TypeVar("T")


class Envelope(BaseModel, Generic[T]):
    data: T


class UserOut(StrictSchema):
    id: int
    name: str
    email: str


class CategoryOut(StrictSchema):
    id: int
    name: str


class TaskOut(StrictSchema):
    id: int
    title: str
    description: str | None
    task_date: BusinessDate
    start_time: str | None
    end_time: str | None
    priority: Priority
    category_id: int | None
    status: Status
    created_at: str
    updated_at: str


class TaskPreview(StrictSchema):
    title: str
    task_date: BusinessDate
    start_time: str | None = None
    end_time: str | None = None
    id: int | None = None
    description: str | None = None
    priority: Priority | None = None
    category_id: int | None = None
    status: Status | None = None
    created_at: str | None = None
    updated_at: str | None = None


class ChatBase(StrictSchema):
    message: str
    mutated: bool


class ChatResult(ChatBase):
    type: Literal['result']
    action: Literal['create_task','get_tasks','update_task','delete_task','complete_task','unsupported','cancel']
    task: TaskOut | None = None
    tasks: list[TaskOut] = Field(default_factory=list)


class ChatClarification(ChatBase):
    type: Literal['clarification']
    context_id: str
    missing_fields: list[str]
    choices: list[TaskPreview]


class ChatConfirmation(ChatBase):
    type: Literal['confirmation']
    context_id: str
    action: Literal['delete_task']
    task_preview: TaskPreview
    previous_task: TaskOut | None = None


class ChatConflict(ChatBase):
    type: Literal['conflict']
    context_id: str
    action: Literal['create_task','update_task','complete_task']
    task_preview: TaskPreview
    previous_task: TaskOut | None = None
    conflicting_tasks: list[TaskPreview]


class ChatDraft(ChatBase):
    type: Literal['draft']
    action: Action


class ChatAvailability(ChatBase):
    type: Literal['availability']
    action: Literal['suggest_free_slots']
    mutated: Literal[False]
    criteria: AvailabilityCriteria
    effective_start_time: str | None
    checked_at: str
    slots: list[FreeSlot] = Field(max_length=3)
    has_more: bool


ChatResponse=Annotated[ChatResult|ChatClarification|ChatConfirmation|ChatConflict|ChatDraft|ChatAvailability,Field(discriminator='type')]


class ContextOut(StrictSchema):
    flow: ChatResponse | None
