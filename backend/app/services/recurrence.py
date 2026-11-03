"""Calendar recurrence in business time. Invalid month dates are skipped, never overflowed."""
import calendar
import re
from datetime import datetime, time, timedelta
from app.core.time import BUSINESS_TZ, local_now

DAY_MAP = {name: i for i, name in enumerate(("MO", "TU", "WE", "TH", "FR", "SA", "SU"))}

def aware(value):
    return value.replace(tzinfo=BUSINESS_TZ) if value.tzinfo is None else value.astimezone(BUSINESS_TZ)

def parse_until(value):
    """DATE includes the whole business day; DATE-TIME is an inclusive instant."""
    value = value.strip().upper()
    if re.fullmatch(r"\d{8}|\d{4}-\d{2}-\d{2}", value):
        day = datetime.strptime(value.replace("-", ""), "%Y%m%d").date()
        return datetime.combine(day, time.max, BUSINESS_TZ)
    if "T" not in value:
        raise ValueError("UNTIL phải là ngày hoặc ngày giờ ISO hợp lệ.")
    return aware(datetime.fromisoformat(value.replace("Z", "+00:00")))


def parse_rule(rule):
    """Validate the supported RFC subset before any consumer uses it."""
    parts = {}
    for part in rule.split(";"):
        if part.count("=") != 1:
            raise ValueError("RRULE phải gồm các cặp khóa=giá trị.")
        key, value = (item.strip().upper() for item in part.split("=", 1))
        if not key or not value or key in parts:
            raise ValueError("RRULE có khóa trùng hoặc giá trị trống.")
        parts[key] = value
    freq = parts.get("FREQ")
    if freq not in {"DAILY", "WEEKLY", "MONTHLY", "YEARLY"} or set(parts) - {"FREQ", "INTERVAL", "COUNT", "UNTIL", "BYDAY", "BYMONTHDAY"}:
        raise ValueError("Chu kỳ lặp chưa được hỗ trợ.")
    for key in ("INTERVAL", "COUNT"):
        if key in parts and (not re.fullmatch(r"[0-9]+", parts[key]) or not 1 <= int(parts[key]) <= 1000000):
            raise ValueError("Chu kỳ lặp không hợp lệ.")
    if "COUNT" in parts and "UNTIL" in parts:
        raise ValueError("Chỉ chọn COUNT hoặc UNTIL, không đồng thời cả hai.")
    if "BYDAY" in parts:
        pattern = r"(?:[+-]?[1-5])?(MO|TU|WE|TH|FR|SA|SU)" if freq in {"MONTHLY", "YEARLY"} else r"(MO|TU|WE|TH|FR|SA|SU)"
        if any(not re.fullmatch(pattern, day) for day in parts["BYDAY"].split(",")):
            raise ValueError("Ngày lặp không hợp lệ.")
    if "BYMONTHDAY" in parts:
        if freq == "WEEKLY" or any(not re.fullmatch(r"[0-9]+", day) or not 1 <= int(day) <= 31 for day in parts["BYMONTHDAY"].split(",")):
            raise ValueError("Ngày trong tháng không hợp lệ hoặc không dùng với WEEKLY.")
    if "UNTIL" in parts:
        parse_until(parts["UNTIL"])
    return parts


def task_end_at(task):
    """One business-time end boundary for completion, overdue views and scheduler."""
    if not task.due_date:
        return None
    if not task.is_all_day:
        if task.end_time:
            return aware(datetime.combine(task.due_date, task.end_time))
        clock = task.start_time or task.due_time
        if clock:
            return aware(datetime.combine(task.due_date, clock)) + timedelta(minutes=task.duration_minutes or 60)
    start = datetime.combine(task.due_date, time.min, BUSINESS_TZ)
    return start + timedelta(days=1) if task.due_date < datetime.max.date() else datetime.max.replace(tzinfo=BUSINESS_TZ)


def is_task_overdue(task, now=None):
    end = task_end_at(task)
    return not task.is_completed and end is not None and end <= aware(now or local_now())


def occurrences(start, end, rule, range_start, range_end, recurrence_end=None):
    start, end, lo, hi = map(aware, (start, end, range_start, range_end))
    if not rule:
        if start < hi and end > lo:
            yield start, end
        return
    params = parse_rule(rule)
    freq = params.get("FREQ")
    interval = int(params.get("INTERVAL", 1))
    count = int(params["COUNT"]) if "COUNT" in params else None
    if freq not in {"DAILY", "WEEKLY", "MONTHLY", "YEARLY"} or interval <= 0 or (count is not None and count <= 0):
        raise ValueError("RRULE không hợp lệ hoặc chưa được hỗ trợ.")
    until = aware(recurrence_end) if recurrence_end else None
    if params.get("UNTIL"):
        parsed = parse_until(params["UNTIL"])
        until = min(until, parsed) if until else parsed
    duration = end - start
    cur = start
    if count is None and lo - duration > start:
        cur = datetime.combine((lo - duration).date(), start.timetz())
    total = examined = 0
    monday = start.date() - timedelta(days=start.weekday())
    while cur < hi and (until is None or cur <= until):
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
                position = (cur - cur.replace(month=1, day=1)).days if freq == "YEARLY" else cur.day - 1
                remaining = (cur.replace(month=12, day=31) - cur).days if freq == "YEARLY" else calendar.monthrange(cur.year, cur.month)[1] - cur.day
                if not ordinal or (ordinal > 0 and position // 7 + 1 == ordinal) or (ordinal < 0 and -(remaining // 7 + 1) == ordinal):
                    byday = True
        monthday = cur.day in [int(v) for v in params["BYMONTHDAY"].split(",")] if params.get("BYMONTHDAY") else (True if params.get("BYDAY") else cur.day == start.day)
        matches = (
            freq == "DAILY" and days % interval == 0 and byday or
            freq == "WEEKLY" and ((cur.date() - monday).days // 7) % interval == 0 and (byday if params.get("BYDAY") else cur.weekday() == start.weekday()) or
            freq == "MONTHLY" and months % interval == 0 and monthday and byday or
            freq == "YEARLY" and (cur.year - start.year) % interval == 0 and (True if params.get("BYDAY") or params.get("BYMONTHDAY") else cur.month == start.month) and monthday and byday
        )
        if params.get("BYMONTHDAY"):
            matches = matches and monthday
        if matches and cur >= start:
            total += 1
            if count and total > count:
                break
            if cur < hi and cur + duration > lo:
                yield cur, cur + duration
            if count is not None and total >= count:
                break
        if cur.date() == datetime.max.date():
            break
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
