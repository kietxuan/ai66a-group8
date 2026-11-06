import asyncio
import json
from datetime import date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.ai import agent, scheduling
from app.ai.agent import PlanifyAgent
from app.ai.scheduling import constrain_creation, recurrence_request
from app.ai.tool_executor import ToolExecutor
from app.ai.replies import execution_content
from app.core.time import BUSINESS_TZ
from app.core.config import settings
from app.services.recurrence import occurrences, parse_rule
from app.services.task_service import task_service

PROMPT = 'Tạo cho tôi lịch Học bài vào thứ hai, thứ tư, thứ sáu từ 7h50 đến 9h20 tối kéo dài 3 tuần bắt đầu từ tuần sau'


@pytest.fixture(autouse=True)
def fixed_clock(monkeypatch):
    today = date(2026, 11, 6)
    monkeypatch.setattr(scheduling, 'business_today', lambda: today)
    monkeypatch.setattr(scheduling, 'local_now', lambda: datetime(2026, 11, 6, 20, 36, tzinfo=BUSINESS_TZ))
    monkeypatch.setattr(agent, 'business_today', lambda: today)


@pytest.mark.parametrize('weekdays', ['thứ hai, thứ tư, thứ sáu', 'thứ 2,4,6', 'T2, T4, T6', 'thứ hai, tư và sáu', 'thu 2/4/6'])
def test_weekday_names_and_shared_prefix_lists(weekdays):
    parts, start = recurrence_request(f'Tạo lịch Học bài vào {weekdays} từ 19h50 đến 21h20 kéo dài 3 tuần bắt đầu từ tuần sau')
    assert parts == {'FREQ': 'WEEKLY', 'BYDAY': 'MO,WE,FR', 'UNTIL': '20261129'}
    assert start == date(2026, 11, 9)


@pytest.mark.parametrize('today', [date(2026, 11, day) for day in range(2, 9)])
def test_next_week_is_next_monday_for_every_day(monkeypatch, today):
    monkeypatch.setattr(scheduling, 'business_today', lambda: today)
    assert recurrence_request(PROMPT)[1] == date(2026, 11, 9)


@pytest.mark.parametrize('name', ['create_task', 'create_event'])
def test_wrong_provider_weekdays_and_start_are_overridden(name):
    args = {'title': 'Học bài', 'recurrence_rule': 'FREQ=WEEKLY;BYDAY=MO,TH,SA;COUNT=999',
            'due_date': '2026-11-14', 'start_time': '19:50', 'end_time': '21:20',
            'start_at': '2026-11-14T19:50:00+07:00', 'end_at': '2026-11-14T21:20:00+07:00'}
    corrected = constrain_creation(name, args, PROMPT)
    rule = parse_rule(corrected['recurrence_rule'])
    assert rule['BYDAY'] == 'MO,WE,FR'
    assert rule['UNTIL'] == '20261129'
    assert 'COUNT' not in rule
    if name == 'create_task':
        assert corrected['due_date'] == '2026-11-09'
        start = datetime(2026, 11, 9, 19, 50, tzinfo=BUSINESS_TZ)
    else:
        start = datetime.fromisoformat(corrected['start_at'])
        assert start == datetime(2026, 11, 9, 19, 50, tzinfo=BUSINESS_TZ)
        assert datetime.fromisoformat(corrected['end_at']) - start == timedelta(minutes=90)
    rows = list(occurrences(start, start + timedelta(minutes=90), corrected['recurrence_rule'],
                            start, start + timedelta(days=40)))
    assert [row[0].day for row in rows] == [9, 11, 13, 16, 18, 20, 23, 25, 27]


def test_next_week_selects_first_requested_weekday_not_always_monday():
    text = PROMPT.replace('thứ hai, thứ tư, thứ sáu', 'thứ tư, thứ sáu')
    row = constrain_creation('create_task', {'due_date': '2026-11-14', 'start_time': '19:50'}, text)
    assert row['due_date'] == '2026-11-11'
    assert parse_rule(row['recurrence_rule'])['BYDAY'] == 'WE,FR'
    assert PlanifyAgent()._extract_date_from_text('Tạo lịch họp vào thứ tư tuần sau') == date(2026, 11, 11)


def test_title_weekdays_are_data_and_time_ranges_do_not_expand_weekdays():
    parts, _ = recurrence_request('Tạo lịch "Báo cáo thứ Năm" vào thứ Hai từ 9h đến 10h và thứ Sáu hàng tuần')
    assert parts['BYDAY'] == 'MO,FR'
    assert recurrence_request('Tạo lịch từ thứ 2 đến thứ 6 hàng tuần')[0]['BYDAY'] == 'MO,TU,WE,TH,FR'


def test_calendar_month_end_and_explicit_start_remain_supported():
    parts, start = recurrence_request('Tạo lịch mỗi thứ Năm và Chủ nhật từ 18h đến 19h bắt đầu từ 03/11/2026 đến hết 2 tháng sau')
    assert start == date(2026, 11, 3)
    assert parts['BYDAY'] == 'TH,SU'
    assert parts['UNTIL'] == '20270103'


def test_next_week_handles_year_boundary(monkeypatch):
    monkeypatch.setattr(scheduling, 'business_today', lambda: date(2026, 12, 31))
    parts, start = recurrence_request(PROMPT)
    assert start == date(2027, 1, 4)
    assert parts['UNTIL'] == '20270124'


def test_weekday_parsing_does_not_shift_explicit_nonrecurring_dates():
    assert recurrence_request('Tạo lịch thứ Hai bắt đầu từ ngày 10/11/2026')[1] == date(2026, 11, 10)
    assert recurrence_request('Tạo lịch từ thứ Sáu đến Chủ nhật hàng tuần')[0]['BYDAY'] == 'FR,SA,SU'


def test_local_nlp_uses_same_weekday_and_week_start_constraints(monkeypatch):
    created = []

    async def create_task(db, user_id, task_in):
        created.append(task_in)
        return SimpleNamespace(id=17, title=task_in.title, list_id=None, is_important=False,
                               is_in_my_day=False, due_date=task_in.due_date, start_time=task_in.start_time,
                               end_time=task_in.end_time, auto_complete=False, is_completed=False,
                               is_all_day=False, duration_minutes=90, recurrence_rule=task_in.recurrence_rule, steps=[])

    monkeypatch.setattr(task_service, 'create_task', create_task)
    db = SimpleNamespace(rollback=AsyncMock())
    executor = ToolExecutor(98532, db, request_text=PROMPT)
    asyncio.run(PlanifyAgent()._run_local_smart_agent(executor, PROMPT))
    assert len(created) == 1
    task = created[0]
    assert task.title == 'Học bài'
    assert task.due_date == date(2026, 11, 9)
    assert task.start_time.isoformat() == '19:50:00'
    assert task.end_time.isoformat() == '21:20:00'
    assert parse_rule(task.recurrence_rule)['BYDAY'] == 'MO,WE,FR'
    reply = execution_content(executor.executions)
    assert 'thứ Hai, thứ Tư, thứ Sáu' in reply
    assert '09/11/2026' in reply


@pytest.mark.parametrize('tool', ['create_task', 'create_event'])
def test_full_agent_corrects_wrong_provider_output_before_saving(monkeypatch, tool):
    created = []

    async def create_task(db, user_id, task_in):
        created.append(task_in)
        return SimpleNamespace(id=18, title=task_in.title, list_id=None, is_important=False,
                               is_in_my_day=False, due_date=task_in.due_date, start_time=task_in.start_time,
                               end_time=task_in.end_time, auto_complete=False, is_completed=False,
                               is_all_day=False, duration_minutes=90, recurrence_rule=task_in.recurrence_rule, steps=[])

    args = {'title': 'Học bài', 'recurrence_rule': 'FREQ=WEEKLY;BYDAY=MO,TH,SA;UNTIL=20261127'}
    if tool == 'create_task':
        args.update(due_date='2026-11-14', start_time='19:50', end_time='21:20')
    else:
        args.update(start_at='2026-11-14T19:50:00+07:00', end_at='2026-11-14T21:20:00+07:00')
    provider = AsyncMock(return_value={'role': 'assistant', 'content': None, 'tool_calls': [
        {'id': 'qa-1', 'type': 'function', 'function': {'name': tool, 'arguments': json.dumps(args)}}]})
    monkeypatch.setattr(settings, 'AI_API_KEY', 'qa-no-network')
    monkeypatch.setattr(PlanifyAgent, '_call_groq', provider)
    monkeypatch.setattr(task_service, 'create_task', create_task)
    reply = asyncio.run(PlanifyAgent().chat(98533, [{'role': 'user', 'content': PROMPT}], SimpleNamespace(rollback=AsyncMock())))
    assert len(created) == 1
    assert provider.await_count == 1
    assert created[0].due_date == date(2026, 11, 9)
    assert parse_rule(created[0].recurrence_rule)['BYDAY'] == 'MO,WE,FR'
    assert 'thứ Hai, thứ Tư, thứ Sáu' in reply['content']
    assert '09/11/2026' in reply['content']
