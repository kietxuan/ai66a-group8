"""Small, deterministic Vietnamese guards; not a second intent parser."""
import re
import unicodedata
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo


def folded(value):
    return "".join(c for c in unicodedata.normalize("NFD", value.casefold().replace("đ", "d")) if unicodedata.category(c) != "Mn").strip()


def explicit_time_range(message):
    """Only unequivocal numeric ranges. Leave ambiguous language to clarification."""
    text = folded(message)
    hour = r"(\d{1,2})(?:\s*(h|gio|:)\s*(\d{1,2})?)?\s*(sang|trua|chieu|toi|dem)?"
    matches = list(re.finditer(r"\btu\s+" + hour + r"\s*(?:den|toi|-)\s*" + hour + r"\b", text))
    if not matches or (len(matches)>1 and "khong phai" not in text):
        return None
    match=matches[-1]
    def convert(h, separator, m, period):
        explicit_24h = separator==":" or (len(h)==2 and h.startswith("0"))
        h, m = int(h), int(m or 0)
        if h > 23 or m > 59:
            return None
        if period in ("chieu", "toi") and 1 <= h <= 11:
            h += 12
        elif period == "dem" and h == 12:
            h = 0
        elif not period and 1 <= h <= 11 and not explicit_24h:
            return None
        return f"{h:02}:{m:02}"
    first, last = convert(*match.groups()[:4]), convert(*match.groups()[4:])
    return (first, last) if first is not None and last is not None else None


def time_words(value):
    hour, minute = map(int, value.split(":"))
    period = "sáng" if hour < 12 else "trưa" if hour == 12 else "chiều" if hour < 18 else "tối"
    if hour == 0:
        period = "đêm"
    display = hour if hour <= 12 else hour - 12
    display = 12 if hour == 0 else display
    return f"{display} giờ" + (f" {minute:02} phút" if minute else "") + f" {period}"


def task_words(task):
    day = date.fromisoformat(task["task_date"]).strftime("%d/%m/%Y")
    period = f"từ {time_words(task['start_time'])} đến {time_words(task['end_time'])}" if task.get("start_time") else "cả ngày"
    return f"“{task['title']}”, ngày {day}, {period}"


def guard_times(message, action):
    if action.action not in ("create_task", "update_task", "suggest_free_slots"):
        return action
    values = explicit_time_range(message)
    if not values:
        return action
    if action.action=="update_task" and "thanh" in folded(message):
        return action  # A range before 'thành' may describe the OLD schedule.
    payload = action.model_dump(mode="json", exclude_unset=True)
    group="availability" if action.action=="suggest_free_slots" else "fields"
    payload.setdefault(group, {}).update(start_time=values[0], end_time=values[1])
    payload["missing_fields"] = [key for key in action.missing_fields if key not in ("start_time", "end_time")]
    return type(action).model_validate(payload)


def guard_scope(message, action):
    text=folded(re.sub(r'"[^"\n]*"|“[^”\n]*”','',message))
    if (re.match(r'(viet|soan|dich)\s+(cho|ho)\s+(toi|minh)\b',text)
            and not re.search(r'\b(cong viec|task|hom nay|hom qua|ngay mai|ngay kia|len lich|dat lich|\d{4}-\d{2}-\d{2})\b',text)):
        return type(action)(action='unsupported')
    if action.action in ("create_task","update_task","delete_task","complete_task") and re.search(
            r"\b(tat ca|toan bo|het cac|het moi|nhieu|hai|2)\s+(?:cac\s+)?(?:cong viec|viec|task|lich)\b", text):
        return type(action)(action="unsupported")
    return action


def guard_dates(message, action, current_date=None):
    """Normalize only unambiguous explicit relative dates, never infer missing ones."""
    if action.action not in ("create_task","update_task","delete_task","complete_task","get_tasks","suggest_free_slots"):
        return action
    text=folded(re.sub(r'"[^"\n]*"|“[^”\n]*”', '', message))
    offsets={"ngay kia":2,"ngay mot":2,"ngay mai":1,"hom nay":0,"hom qua":-1}
    found=list(re.finditer(r"\b(?:ngay kia|ngay mot|ngay mai|hom nay|hom qua)\b",text))
    if not found or (len(found)>1 and "khong phai" not in text):
        return action
    if re.search(r"\b(hoac|hay)\b",text):
        return action
    today=current_date or datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).date()
    value=(today+timedelta(days=offsets[found[-1].group()])).isoformat()
    payload=action.model_dump(mode='json',exclude_unset=True)
    group='availability' if action.action=='suggest_free_slots' else 'fields' if action.action in ('create_task','update_task') else 'filters'
    # For updates only touch a date that the parser already identifies as a new value.
    if action.action=='update_task' and 'task_date' not in payload.get('fields',{}):
        return action
    if group=='filters' and (payload.get('filters',{}).get('date_from') or payload.get('filters',{}).get('date_to')):
        return action
    explicit=re.findall(r'\b\d{4}-\d{2}-\d{2}\b',text)
    if explicit and any(day!=value for day in explicit):
        payload['missing_fields']=list(dict.fromkeys([*action.missing_fields,'task_date']))
        return type(action).model_validate(payload)
    payload.setdefault(group,{})['task_date']=value
    payload['missing_fields']=[key for key in action.missing_fields if key!='task_date']
    return type(action).model_validate(payload)


def guard_missing_times(message, action):
    if action.action not in ('create_task','update_task'):
        return action
    payload=action.model_dump(mode='json',exclude_unset=True)
    fields=payload.setdefault('fields',{})
    missing=list(action.missing_fields)
    text=folded(message)
    if re.search(r'(chua|khong)\s+(biet|co|ro)\s+gio\s+ket\s+thuc',text):
        fields.pop('end_time',None)
        missing.append('end_time')
    if action.action=='create_task':
        if fields.get('start_time') and not fields.get('end_time'):missing.append('end_time')
        if fields.get('end_time') and not fields.get('start_time'):missing.append('start_time')
    payload['missing_fields']=list(dict.fromkeys(missing))
    return type(action).model_validate(payload)


def guard_ordinal(message, action, context):
    """Resolve an exact single-task ordinal against the server-provided order.

    Deliberately anchored: extra operations/conditions do not take this shortcut.
    This is equivalent to the UI's whitelisted choice, not fuzzy intent guessing.
    """
    text=folded(message).strip(' .!?')
    match=re.fullmatch(r'(xoa|hoan thanh|danh dau hoan thanh)\s+(?:cai|viec|cong viec)\s+thu\s+(nhat|hai|ba|tu|nam|sau|bay|tam|chin|muoi|\d+)\s+trong danh sach(?: vua roi| vua hien| vua tim)?(?: di| giup minh)?',text)
    if not match:
        return action
    words={'nhat':1,'hai':2,'ba':3,'tu':4,'nam':5,'sau':6,'bay':7,'tam':8,'chin':9,'muoi':10}
    number=words.get(match[2],int(match[2]) if match[2].isdigit() else 0)
    recent=(context or {}).get('recent_tasks',[])
    if not 1<=number<=len(recent):
        return type(action)(action='clarify',missing_fields=['task'])
    return type(action)(action='delete_task' if match[1]=='xoa' else 'complete_task',
        task_id=recent[number-1]['id'],reference='recent_results')


def guard_all_day_selection(message, action, context):
    """Conservative exact selectors for the reported Vietnamese all-day case.

    Only a whole single delete request matches; the backend still resolves owner,
    ambiguity and confirmation. Quoted full titles/extra clauses do not match.
    """
    text=message.strip().rstrip('.!?').strip()
    if re.fullmatch(r'(?:xóa|xoa)\s+(?:cái|cai|việc|viec|công việc|cong viec)\s+(?:cả ngày|ca ngay)(?:\s+(?:ấy|ay|đi|di|nhé|nhe))?',text,re.I):
        return type(action)(action='delete_task',reference='recent_results',filters={'all_day':True})
    match=re.fullmatch(r'(?:xóa|xoa)\s+(?:(?:cái|cai)\s+)?(?:(?:công việc|cong viec|việc|viec|task)\s+)?(.+?)\s+(?:cả ngày|ca ngay)(?:\s+(?:đi|di|nhé|nhe))?',text,re.I)
    if not match:return action
    title=match[1].strip(' “”."')
    if not title or len(title)>200 or folded(title).startswith(('ghi chu','mo ta','danh muc','gio ')):
        return action
    recent=(context or {}).get('recent_tasks',[])
    reference='recent_results' if any(folded(t['title'])==folded(title) for t in recent) else None
    return type(action)(action='delete_task',task_query=title,reference=reference,filters={'all_day':True})


def normalize_intent(message, action, context=None):
    selected=guard_all_day_selection(message,guard_ordinal(message,action,context),context)
    return guard_scope(message,guard_missing_times(message,guard_dates(message,guard_times(message,selected))))
