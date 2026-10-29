from datetime import date, datetime
import json
from random import Random

import pytest
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.chat import Action
from app.services import availability_service, chat_service
from app.services.availability_service import VN, free_slots
from app.services.chat_context import store
from app.services.chat_language import guard_dates, normalize_intent
from test_chat import ai, confirm, send
from test_tasks import create

DAY = "2099-10-22"
CRITERIA = {"task_date": DAY, "duration_minutes": 60, "start_time": "08:00", "end_time": "12:00"}


@pytest.fixture(autouse=True)
def clock(monkeypatch):
    monkeypatch.setattr(availability_service, "now_in_vietnam", lambda: datetime(2099, 10, 21, 7, 30, tzinfo=VN))


def action(**changes):
    return {"action": "suggest_free_slots", "availability": CRITERIA | changes}


def times(data):
    return [(s["start_time"], s["end_time"]) for s in data["slots"]]


@pytest.mark.parametrize("busy,expected,more", [
    ([], [(480, 540), (540, 600), (600, 660)], True),
    ([(480, 540)], [(540, 600), (600, 660), (660, 720)], False),
    ([(400, 510), (500, 540), (540, 570), (690, 800)], [(570, 630), (630, 690)], False),
    ([(400, 800)], [], False),
    ([(490, 530), (540, 590), (600, 650), (660, 710)], [], False),
    ([(400, 480), (720, 800)], [(480, 540), (540, 600), (600, 660)], True),
])
def test_interval_merge_clip_boundary_and_cap(busy, expected, more):
    assert free_slots(480, 720, 60, busy) == (expected, more)


def test_interval_algorithm_matches_independent_minute_grid():
    rng = Random(815)
    for _ in range(250):
        busy = [(a, a + rng.randint(1, 90)) for a in [rng.randint(0, 300) for _ in range(12)]]
        start, end, duration = 20, 280, rng.randint(1, 100)
        expected, cursor = [], start
        while cursor + duration <= end:
            if any(left < cursor + duration and right > cursor for left, right in busy):
                cursor += 1
            else:
                expected.append((cursor, cursor + duration))
                cursor += duration
        assert free_slots(start, end, duration, busy) == (expected[:3], len(expected) > 3)


@pytest.mark.parametrize("changes", [
    {"duration_minutes": True}, {"duration_minutes": "60"}, {"duration_minutes": 1.5},
    {"duration_minutes": 0}, {"duration_minutes": -1}, {"duration_minutes": 1440},
    {"task_date": "2099-02-30"}, {"end_time": "24:00"}, {"start_time": "08:00:00"},
    {"user_id": 3},
])
def test_strict_criteria_reject_invalid_types_or_ownership(changes):
    with pytest.raises(ValidationError):
        Action.model_validate(action(**changes))


def test_suggestions_are_read_only_even_with_execution_disabled(client, user, ai, monkeypatch):
    before = client.get('/api/tasks').json()['data']
    monkeypatch.setattr(get_settings(), 'chat_execution_enabled', False)
    monkeypatch.setattr(chat_service, 'execute', lambda *a, **kw: pytest.fail('Availability must never execute'))
    ai(action())
    data = send(client).json()['data']
    assert data['type'] == 'availability' and data['action'] == 'suggest_free_slots' and data['mutated'] is False
    assert times(data) == [('08:00', '09:00'), ('09:00', '10:00'), ('10:00', '11:00')]
    assert data['has_more'] is True and data['checked_at'].endswith('+07:00')
    assert data['criteria'] == CRITERIA and 'context_id' not in data
    assert client.get('/api/tasks').json()['data'] == before
    assert client.get('/api/chat/context').json()['data']['flow'] is None


def test_only_own_pending_timed_tasks_block_and_versions_unchanged(client, user, ai):
    # Touching/overlapping intervals merge, but completed and all-day do not block.
    create(client, {"title": "Busy", "task_date": DAY, "start_time": "09:00", "end_time": "10:00"})
    create(client, {"title": "Overlap", "task_date": DAY, "start_time": "09:30", "end_time": "10:30", "allow_conflict": True})
    create(client, {"title": "Touching", "task_date": DAY, "start_time": "10:30", "end_time": "11:00"})
    create(client, {"title": "All day", "task_date": DAY})
    done = create(client, {"title": "Completed", "task_date": DAY, "start_time": "08:00", "end_time": "09:00"})
    client.patch(f'/api/tasks/{done["id"]}/status', json={"status": "completed"})
    client.post('/api/auth/register', json={"name": "Other", "email": "other@example.com", "password": "other-pass-123"})
    client.post('/api/auth/login', json={"email": "other@example.com", "password": "other-pass-123"})
    create(client, {"title": "FOREIGN PRIVATE TITLE", "task_date": DAY, "start_time": "08:00", "end_time": "12:00"})
    client.post('/api/auth/login', json={"email": "test@example.com", "password": "test-pass-123"})
    before = client.get('/api/tasks').json()['data']
    ai(action())
    result = send(client)
    assert result.status_code == 200 and 'FOREIGN' not in result.text
    assert times(result.json()['data']) == [('08:00', '09:00'), ('11:00', '12:00')]
    assert client.get('/api/tasks').json()['data'] == before


def test_partial_criteria_followup_recovery_and_no_confirmation(client, user, ai):
    provider = ai({"action": "suggest_free_slots"},
        {"action": "suggest_free_slots", "availability": {"task_date": DAY, "duration_minutes": 90}},
        {"action": "clarify", "availability": {"start_time": "08:00", "end_time": "12:00"}})
    first = send(client).json()['data']
    assert first['missing_fields'] == ['task_date', 'duration_minutes', 'start_time', 'end_time']
    assert client.get('/api/chat/context').json()['data']['flow']['context_id'] == first['context_id']
    assert confirm(client, first).status_code == 400  # Draft never grants write authority.
    second = send(client, context_id=first['context_id']).json()['data']
    assert second['missing_fields'] == ['start_time', 'end_time']
    last = send(client, context_id=second['context_id']).json()['data']
    assert times(last) == [('08:00', '09:30'), ('09:30', '11:00')]
    assert provider.calls[-1][2]['availability']['duration_minutes'] == 90
    assert client.get('/api/tasks').json()['data'] == []
    assert confirm(client, first).status_code == 409


def test_live_draft_has_priority_over_spurious_ai_memory_reference(client, user, ai):
    ai({'action':'suggest_free_slots','availability':{'task_date':DAY}},
        {'action':'suggest_free_slots','reference':'last_availability',
         'availability':{'duration_minutes':90,'start_time':'08:00','end_time':'18:00'}})
    draft=send(client).json()['data']
    assert store.memory(user['id']).last_availability is None
    data=send(client,context_id=draft['context_id']).json()['data']
    assert data['type']=='availability' and data['criteria']['task_date']==DAY
    assert data['criteria']['duration_minutes']==90 and not data['mutated']


@pytest.mark.parametrize('changes,missing', [
    ({'task_date': '2099-10-20'}, ['task_date']),
    ({'start_time': '23:00', 'end_time': '01:00'}, ['start_time', 'end_time']),
    ({'end_time': '08:00'}, ['start_time', 'end_time']),
    ({'duration_minutes': 300}, ['duration_minutes', 'start_time', 'end_time']),
])
def test_business_invalid_search_asks_instead_of_guessing(client, user, ai, changes, missing):
    ai(action(**changes))
    data = send(client).json()['data']
    assert data['type'] == 'clarification' and data['missing_fields'] == missing and not data['mutated']
    assert client.get('/api/tasks').json()['data'] == []


@pytest.mark.parametrize('hour,minute,second,expected', [
    (9, 15, 1, [('09:16', '10:16'), ('10:16', '11:16')]),
    (9, 15, 0, [('09:15', '10:15'), ('10:15', '11:15')]),
    (12, 0, 0, []), (23, 59, 59, []),
])
def test_today_never_suggests_elapsed_time(client, user, ai, monkeypatch, hour, minute, second, expected):
    monkeypatch.setattr(availability_service, 'now_in_vietnam', lambda: datetime(2099, 10, 22, hour, minute, second, tzinfo=VN))
    ai(action())
    data = send(client).json()['data']
    assert times(data) == expected
    assert data['effective_start_time'] == (expected[0][0] if expected else None)


def test_no_slot_then_fresh_read_after_completion(client, user, ai):
    busy = create(client, {'title': 'Busy', 'task_date': DAY, 'start_time': '08:00', 'end_time': '12:00'})
    ai(action(), action())
    data = send(client).json()['data']
    assert data['slots'] == [] and data['has_more'] is False and 'Chưa có khoảng trống' in data['message']
    client.patch(f'/api/tasks/{busy["id"]}/status', json={'status': 'completed'})
    assert times(send(client).json()['data'])[0] == ('08:00', '09:00')


def test_suggestion_not_reservation_new_task_still_checks_conflict(client, user, ai):
    ai(action(), {'action': 'create_task', 'fields': {'title': 'New', 'task_date': DAY, 'start_time': '08:00', 'end_time': '09:00'}})
    assert send(client).json()['data']['type'] == 'availability'
    create(client, {'title': 'Added later', 'task_date': DAY, 'start_time': '08:00', 'end_time': '09:00'})
    draft = send(client).json()['data']
    assert draft['type'] == 'conflict' and not draft['mutated']
    assert len(client.get('/api/tasks').json()['data']) == 1
    confirm(client, draft, 'cancel')


def test_memory_keeps_only_criteria_not_stale_slots_or_old_task_reference(client, user, ai):
    task = create(client)
    provider = ai({'action': 'get_tasks'}, action(), action(task_date='2099-10-23'))
    send(client)
    assert store.memory(user['id']).last_task_id == task['id']
    send(client)
    memory = store.memory(user['id'])
    assert memory.last_availability == CRITERIA and memory.last_task_id is None and memory.task_ids == []
    send(client)
    context = provider.calls[-1][2]['_context']
    assert context['last_availability'] == CRITERIA and context['recent_tasks'] == []
    assert 'slots' not in context['last_availability']
    memory = store.memory(user['id'])
    memory.touched -= store.ttl + 1
    assert store.memory(user['id']) is None


def test_backend_resolves_partial_read_only_reference_from_own_memory(client, user, ai):
    ai(action(), {'action':'suggest_free_slots','reference':'last_availability','availability':{'duration_minutes':30}})
    send(client)
    data=send(client).json()['data']
    assert data['criteria']==CRITERIA|{'duration_minutes':30}
    assert times(data)==[('08:00','08:30'),('08:30','09:00'),('09:00','09:30')]
    assert not data['mutated'] and client.get('/api/tasks').json()['data']==[]


def test_expired_reference_drops_untrusted_copied_criteria_then_can_fill_draft(client, user, ai):
    ai(action(), action()|{'reference':'last_availability'}, action())
    send(client)
    store.memory(user['id']).touched-=store.ttl+1
    draft=send(client).json()['data']
    assert draft['type']=='clarification' and len(draft['missing_fields'])==4
    assert store.flows[user['id']].draft['availability']=={}
    recovered=send(client,context_id=draft['context_id']).json()['data']
    assert recovered['type']=='availability' and recovered['criteria']==CRITERIA


def test_reference_does_not_resolve_other_users_memory(client, user, ai):
    ai(action(), {'action':'suggest_free_slots','reference':'last_availability'})
    send(client)
    client.post('/api/auth/register',json={'name':'Other','email':'other@example.com','password':'other-pass-123'})
    client.post('/api/auth/login',json={'email':'other@example.com','password':'other-pass-123'})
    data=send(client).json()['data']
    assert data['type']=='clarification' and len(data['missing_fields'])==4
    assert DAY not in data['message'] and not data['mutated']


def test_reference_with_invalid_correction_retains_json_safe_followup_draft(client, user, ai):
    provider=ai(action(), {'action':'suggest_free_slots','reference':'last_availability',
        'availability':{'start_time':'13:00'}},
        {'action':'suggest_free_slots','availability':{'start_time':'08:00','end_time':'18:00'}})
    send(client)
    draft=send(client).json()['data']
    assert draft['type']=='clarification'
    assert send(client,context_id=draft['context_id']).json()['data']['type']=='availability'
    json.dumps(provider.calls[-1][2])


def test_expiry_cancellation_and_pending_guards(client, user, ai):
    task = create(client)
    provider = ai({'action': 'suggest_free_slots'}, {'action': 'delete_task', 'task_id': task['id']})
    draft = send(client).json()['data']
    store.flows[user['id']].touched -= store.ttl + 1
    assert send(client, context_id=draft['context_id']).status_code == 409
    pending = send(client).json()['data']
    assert pending['type'] == 'confirmation'
    assert send(client, 'Gợi ý giờ trống').status_code == 400
    assert len(provider.calls) == 2
    confirm(client, pending, 'cancel')


def test_explicit_vietnamese_time_and_relative_date_guards_for_availability():
    parsed = Action.model_validate(action(start_time='08:00', end_time='00:00'))
    fixed = normalize_intent('Gợi ý hai giờ trống từ 8h sáng đến 12h trưa', parsed)
    assert fixed.availability.end_time.strftime('%H:%M') == '12:00'
    fixed = guard_dates('Không phải ngày mai, là ngày kia', fixed, date(2099, 10, 21))
    assert fixed.availability.task_date.isoformat() == '2099-10-23'
    assert not fixed.fields.model_dump(exclude_unset=True)
