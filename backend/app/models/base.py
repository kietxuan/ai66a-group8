from app.core.database import Base
from app.models.user_model import User
from app.models.calendar_model import Calendar
from app.models.event_model import Event, EventReminder, EventReminderDelivery
from app.models.task_model import TaskList, Task, TaskStep
from app.models.category_model import Category
from app.models.ai_model import AIConversation, AIMessage

# Export all for Alembic Base.metadata discovery
__all__ = [
    "Base",
    "User",
    "Calendar",
    "Event",
    "EventReminder",
    "EventReminderDelivery",
    "TaskList",
    "Task",
    "TaskStep",
    "Category",
    "AIConversation",
    "AIMessage"
]
