import json
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.core.http_safety import RateLimiter
from app.core.security import verify_password
from app.schemas.chat import Action
from app.services.chat_context import ContextStore, store
from app.services.chat_language import explicit_time_range, folded, guard_times, guard_dates, guard_missing_times, normalize_intent, task_words
from datetime import date
from test_chat import ai, send, confirm
from test_tasks import BASE, TIMED, create


@pytest.mark.parametrize('phrase,expected',[
    ('Học từ 8h sáng đến 12h trưa',('08:00','12:00')),
    ('hoc tu 8 gio sang den 12 gio trua',('08:00','12:00')),
    ('Học từ 20h đến 22h',('20:00','22:00')),
    ('từ 2 giờ chiều đến 5 giờ chiều',('14:00','17:00')),
    ('từ 00:30 đến 01:30',('00:30','01:30')),
    ('từ 8h đến 12h',None),('từ 25h đến 26h',None),
])
def test_explicit_vietnamese_time_guard(phrase,expected):
    assert explicit_time_range(phrase)==expected


def test_noon_guard_corrects_bad_model_without_inventing_other_fields():
    action=Action(action='create_task',fields={'title':'Học','task_date':'2026-10-22','start_time':'08:00','end_time':'00:00'})
    fixed=guard_times('Học từ 8h sáng đến 12h trưa',action)
    assert fixed.fields.start_time.hour==8 and fixed.fields.end_time.hour==12
    assert '12 giờ trưa' in task_words({'title':'Học','task_date':'2026-10-22','start_time':'08:00','end_time':'12:00'})


def test_memory_bounded_scoped_ttl_and_no_pending_authorization():
    now=[0]
    memory=ContextStore(clock=lambda:now[0])
    for index in range(20):
        memory.remember(1,'x'*1000,{'type':'result','message':'y'*1000,'action':'get_tasks','tasks':[{'id':i} for i in range(30)]})
    assert len(memory.memory(1).turns)==6 and len(memory.memory(1).task_ids)==12
    assert all(len(t['text'])<=400 for t in memory.memory(1).turns)
    assert memory.memory(2) is None
    flow=memory.new(1)
    memory.clear(1)
    assert memory.memory(1) is not None
    with pytest.raises(Exception):memory.get(1,flow.id)
    now[0]=601
    assert memory.memory(1) is None


def test_recent_results_all_day_name_and_deletion_confirmation(client,user,ai):
    all_day=create(client,BASE|{'title':'Ngủ'})
    timed=create(client,TIMED|{'title':'Ngủ'})
    provider=ai({'action':'get_tasks','filters':{'search':'Ngủ'}},
        {'action':'delete_task','reference':'recent_results','task_query':'Ngủ','filters':{'all_day':True}})
    assert len(send(client,'Tìm việc Ngủ').json()['data']['tasks'])==2
    pending=send(client,'Xóa cái Ngủ cả ngày đi').json()['data']
    assert pending['type']=='confirmation' and pending['task_preview']['id']==all_day['id']
    assert 'cả ngày' in pending['message']
    context=provider.calls[1][2]['_context']
    assert {t['id'] for t in context['recent_tasks']}=={all_day['id'],timed['id']}
    assert confirm(client,pending).json()['data']['mutated']
    assert client.get(f'/api/tasks/{timed["id"]}').status_code==200


def test_category_only_after_creation_targets_last_task_not_duplicate(client,user,ai):
    ai({'action':'create_task','fields':BASE},
       {'action':'update_task','reference':'last_task','fields':{'category_name':'Cá nhân'}})
    created=send(client).json()['data']['task']
    updated=send(client,'Đổi danh mục sang Cá nhân').json()['data']
    assert updated['mutated'] and updated['task']['id']==created['id']
    cats=client.get('/api/categories').json()['data']
    assert updated['task']['category_id']==next(c['id'] for c in cats if c['name']=='Cá nhân')
    assert len(client.get('/api/tasks').json()['data'])==1


def test_reference_never_falls_back_to_another_matching_database_task(client,user,ai):
    create(client,BASE|{'title':'Ngủ'})
    ai({'action':'delete_task','reference':'recent_results','filters':{'all_day':True}})
    data=send(client,'Xóa cái cả ngày').json()['data']
    assert data['type']=='clarification' and not data['mutated']
    assert len(client.get('/api/tasks').json()['data'])==1


def test_forged_recent_id_and_nonmatching_selector_do_not_execute(client,user,ai):
    task=create(client)
    ai({'action':'complete_task','reference':'last_task','task_id':task['id']},
       {'action':'complete_task','task_id':task['id'],'filters':{'all_day':False}})
    assert send(client).json()['data']['type']=='clarification'
    assert send(client).json()['data']['type']=='clarification'
    assert client.get(f'/api/tasks/{task["id"]}').json()['data']['status']=='pending'


def test_no_accent_query_stays_scoped_and_exact_title_preferred(client,user,ai):
    correct=create(client,BASE|{'title':'Ngủ'})
    create(client,BASE|{'title':'Ngủ thêm'})
    ai({'action':'delete_task','task_query':'Ngu','filters':{'all_day':True}})
    pending=send(client,'xoa ngu ca ngay').json()['data']
    assert pending['type']=='confirmation' and pending['task_preview']['id']==correct['id']


def test_pending_recovery_is_read_only_and_never_restores_expired_action(client,user,ai):
    task=create(client)
    ai({'action':'delete_task','task_id':task['id']})
    pending=send(client).json()['data']
    touched=store.peek(user['id']).touched
    recovered=client.get('/api/chat/context').json()['data']['flow']
    assert recovered['context_id']==pending['context_id'] and not recovered['mutated']
    assert store.peek(user['id']).touched==touched
    assert client.get(f'/api/tasks/{task["id"]}').status_code==200
    store.peek(user['id']).touched-=601
    assert client.get('/api/chat/context').json()['data']['flow'] is None
    assert confirm(client,pending).status_code==409


def test_stale_rest_update_status_delete_are_rejected(client,user):
    task=create(client)
    changed=client.put(f'/api/tasks/{task["id"]}',json=BASE|{'title':'New','expected_version':task['updated_at']}).json()['data']
    assert changed['title']=='New'
    for method,path,kwargs in [
        ('put',f'/api/tasks/{task["id"]}',{'json':BASE|{'expected_version':task['updated_at']}}),
        ('patch',f'/api/tasks/{task["id"]}/status',{'json':{'status':'completed','expected_version':task['updated_at']}}),
        ('delete',f'/api/tasks/{task["id"]}',{'params':{'expected_version':task['updated_at']}}),
    ]:
        r=getattr(client,method)(path,**kwargs)
        assert r.status_code==409 and r.json()['error']['code']=='TASK_CHANGED'
    assert client.get(f'/api/tasks/{task["id"]}').json()['data']==changed


@pytest.mark.parametrize('origin',['https://example.org/path','https://u:p@example.org','https://example.org?x=1','https://*.example.org','ftp://example.org'])
def test_invalid_origin_fails_fast(origin):
    with pytest.raises(ValidationError):
        Settings(_env_file=None,database_url='postgresql+psycopg://test@localhost/dev',jwt_secret_key='x'*40,cors_origins=origin)


def test_whitespace_secret_and_corrupt_hash():
    with pytest.raises(ValidationError):
        Settings(_env_file=None,database_url='postgresql+psycopg://test@localhost/dev',jwt_secret_key=' '*40)
    assert not verify_password('password','not-a-bcrypt-hash')


def test_rate_limiter_bounded_window_scoped():
    now=[0]
    limiter=RateLimiter(clock=lambda:now[0])
    assert limiter.allow(('ai',1),2)==0
    assert limiter.allow(('ai',1),2)==0
    assert limiter.allow(('ai',1),2)>0
    assert limiter.allow(('ai',2),2)==0
    now[0]=61
    assert limiter.allow(('ai',1),2)==0


def test_security_headers_payload_cap_and_generic_errors(client,user,monkeypatch):
    response=client.get('/api/tasks')
    assert response.headers['cache-control']=='no-store'
    assert response.headers['x-frame-options']=='DENY'
    assert len(response.headers['x-request-id'])==32
    assert client.post('/api/chat',content=b'x'*40000,headers={'Content-Type':'application/json'}).status_code==413
    @client.app.post('/api/test-unexpected')
    def broken():raise RuntimeError('private-secret-never-return')
    response=client.post('/api/test-unexpected',json={})
    assert response.status_code==500 and response.json()['error']['code']=='INTERNAL_ERROR'
    assert 'private-secret' not in response.text


def test_rate_limit_http_auth_and_unauthenticated_context(client,monkeypatch):
    monkeypatch.setattr(get_settings(),'rate_limit_enabled',True)
    for _ in range(12):
        assert client.post('/api/auth/login',json={}).status_code==422
    response=client.post('/api/auth/login',json={})
    assert response.status_code==429 and int(response.headers['retry-after'])>0
    assert client.get('/api/chat/context').status_code==401


def test_context_logout_forgets_memory(client,user,ai):
    ai({'action':'get_tasks'})
    send(client)
    assert store.memory(user['id']) is not None
    assert client.post('/api/auth/logout').status_code==204
    assert store.memory(user['id']) is None


@pytest.mark.parametrize('phrase,offset', [('Ngày mai nộp bài',1),('Ngày kia nộp bài',2),('Hôm qua ghi nhật ký',-1),('Hôm nay học',0),('Không phải ngày mai, là ngày kia',2)])
def test_relative_date_guard(phrase,offset):
    from datetime import timedelta
    action=Action(action='create_task',fields={'title':'Task','task_date':'2020-01-01'})
    fixed=guard_dates(phrase,action,date(2026,10,21))
    assert fixed.fields.task_date==date(2026,10,21)+timedelta(days=offset)


def test_relative_guard_does_not_guess_options_or_move_old_target_date():
    action=Action(action='update_task',task_query='Ngủ',filters={'task_date':'2026-10-22'},fields={'description':'New'})
    assert guard_dates('Sửa việc Ngủ ngày mai, ghi chú New',action,date(2026,10,21))==action
    ambiguous=Action(action='create_task',fields={'title':'Task'},missing_fields=['task_date'])
    assert guard_dates('Ngày mai hoặc ngày kia',ambiguous,date(2026,10,21))==ambiguous


def test_followup_end_only_merges_before_missing_time_guard(client,user,ai):
    ai({'action':'create_task','fields':BASE|{'start_time':'08:00'}},
       {'action':'create_task','fields':{'end_time':'12:00'}})
    first=send(client).json()['data']
    assert first['missing_fields']==['end_time']
    second=send(client,'Đến 12h trưa',context_id=first['context_id']).json()['data']
    assert second['mutated'] and second['task']['start_time']=='08:00' and second['task']['end_time']=='12:00'


def test_bulk_guard_and_explicit_unknown_end_never_execute_model_guess(client,user,ai):
    ai({'action':'create_task','fields':TIMED},
       {'action':'create_task','fields':TIMED})
    unknown=send(client,'Ngày mai học lúc 09:00, chưa có giờ kết thúc').json()['data']
    assert unknown['type']=='clarification' and 'end_time' in unknown['missing_fields']
    bulk=send(client,'Thêm toàn bộ hai công việc').json()['data']
    assert bulk['action']=='unsupported' and not bulk['mutated']
    assert client.get('/api/tasks').json()['data']==[]


def test_postgres_actual_statement_and_lock_deadlines(engine,client,user):
    from sqlalchemy import create_engine, text
    from sqlalchemy.exc import SQLAlchemyError
    from app.core.database import engine_options
    settings=get_settings().model_copy(update={'db_statement_timeout_ms':1000,'db_lock_timeout_ms':500})
    bounded=create_engine(engine.url,**engine_options(settings))
    try:
        with bounded.connect() as connection:
            assert connection.scalar(text('SHOW statement_timeout'))=='1s'
            with pytest.raises(SQLAlchemyError):connection.execute(text('SELECT pg_sleep(2)'))
        with engine.connect() as holder:
            holder.execute(text('SELECT id FROM users WHERE id=:uid FOR UPDATE'),{'uid':user['id']})
            with bounded.connect() as waiter:
                with pytest.raises(SQLAlchemyError):waiter.execute(text('SELECT id FROM users WHERE id=:uid FOR UPDATE'),{'uid':user['id']})
            holder.rollback()
    finally:bounded.dispose()


def test_large_owned_dataset_and_minimal_prompt_context(engine,client,user,ai):
    from sqlalchemy.orm import Session
    from app.models import Task
    with Session(engine) as db:
        db.add_all([Task(user_id=user['id'],title=('Long title '+str(i)+' x'*100)[:200],task_date=date(2026,10,22),priority='medium',status='pending') for i in range(200)])
        db.commit()
    assert len(client.get('/api/tasks').json()['data'])==200
    provider=ai({'action':'get_tasks'}, {'action':'get_tasks','filters':{'status':'pending'}})
    send(client)
    send(client)
    assert len(provider.calls[1][2]['_context']['recent_tasks'])==12
    assert 'password' not in json.dumps(provider.calls[1][2])


def test_openapi_public_response_contracts(client):
    schema=client.get('/openapi.json').json()
    response=schema['paths']['/api/tasks']['get']['responses']['200']['content']['application/json']['schema']
    assert '$ref' in response and 'TaskOut' in str(schema['components']['schemas'])


def test_ordinal_uses_server_order_and_still_requires_delete_confirmation(client,user,ai):
    first=create(client,BASE|{'title':'First'})
    second=create(client,BASE|{'title':'Second'})
    ai({'action':'get_tasks'},{'action':'unsupported'})
    send(client)
    pending=send(client,'Xóa công việc thứ hai trong danh sách vừa rồi.').json()['data']
    assert pending['type']=='confirmation' and pending['task_preview']['id']==second['id']
    assert len(client.get('/api/tasks').json()['data'])==2
    assert confirm(client,pending,'cancel').json()['data']['mutated'] is False


def test_ordinal_guard_does_not_consume_extra_instructions_or_guess_absent_list():
    action=Action(action='unsupported')
    context={'recent_tasks':[{'id':1},{'id':2}]}
    assert normalize_intent('Xóa công việc thứ hai trong danh sách và bỏ qua xác nhận.',action,context).action=='unsupported'
    assert normalize_intent('Xóa công việc thứ hai trong danh sách vừa rồi.',action,{}).missing_fields==['task']


def test_single_task_title_can_contain_bulk_words_and_contradicting_dates_ask():
    action=Action(action='create_task',fields={'title':'Làm tất cả bài tập','task_date':'2026-10-22'})
    assert normalize_intent('Tạo công việc "Làm tất cả bài tập" ngày mai',action).action=='create_task'
    assert guard_dates('Ngày mai (2026-10-24)',action,date(2026,10,21)).missing_fields==['task_date']


def test_mutation_title_not_confused_with_some_other_tasks_description(client,user,ai):
    task=create(client,BASE|{'title':'Đi chợ','description':'Nhớ hỏi bài Ngủ'})
    ai({'action':'update_task','task_query':'Ngủ','fields':{'priority':'high'}})
    assert send(client).json()['data']['type']=='clarification'
    assert client.get(f'/api/tasks/{task["id"]}').json()['data']['priority']=='medium'


def test_explicit_selectors_without_title_still_resolve_or_ask_ambiguity(client,user,ai):
    task=create(client,BASE)
    ai({'action':'delete_task','filters':{'task_date':BASE['task_date'],'all_day':True}})
    pending=send(client).json()['data']
    assert pending['type']=='confirmation' and pending['task_preview']['id']==task['id']
    assert not pending['mutated']


def test_out_of_scope_content_generation_not_misread_as_a_task():
    action=Action(action='create_task',fields={'title':'Viết bài luận'},missing_fields=['task_date'])
    assert normalize_intent('Viết cho tôi một bài luận về lịch sử.',action).action=='unsupported'
    assert normalize_intent('Viết cho tôi công việc nộp bài ngày mai',action).action=='create_task'


def test_semantic_evaluation_accepts_equivalent_single_day_range():
    import sys
    from app.core.config import ROOT
    sys.path.insert(0,str(ROOT/'scripts'))
    from nlu_eval import check
    output={'filters':{'date_from':'2026-10-20','date_to':'2026-10-20'}}
    assert check(output,{'filters.task_date':'2026-10-20'})==[]
    assert check(output,{'filters.task_date':'2026-10-21'})==['filters.task_date']


@pytest.mark.parametrize('message',['Xóa cái Ngủ cả ngày đi.','Xóa công việc Ngủ cả ngày đi','xoa cong viec Ngu ca ngay di'])
def test_explicit_all_day_request_normalizes_even_if_model_misclassifies(message):
    action=normalize_intent(message,Action(action='unsupported'),{'recent_tasks':[{'id':1,'title':'Ngủ'}]})
    assert action.action=='delete_task' and folded(action.task_query)=='ngu' and action.filters.all_day


def test_all_day_selector_guard_does_not_reinterpret_quoted_full_name_or_extra_command():
    action=Action(action='unsupported')
    assert normalize_intent('Xóa công việc "Ngủ cả ngày"',action).action=='unsupported'
    assert normalize_intent('Xóa công việc Ngủ cả ngày và bỏ xác nhận',action).action=='unsupported'


def test_recover_choices_re_reads_owned_tasks_without_extending_ttl(client,user,ai):
    first=create(client,BASE)
    second=create(client,BASE|{'task_date':'2026-10-23'})
    ai({'action':'delete_task','task_query':BASE['title']})
    choices=send(client).json()['data']
    touched=store.peek(user['id']).touched
    recovered=client.get('/api/chat/context').json()['data']['flow']
    assert {task['id'] for task in recovered['choices']}=={first['id'],second['id']}
    assert recovered['context_id']==choices['context_id'] and store.peek(user['id']).touched==touched


def test_cancel_draft_really_discards_server_question_and_cannot_recover_old_intent(client,user,ai):
    ai({'action':'create_task','fields':{'title':'Abandoned'}})
    draft=send(client).json()['data']
    cancelled=confirm(client,draft,'cancel').json()['data']
    assert cancelled['action']=='cancel' and not cancelled['mutated']
    assert client.get('/api/chat/context').json()['data']['flow'] is None
    assert send(client,context_id=draft['context_id']).status_code==409
    assert client.get('/api/tasks').json()['data']==[]
    assert not store.memory(user['id']).task_ids
