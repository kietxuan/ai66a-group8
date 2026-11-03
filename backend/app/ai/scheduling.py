"""Deterministic constraints from the user's scheduling request, not model guesses."""
import calendar
import re
import unicodedata
from datetime import date, datetime, time, timedelta
from app.core.time import business_today, local_now, BUSINESS_TZ

DAY_CODES = ('MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU')
DAY_NAMES = {'hai': 0, '2': 0, 'ba': 1, '3': 1, 'tu': 2, '4': 2,
             'nam': 3, '5': 3, 'sau': 4, '6': 4, 'bay': 5, '7': 5}
NUMBERS = {'mot': 1, 'hai': 2, 'ba': 3, 'bon': 4, 'nam': 5, 'sau': 6,
           'bay': 7, 'tam': 8, 'chin': 9, 'muoi': 10}


def fold(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text.lower().replace('đ', 'd'))
                   if unicodedata.category(c) != 'Mn')


def add_months(day, count):
    month = day.year * 12 + day.month - 1 + count
    year, month = divmod(month, 12)
    return date(year, month + 1, min(day.day, calendar.monthrange(year, month + 1)[1]))


def read_date(value):
    value = value.strip()
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        return date.fromisoformat(value)
    parts = re.split(r'[/.-]', value)
    return date(int(parts[2]) if len(parts) == 3 else business_today().year, int(parts[1]), int(parts[0]))


def recurrence_request(text):
    # A quoted title is data; e.g. "Báo cáo hàng ngày" must not turn into a rule.
    clean = fold(re.sub(r'''["“”'‘’][^"“”'‘’]*["“”'‘’]''', '', text or ''))
    today = business_today()
    start = None
    date_pattern = r'(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}(?:/\d{4})?)'
    explicit_start = re.search(r'bat dau\s*(?:tu|vao)?\s*(?:ngay\s*)?' + date_pattern, clean)
    if explicit_start:
        start = read_date(explicit_start[1])
    elif re.search(r'\b(?:bay gio|tu nay|hom nay)\b', clean):
        start = today
    elif re.search(r'\bngay mai\b', clean):
        start = today + timedelta(days=1)

    parts = {}
    freqs = [('DAILY', r'(?:moi|hang)\s+ngay|daily'),
             ('WEEKLY', r'(?:moi|hang)\s+(?:tuan|thu\b|chu nhat)|weekly'),
             ('MONTHLY', r'(?:moi|hang)\s+thang|monthly'),
             ('YEARLY', r'(?:moi|hang)\s+nam|yearly')]
    for freq, pattern in freqs:
        if re.search(pattern, clean):
            parts['FREQ'] = freq
            break
    if re.search(r'cac ngay trong tuan|(?:t2|thu 2)\s*(?:den|toi)\s*(?:t6|thu 6)', clean):
        parts.update(FREQ='WEEKLY', BYDAY='MO,TU,WE,TH,FR')
    recurring = bool(parts) or bool(re.search(r'lap (?:lai\s*)?|(?:moi|cach)\s+\d+\s+(?:ngay|tuan|thang|nam)', clean))
    if recurring:
        days_text = clean.split('bat dau')[0] if 'bat dau' in clean and re.search(r'moi|hang|lap', clean.split('bat dau')[0]) else clean
        matches = list(re.finditer(r'\bthu\s*(hai|ba|tu|nam|sau|bay|[2-7])\b', days_text))
        days = {DAY_NAMES[m[1]] for m in matches}
        if re.search(r'chu nhat|\bcn\b', days_text):
            days.add(6)
        if len(matches) == 2 and re.search(r'\b(?:den|toi)\b', days_text[matches[0].end():matches[1].start()]):
            first, last = DAY_NAMES[matches[0][1]], DAY_NAMES[matches[1][1]]
            days = {(first + i) % 7 for i in range((last-first) % 7 + 1)}
        if days and not parts.get('BYDAY'):
            parts.setdefault('FREQ', 'WEEKLY')
            parts['BYDAY'] = ','.join(DAY_CODES[d] for d in sorted(days))
        interval = re.search(r'(?:moi|cach)\s+(\d+)\s+(ngay|tuan|thang|nam)', clean)
        if interval:
            if not 1 <= int(interval[1]) <= 1000:
                raise ValueError('Khoảng lặp phải từ 1 đến 1000.')
            parts.update(FREQ={'ngay':'DAILY','tuan':'WEEKLY','thang':'MONTHLY','nam':'YEARLY'}[interval[2]], INTERVAL=interval[1])

    until = None
    explicit_end = re.search(r'(?:den|toi|ket thuc)\s*(?:het\s*)?(?:vao\s*)?(?:ngay\s*)?' + date_pattern, clean)
    if explicit_end:
        until = read_date(explicit_end[1])
    duration = re.search(r'(?:den|toi|trong|keo dai)\s*(?:het\s*)?(\d+|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\s+(ngay|tuan|thang|nam)(?:\s+(?:sau|toi))?', clean)
    if duration:
        n = int(duration[1]) if duration[1].isdigit() else NUMBERS[duration[1]]
        if not 1 <= n <= 1200:
            raise ValueError('Vui lòng chọn thời hạn lặp hợp lệ.')
        anchor = start or today
        unit = duration[2]
        until = add_months(anchor, n * (12 if unit == 'nam' else 1)) if unit in {'thang','nam'} else anchor + timedelta(days=n * (7 if unit == 'tuan' else 1))
    count = re.search(r'(?:lap(?: lai)?\s*(?:tong cong\s*)?|trong\s+)(\d+)\s+lan\b', clean)
    if until and count:
        raise ValueError('Bạn hãy chọn giới hạn theo ngày kết thúc hoặc số lần lặp, không đồng thời cả hai.')
    if until:
        parts['UNTIL'] = until.strftime('%Y%m%d')
    if count:
        parts['COUNT'] = count[1]
    return parts, start


def constrain_creation(name, arguments, request):
    if name not in {'create_task', 'create_event'} or not request:
        return arguments
    requested, requested_start = recurrence_request(request)
    rule = arguments.get('recurrence_rule') or ''
    parts = dict(p.strip().upper().split('=', 1) for p in rule.split(';') if '=' in p)
    if not requested or not (parts.get('FREQ') or requested.get('FREQ')):
        return arguments
    if 'UNTIL' in requested:
        parts.pop('COUNT', None)
    if 'COUNT' in requested:
        parts.pop('UNTIL', None)
    parts.update(requested)
    result = dict(arguments, recurrence_rule=';'.join(f'{k}={v}' for k, v in parts.items()))
    raw_start = arguments.get('start_at') if name == 'create_event' else arguments.get('due_date')
    if not raw_start and not requested_start:
        raise ValueError('Bạn muốn bắt đầu lịch lặp vào ngày nào? Chưa có dữ liệu nào được tạo.')
    original = datetime.fromisoformat(str(raw_start).replace('Z', '+00:00')) if raw_start else None
    if original and original.tzinfo:
        original = original.astimezone(BUSINESS_TZ)
    day = requested_start or original.date()
    clock = original.time() if name == 'create_event' and original else time.fromisoformat(str(arguments.get('start_time') or arguments.get('due_time') or '00:00'))
    candidate = datetime.combine(day, clock, BUSINESS_TZ)
    lower = candidate
    if re.search(r'\b(?:bay gio|tu nay)\b', fold(request)):
        lower = max(lower, local_now())
    # Select the first valid future occurrence without consuming COUNT before it exists.
    from app.services.recurrence import occurrences
    selection = {key: value for key, value in parts.items() if key != 'COUNT'}
    all_day = arguments.get('is_all_day') is True or (name == 'create_task' and not arguments.get('start_time') and not arguments.get('due_time'))
    selection_duration = timedelta(days=1) if all_day else timedelta(microseconds=1)
    first = next(occurrences(candidate, candidate + selection_duration,
                             ';'.join(f'{k}={v}' for k, v in selection.items()),
                             lower, datetime.max.replace(tzinfo=BUSINESS_TZ)), None)
    if first is None:
        raise ValueError('Không có ngày lặp phù hợp trước hạn kết thúc bạn chọn.')
    day = first[0].date()
    if name == 'create_task':
        result['due_date'] = day.isoformat()
        result['is_in_my_day'] = day == business_today()
    elif original:
        delta = day - original.date()
        result['start_at'] = (original + delta).isoformat()
        if arguments.get('end_at'):
            end = datetime.fromisoformat(str(arguments['end_at']).replace('Z', '+00:00'))
            result['end_at'] = (end + delta).isoformat()
    return result
