"""Resolve human deletion requests into a frozen, typed, owner-scoped selection."""
from sqlalchemy import select
from app.models.task_model import Task, TaskStep
from app.models.event_model import Event
from app.ai.intent import delete_request, recent_creations
from app.ai.scheduling import fold
from app.ai.replies import _when

MAX_DELETE_ITEMS = 500


async def owned_items(db, user_id):
    tasks = list((await db.execute(select(Task).where(Task.user_id == user_id).execution_options(populate_existing=True))).scalars())
    events = list((await db.execute(select(Event).where(Event.user_id == user_id).execution_options(populate_existing=True))).scalars())
    return tasks, events


def task_family(tasks, ids):
    selected = set(ids)
    while True:
        expanded = selected | {t.id for t in tasks if t.recurrence_source_id in selected}
        if expanded == selected:
            return [t for t in tasks if t.id in selected]
        selected = expanded


def item_label(item):
    kind = 'Công việc' if isinstance(item, Task) else 'Sự kiện'
    data = {key: getattr(item, key, None) for key in ('due_date', 'start_time', 'end_time', 'start_at', 'end_at', 'is_all_day')}
    status = ' (đã hoàn thành)' if getattr(item, 'is_completed', False) else ''
    # Tasks can already have separately materialized successor rows. Do not
    # imply those unlisted rows will also be deleted by a single-item request.
    recurrence = (' - công việc có lặp' if isinstance(item, Task) else ' - cả chuỗi lặp') if item.recurrence_rule else ''
    if recurrence:
        from app.services.recurrence import parse_rule, parse_until
        try:
            parts = parse_rule(item.recurrence_rule)
            if parts.get('UNTIL'):
                recurrence += f", đến hết {parse_until(parts['UNTIL']):%d/%m/%Y}"
        except (ValueError, OverflowError):
            pass
    return f'{kind} #{item.id}: {item.title}{status}{_when(data)}{recurrence}'


async def plan_deletion(executor, text, messages):
    request = delete_request(text)
    if request is None:
        return None
    if request.get('clarify'):
        return request['clarify']
    tasks, events = await owned_items(executor.db, executor.user_id)
    events = [e for e in events if not e.is_cancelled]
    if request.get('items'):
        keys = {(i['item_type'], i['id']) for i in request['items']}
        selected_tasks = [t for t in tasks if ('task', t.id) in keys]
        selected_events = [e for e in events if ('event', e.id) in keys]
    elif request['recent']:
        references = recent_creations(messages)
        if not references:
            return 'Mình chưa tìm thấy kết quả tạo thành công trước đó trong cuộc trò chuyện này. Bạn hãy cho biết tên hoặc ID cần xóa; mình sẽ không đoán theo tên trong câu trả lời.'
        selected_tasks = task_family(tasks, [i['id'] for i in references if i['item_type'] == 'task'])
        selected_events = [e for e in events if any(i['item_type'] == 'event' and i['id'] == e.id for i in references)]
    else:
        if not request['query'] and request['kind'] == 'item' and request['completed'] is None:
            return 'Bạn muốn xóa tất cả công việc hay tất cả lịch? Hãy nêu rõ phạm vi. Chưa có mục nào bị xóa.'
        selected_tasks = [t for t in tasks if request['kind'] != 'schedule' or t.due_date]
        selected_events = events if request['kind'] != 'task' else []
    if request['query']:
        query = ' '.join(fold(request['query']).split())
        def matches(item):
            title = ' '.join(fold(item.title).split())
            return query in title if request['contains'] else title == query
        selected_tasks = [t for t in selected_tasks if matches(t)]
        selected_events = [e for e in selected_events if matches(e)]
    if request['completed'] is not None:
        selected_tasks = [t for t in selected_tasks if t.is_completed == request['completed']]
        selected_events = []  # Legacy Events do not have a completed-task state.
    # A child exception must never widen deletion to an unrelated parent series.
    event_ids = {e.id for e in selected_events}
    if any(e.parent_event_id and e.parent_event_id not in event_ids for e in selected_events):
        return 'Có lần lặp đã được chỉnh riêng. Hãy chọn đúng lần trên Calendar để xóa; mình không tự mở rộng thành xóa cả chuỗi.'
    selected_events = [e for e in selected_events if not e.parent_event_id]
    selected = [*selected_tasks, *selected_events]
    if not selected:
        return 'Không tìm thấy mục phù hợp trong phạm vi bạn yêu cầu. Chưa có mục nào bị xóa.'
    if len(selected) > MAX_DELETE_ITEMS:
        return 'Có quá nhiều mục phù hợp. Hãy thu hẹp tên hoặc phạm vi để kiểm tra danh sách trước khi xóa.'
    if len(selected) > 1 and not request['all']:
        details = '\n'.join('- ' + item_label(i) for i in selected[:10])
        return f'Có {len(selected)} mục phù hợp. Hãy chọn ID, hoặc nói "xóa tất cả" kèm tên nếu muốn xóa toàn bộ các mục trùng tên:\n{details}\nChưa có yêu cầu xóa nào chờ xác nhận.'
    if selected_events and any(e.recurrence_rule for e in selected_events) and not request['all'] and not request['recent']:
        return 'Đây là lịch lặp. Bạn muốn xóa cả chuỗi hay một lần cụ thể? Hãy nói "xóa toàn bộ chuỗi" kèm tên, hoặc chọn lần cần xóa trên Calendar.'
    items = [{'item_type': 'task' if isinstance(i, Task) else 'event', 'id': i.id} for i in selected]
    return await executor.execute('delete_items', {'items': items})


async def selected_items(db, user_id, items):
    if not isinstance(items, list) or not items or len(items) > MAX_DELETE_ITEMS:
        raise ValueError('Danh sách mục cần xóa không hợp lệ.')
    keys = set()
    for item in items:
        if not isinstance(item, dict) or item.get('item_type') not in {'task', 'event'} or type(item.get('id')) is not int or item['id'] <= 0:
            raise ValueError('Mục cần xóa phải có đúng loại và ID hợp lệ.')
        keys.add((item['item_type'], item['id']))
    tasks, events = await owned_items(db, user_id)
    selected = [t for t in tasks if ('task', t.id) in keys] + [e for e in events if ('event', e.id) in keys]
    if len(selected) != len(keys):
        raise ValueError('Một mục không còn tồn tại hoặc không thuộc tài khoản của bạn. Chưa xóa mục nào.')
    if any(isinstance(i, Event) and i.parent_event_id and ('event', i.parent_event_id) not in keys for i in selected):
        raise ValueError('Cần chọn đúng lần lặp trên Calendar; không tự mở rộng thành xóa cả chuỗi.')
    return selected, tasks, events


async def deletion_snapshot(db, user_id, items):
    selected, tasks, events = await selected_items(db, user_id, items)
    task_ids = {i.id for i in selected if isinstance(i, Task)}
    event_ids = {i.id for i in selected if isinstance(i, Event)}
    # Changes to descendants/exceptions/steps also invalidate the confirmation.
    family = task_family(tasks, task_ids)
    related_events = [e for e in events if e.id in event_ids or e.parent_event_id in event_ids]
    rows = sorted((type(i).__name__, i.id, str(i.updated_at), i.title,
                   str(getattr(i, 'is_completed', None)), str(i.recurrence_rule)) for i in [*family, *related_events])
    steps = (await db.execute(select(TaskStep).where(TaskStep.task_id.in_([t.id for t in family])))).scalars()
    rows += sorted(('step', s.id, s.task_id, s.title, s.is_completed) for s in steps)
    return rows


async def delete_selected(executor, items):
    from app.services.write_lock import AtomicBatchSession
    from app.services.task_service import task_service
    from app.services.event_service import event_service
    selected, _, _ = await selected_items(executor.db, executor.user_id, items)
    deleted = [{'item_type': 'task' if isinstance(i, Task) else 'event', 'id': i.id, 'title': i.title} for i in selected]
    atomic = AtomicBatchSession(executor.db)
    for item in selected:
        if isinstance(item, Task):
            await task_service.delete_task(atomic, item.id, executor.user_id)
        else:
            await event_service.delete_event(atomic, item.id, executor.user_id, scope='all')
    await executor.db.commit()
    return {'affected_count': len(deleted), 'items': deleted}
