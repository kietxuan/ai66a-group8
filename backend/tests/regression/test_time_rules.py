import random
import unittest
from datetime import date, datetime, timedelta
from app.core.time import BUSINESS_TZ
from app.services.task_service import TaskService
from app.services.recurrence import occurrences
from app.services.availability import free_intervals

class TimeRuleRegression(unittest.TestCase):
    def test_task_recurrence_boundaries(self):
        service = TaskService()
        cases = [
            (date(2030, 1, 1), "FREQ=DAILY", date(2030, 1, 2)),
            (date(2030, 1, 1), "FREQ=DAILY;INTERVAL=2", date(2030, 1, 3)),
            (date(2030, 1, 1), "FREQ=DAILY;COUNT=1", None),
            (date(2030, 1, 1), "FREQ=DAILY;UNTIL=20300101", None),
            (date(2026, 11, 2), "FREQ=WEEKLY;BYDAY=MO,WE,FR", date(2026, 11, 4)),
            (date(2026, 11, 6), "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR", date(2026, 11, 16)),
            (date(2030, 1, 31), "FREQ=MONTHLY", date(2030, 2, 28)),
            (date(2028, 2, 29), "FREQ=YEARLY", date(2029, 2, 28)),
            (date(9999, 12, 31), "FREQ=YEARLY", None),
        ]
        for current, rule, expected in cases:
            with self.subTest(current=current, rule=rule):
                self.assertEqual(service._calculate_next_due_date(current, rule), expected)

    def test_calendar_count_weekday_leap_and_long_running_rules(self):
        def expand(start, rule, lo, hi):
            start = datetime.fromisoformat(start).replace(tzinfo=BUSINESS_TZ)
            return [s.date().isoformat() for s, _ in occurrences(start, start + timedelta(hours=1), rule, datetime.fromisoformat(lo), datetime.fromisoformat(hi))]
        self.assertEqual(expand("2026-01-31T09:00", "FREQ=MONTHLY;COUNT=3", "2026-01-01", "2026-06-01"), ["2026-01-31", "2026-03-31", "2026-05-31"])
        self.assertEqual(expand("2024-02-29T09:00", "FREQ=YEARLY;COUNT=2", "2024-01-01", "2030-01-01"), ["2024-02-29", "2028-02-29"])
        self.assertEqual(expand("2025-01-01T09:00", "FREQ=DAILY", "2026-11-01", "2026-11-04"), ["2026-11-01", "2026-11-02", "2026-11-03"])
        self.assertEqual(expand("2026-11-02T09:00", "FREQ=WEEKLY;BYDAY=FR,MO;COUNT=3", "2026-11-01", "2026-12-01"), ["2026-11-02", "2026-11-06", "2026-11-09"])

    def test_free_intervals_against_250_independent_minute_grids(self):
        rng = random.Random(20261103)
        start = datetime(2030, 1, 1, 8, tzinfo=BUSINESS_TZ)
        end = start + timedelta(minutes=600)
        for sample in range(250):
            raw = [sorted((rng.randrange(-60, 660), rng.randrange(-60, 660))) for _ in range(rng.randrange(0, 20))]
            busy = [{"start": start + timedelta(minutes=s), "end": start + timedelta(minutes=e)} for s, e in raw if e > s]
            free = list(free_intervals(start, end, busy))
            for minute in range(600):
                point = start + timedelta(minutes=minute, seconds=30)
                expected = not any(s <= minute < e for s, e in raw)
                actual = any(s <= point < e for s, e in free)
                self.assertEqual(actual, expected, (sample, minute, raw))
