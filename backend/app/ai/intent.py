"""Conservative intent and server-owned references; titles are data, not commands."""
import json
import re
import unicodedata
from app.ai.scheduling import fold

QUOTED = r'''["“”'‘’]([^"“”'‘’]+)["“”'‘’]'''
READ_TOOLS = ('list_', 'get_', 'search_', 'find_', 'check_')
POLITE = r'(?:(?:toi muon|minh muon|toi can|ban co the|co the|ban giup toi|ban hay|ban|hay|vui long|giup toi|giup minh|lam on|please|can you|could you)\s+)*'


def command(text):
    return re.sub('^' + POLITE, '', fold(re.sub(QUOTED, '', text or '')).strip()).strip()


def action(text):
    text = command(text)
    for kind, verbs in (
        ('delete', r'xoa|delete|remove|huy (?:tat ca |toan bo |cac )?(?:lich|su kien|cuoc hop)|don dep'),
        ('create', r'tao|them|create|add|nhac toi|len lich|dat lich'),
        ('update', r'sua|doi|chuyen|update|edit|move|reschedule|danh dau quan trong'),
        ('complete', r'hoan thanh|danh dau|complete|mo lai'),
        ('plan', r'tu dong lap ke hoach|sap xep|lap ke hoach|len ke hoach|toi uu|auto plan'),
        ('read', r'xem|liet ke|tim|kiem tra|cho toi biet|hom nay toi co|toi co|co nhung|thong ke|bao cao|show|list|find|search|what|when'),
    ):
        if re.match(r'^(?:' + verbs + r')\b', text):
            return kind
    return None


def tool_action(name):
    if name.startswith(READ_TOOLS):
        return 'read'
    if name.startswith('delete_') or name == 'batch_update_tasks':
        return 'delete' if name.startswith('delete_') else None
    if name.startswith('create_') or name == 'add_task_step':
        return 'create'
    if name in {'complete_task', 'toggle_task_step'}:
        return 'complete'
    if name == 'auto_plan_my_day':
        return 'plan'
    return 'update'


def relevant_tools(text, tools):
    """Do not resend the entire tool catalog for an already clear operation."""
    requested = action(text)
    if requested is None:
        return tools
    explicit_multiple = bool(re.search(r'\b(?:va|roi|sau do|dong thoi)\s+(?:hay\s+)?(?:xoa|tao|them|sua|doi|chuyen|hoan thanh|danh dau)\b', command(text)))
    if explicit_multiple:
        return tools
    lookups = {'list_calendars', 'list_task_lists', 'list_categories'}
    if requested in {'update', 'delete', 'complete'}:
        lookups |= {'list_tasks', 'search_tasks', 'list_events', 'search_events'}
    if requested == 'read':
        return [tool for tool in tools if tool_action(tool['function']['name']) == 'read']
    return [tool for tool in tools if tool_action(tool['function']['name']) == requested or tool['function']['name'] in lookups or
            (tool['function']['name'] == 'batch_update_tasks' and requested in {'delete', 'complete', 'update'})]


def validate_tool_intent(text, name, arguments):
    requested, proposed = action(text), tool_action(name)
    if name == 'create_calendar' and text and not re.search(r'\b(?:nhom lich|calendar group)\b', command(text)):
        raise ValueError('Bạn đang yêu cầu tạo lịch hoạt động, không phải nhóm lịch. Chưa tạo nhóm lịch nào.')
    if proposed == 'read' or requested is None:
        return
    if name == 'batch_update_tasks':
        operation = arguments.get('action', '')
        proposed = 'delete' if operation in {'clear_completed', 'delete_by_ids'} else 'complete' if operation.startswith('complete_') else 'update'
    allowed = {requested}
    for secondary in re.finditer(r'\b(?:va|roi|sau do|dong thoi)\s+(?:hay\s+)?(xoa|tao|them|sua|doi|chuyen|hoan thanh|danh dau)\b', command(text)):
        allowed.add(action(secondary[1]))
    if proposed not in allowed and not (requested == 'plan' and proposed == 'update'):
        raise ValueError('Công cụ không phù hợp với yêu cầu của bạn. Chưa thực hiện thay đổi dữ liệu.')


def typed_reference(text):
    match = re.search(r'\b(task|cong viec|viec|event|su kien)\s*(?:id\s*|#)\s*(\d+)\b', command(text))
    return {'item_type': 'event' if match[1] in {'event', 'su kien'} else 'task', 'id': int(match[2])} if match else None


def recent_creations(messages):
    """Only persisted tool success records, never IDs guessed from assistant prose."""
    for message in reversed(messages):
        if message.get('role') == 'user' and action(message.get('content')) == 'create':
            return []  # Do not jump past a later failed/unexecuted creation.
        if message.get('role') != 'assistant':
            continue
        calls = message.get('_tool_calls') or []
        if isinstance(calls, str):
            try:
                calls = json.loads(calls)
            except (TypeError, ValueError):
                calls = []
        if not isinstance(calls, list):
            continue
        items, attempted = [], False
        for call in calls:
            if not isinstance(call, dict):
                continue
            name = call.get('name') or call.get('tool')
            result = call.get('result') or {}
            if name not in {'create_task', 'create_event'}:
                continue
            attempted = True
            if not isinstance(result, dict) or not result.get('success'):
                continue
            data = result.get('data') or {}
            if isinstance(data, dict) and type(data.get('id')) is int:
                kind = data.get('item_type') or ('task' if name == 'create_task' else 'event')
                if kind in {'task', 'event'}:
                    items.append({'item_type': kind, 'id': data['id'], 'title': data.get('title', '')})
        if attempted:
            return list({(i['item_type'], i['id']): i for i in items}.values())
    return []


def refers_to_recent(text):
    return bool(re.search(r'\b(?:vua tao|vua them|moi tao|moi them|just created|recently created)\b', command(text)))


def delete_request(text):
    if action(text) != 'delete':
        return None
    text = unicodedata.normalize('NFC', text.strip())
    clean = command(text)
    # Parent containers/subtasks keep their existing dedicated tools and confirmation.
    if re.search(r'\b(?:danh sach|nhom lich|nhan|buoc con|buoc nho|subtask|category|calendar group|task list)\b', clean):
        return None
    body = re.sub(r'^(?:xoa|delete|remove|huy|don dep)\s*', '', clean)
    request = {'recent': refers_to_recent(text), 'all': bool(re.search(r'\b(?:tat ca|toan bo|het|cac|nhung|all|every|chuoi)\b', body)),
               'kind': 'task' if re.search(r'\b(?:cong viec|viec|task|todo|nhiem vu)\b', body) else 'schedule' if re.search(r'\b(?:lich|su kien|event|cuoc hop)\b', body) else 'item',
               'query': None, 'completed': None, 'contains': bool(re.search(r'\b(?:chua tu|chua chu|chua ten|contains)\b', body))}
    if re.search(r'\b(?:chua hoan thanh|chua xong|chua lam)\b', body):
        request['completed'] = False
    elif re.search(r'\b(?:da hoan thanh|da xong|completed)\b', body):
        request['completed'] = True
    # Never silently widen an occurrence/date-limited deletion to a whole series.
    if re.search(r'\b(?:hom nay|ngay mai|hom qua|tu nay|tu bay gio|lan nay|lan sau|ngay\s+\d|\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2})\b', body):
        request['clarify'] = 'Bạn muốn xóa lần lặp nào? Hãy chọn mục/ngày trên Calendar, hoặc nói rõ "xóa toàn bộ chuỗi" nếu muốn xóa cả lịch lặp. Chưa có mục nào bị xóa.'
        return request
    explicit = typed_reference(text)
    if explicit:
        request['items'] = [explicit]
        return request
    quoted = re.search(QUOTED, text)
    if quoted:
        request['query'] = quoted[1].strip()
        return request
    if request['recent']:
        return request
    body = re.sub(r'\b(?:da hoan thanh|chua hoan thanh|da xong|chua xong|completed)\b', '', body)
    body = re.sub(r'^(?:(?:tat ca|toan bo|het|cac|nhung|mot|chuoi lap|chuoi)\s+)+', '', body).strip()
    body = re.sub(r'^(?:lich hen|lich|su kien|cong viec|viec can lam|viec|task|event|cuoc hop|muc|nhiem vu)\b\s*', '', body, count=1)
    body = re.sub(r'^lap\s+', '', body)
    introducer = re.match(r'^(?:co ten(?: la)?|ten la|mang ten|ten|chua tu|chua chu|chua ten|contains)\b\s*', body)
    if introducer:
        body = body[introducer.end():]
        if not body.strip():
            request['clarify'] = 'Bạn chưa nêu tên mục cần xóa. Chưa có mục nào bị xóa.'
            return request
    body = re.sub(r'(?:\s+(?:giup toi|giup minh|cho toi|dum toi|di|nhe|nha|voi|please))+$', '', body.rstrip('.!')).strip(' :,.!')
    request['query'] = body or None
    if not request['query'] and not request['all'] and request['completed'] is None:
        request['clarify'] = 'Bạn muốn xóa công việc hoặc lịch nào? Hãy cho biết tên hoặc ID. Chưa có mục nào bị xóa.'
    return request
