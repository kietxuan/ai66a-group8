"""Event reminders reuse the user's settings and the existing email provider.

Owner row locks serialize polling/scheduler sends with event edits and deletes.
Acknowledgements survive restarts and distinguish recurring occurrences. As with
any SMTP/HTTP sender, a process crash between provider ACK and DB commit can still
require reconciliation; this is not an exactly-once delivery protocol.
"""
from dataclasses import dataclass
from datetime import datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.logger import logger
from app.core.time import BUSINESS_TZ, local_now
from app.helper.otp import send_reminder_email
from app.models.event_model import Event, EventReminderDelivery
from app.models.user_model import User
from app.services.recurrence import aware, occurrences


@dataclass
class DueEventReminder:
    event: Event
    reminder: object
    start: datetime
    end: datetime
    target: datetime
    scheduled_for: datetime
    minutes_before: int

    @property
    def key(self):
        return self.event.id, self.start, self.scheduled_for


def due_event_reminders(events, now, default_minutes):
    now = aware(now)
    overridden = {(e.parent_event_id, aware(e.original_start)) for e in events
                  if e.parent_event_id and e.original_start}
    for event in events:
        if event.is_cancelled:
            continue
        for reminder in event.reminders:
            minutes = default_minutes if reminder.use_user_default else reminder.minutes_before
            if minutes is None or not 0 <= minutes <= 10080:
                continue
            # All-day notifications use 08:00 VN, not midnight. Keep the actual
            # occurrence start as its identity and only remind at its beginning.
            start_wall = aware(event.start_at)
            shift = (datetime.combine(start_wall.date(), time(8), BUSINESS_TZ) - start_wall) if event.is_all_day else timedelta()
            lo = now - timedelta(minutes=5) - shift
            hi = now + timedelta(minutes=minutes) + timedelta(seconds=1) - shift
            try:
                instances = occurrences(event.start_at, event.end_at, event.recurrence_rule, lo, hi, event.recurrence_end)
                for start, end in instances:
                    if not event.is_exception and (event.id, start) in overridden:
                        continue
                    target = datetime.combine(start.date(), time(8), BUSINESS_TZ) if event.is_all_day else start
                    scheduled_for = target - timedelta(minutes=minutes)
                    if scheduled_for <= now <= target + timedelta(minutes=5):
                        yield DueEventReminder(event, reminder, start, end, target, scheduled_for, minutes)
            except ValueError:
                logger.warning("Skipped invalid recurrence while checking event id=%s", event.id)


def event_time_display(item):
    if item.event.is_all_day:
        last = item.end - timedelta(microseconds=1)
        dates = item.start.strftime("%d/%m/%Y")
        if last.date() != item.start.date():
            dates += f" – {last:%d/%m/%Y}"
        return f"Cả ngày {dates} (mốc nhắc 08:00, giờ Việt Nam)"
    return f"{item.start:%H:%M %d/%m/%Y} – {item.end:%H:%M %d/%m/%Y} (giờ Việt Nam)"


class EventReminderService:
    async def send_due(self, db, user_id, *, now=None):
        now = aware(now or local_now())
        attempted = set()
        triggered = []
        # Commit every acknowledgement, then reacquire/reload before the next
        # send, so a subsequent provider failure cannot undo successful sends.
        for _ in range(20):
            user = (await db.execute(select(User).where(
                User.id == user_id, User.notify_enabled.is_(True), User.is_activate.is_(True)
            ).with_for_update(skip_locked=True).execution_options(populate_existing=True))).scalar_one_or_none()
            if user is None:
                await db.rollback()
                break
            events = list((await db.execute(select(Event).where(Event.user_id == user_id)
                .options(selectinload(Event.reminders)).execution_options(populate_existing=True))).scalars().all())
            due = sorted(due_event_reminders(events, now, user.notify_minutes_before), key=lambda item: item.scheduled_for)
            sent = set((event_id, aware(start), aware(scheduled)) for event_id, start, scheduled in
                (await db.execute(select(EventReminderDelivery.event_id, EventReminderDelivery.occurrence_start,
                    EventReminderDelivery.scheduled_for).join(Event, Event.id == EventReminderDelivery.event_id)
                    .where(Event.user_id == user_id, EventReminderDelivery.occurrence_start >= now - timedelta(hours=8, minutes=5)))).all())
            candidate = next((item for item in due if item.key not in sent and item.key not in attempted), None)
            if candidate is None:
                await db.rollback()
                break
            attempted.add(candidate.key)
            display = event_time_display(candidate)
            try:
                sent_ok = await send_reminder_email(
                    to_email=user.email, user_name=user.nickname, task_title=candidate.event.title,
                    time_display=display, note=candidate.event.description or "", location=candidate.event.location or "",
                    minutes_before=max(0, int(round((candidate.target - now).total_seconds() / 60))),
                )
            except Exception:
                logger.warning("Event reminder provider failed for event id=%s", candidate.event.id)
                sent_ok = False
            result = {"id": candidate.event.id, "item_type": "event", "title": candidate.event.title,
                "time_display": display, "minutes_left": max(0, int(round((candidate.target - now).total_seconds() / 60))),
                "email_sent": bool(sent_ok), "notification_key": f"event-{candidate.event.id}-{candidate.start.isoformat()}-{candidate.scheduled_for.isoformat()}"}
            if sent_ok:
                db.add(EventReminderDelivery(event_id=candidate.event.id, reminder_id=candidate.reminder.id,
                    occurrence_start=candidate.start, scheduled_for=candidate.scheduled_for, minutes_before=candidate.minutes_before))
                candidate.reminder.is_sent = True
                await db.commit()
            else:
                await db.rollback()
            triggered.append(result)
        return triggered


event_reminder_service = EventReminderService()
