"""Calendar recurrence in business time. Invalid month dates are skipped, never overflowed."""
import calendar
import re
from datetime import datetime, timedelta
from app.core.time import BUSINESS_TZ

DAY_MAP = {name: i for i, name in enumerate(("MO", "TU", "WE", "TH", "FR", "SA", "SU"))}

def aware(value):
    return value.replace(tzinfo=BUSINESS_TZ) if value.tzinfo is None else value.astimezone(BUSINESS_TZ)

def occurrences(start, end, rule, range_start, range_end, recurrence_end=None):
    start, end, lo, hi = map(aware, (start, end, range_start, range_end))
    if not rule:
        if start < hi and end > lo:
            yield start, end
        return
    params = dict(part.upper().split("=", 1) for part in rule.split(";") if "=" in part)
    freq = params.get("FREQ")
    interval = int(params.get("INTERVAL", 1))
    count = int(params["COUNT"]) if "COUNT" in params else None
    if freq not in {"DAILY", "WEEKLY", "MONTHLY", "YEARLY"} or interval <= 0 or (count is not None and count <= 0):
        raise ValueError("RRULE không hợp lệ hoặc chưa được hỗ trợ.")
    until = aware(recurrence_end) if recurrence_end else None
    if params.get("UNTIL"):
        value = params["UNTIL"]
        if len(value) == 8:
            parsed = datetime.strptime(value, "%Y%m%d").replace(hour=23, minute=59, second=59, tzinfo=BUSINESS_TZ)
        else:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            parsed = aware(parsed)
        until = min(until, parsed) if until else parsed
    duration = end - start
    cur = start
    if count is None and lo - duration > start:
        cur = datetime.combine((lo - duration).date(), start.timetz())
    total = examined = 0
    monday = start.date() - timedelta(days=start.weekday())
    while cur <= hi and (until is None or cur <= until):
        examined += 1
        if examined > 366000:
            raise ValueError("Khoảng tính lịch lặp quá lớn.")
        days = (cur.date() - start.date()).days
        months = (cur.year - start.year) * 12 + cur.month - start.month
        byday = True
        if params.get("BYDAY"):
            byday = False
            for code in params["BYDAY"].split(","):
                match = re.fullmatch(r"([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)", code)
                if not match or DAY_MAP[match[2]] != cur.weekday():
                    continue
                ordinal = int(match[1]) if match[1] else 0
                last = calendar.monthrange(cur.year, cur.month)[1]
                if not ordinal or (ordinal > 0 and (cur.day - 1) // 7 + 1 == ordinal) or (ordinal < 0 and -((last - cur.day) // 7 + 1) == ordinal):
                    byday = True
        monthday = cur.day in [int(v) for v in params["BYMONTHDAY"].split(",")] if params.get("BYMONTHDAY") else (True if params.get("BYDAY") else cur.day == start.day)
        matches = (
            freq == "DAILY" and days % interval == 0 and byday or
            freq == "WEEKLY" and ((cur.date() - monday).days // 7) % interval == 0 and (byday if params.get("BYDAY") else cur.weekday() == start.weekday()) or
            freq == "MONTHLY" and months % interval == 0 and monthday and byday or
            freq == "YEARLY" and (cur.year - start.year) % interval == 0 and cur.month == start.month and monthday and byday
        )
        if matches and cur >= start:
            total += 1
            if count and total > count:
                break
            if cur < hi and cur + duration > lo:
                yield cur, cur + duration
        cur += timedelta(days=1)

def expand_event_rows(rows, range_start, range_end):
    from app.schemas.event_schema import EventResponse
    lo, hi = aware(range_start), aware(range_end)
    exceptions = {}
    for row in rows:
        if row.parent_event_id and row.original_start:
            exceptions.setdefault(row.parent_event_id, set()).add(aware(row.original_start))
    result = []
    for row in rows:
        if row.is_cancelled:
            continue
        for start, end in occurrences(row.start_at, row.end_at, row.recurrence_rule, lo, hi, row.recurrence_end):
            if not row.is_exception and start in exceptions.get(row.id, set()):
                continue
            result.append(EventResponse.model_validate(row).model_copy(update={"start_at": start, "end_at": end, "original_start": row.original_start if row.is_exception else start}))
    return sorted(result, key=lambda row: row.start_at)
