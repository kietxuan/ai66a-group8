from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.schemas.chat import Action,ChatRequest,Confirmation
from app.services import chat_service
from app.services.chat_context import store
from app.services.ai_provider import get_provider,prompt_data
from test_tasks import BASE,TIMED,create


class FakeProvider:
    def __init__(self,outputs):self.outputs=list(outputs);self.calls=[]
    def parse(self,message,categories,draft):
        self.calls.append((message,categories,draft))
        value=self.outputs.pop(0)
        if isinstance(value,Exception):raise value
        return value


@pytest.fixture
def ai(client):
    def configure(*outputs):
        provider=FakeProvider(outputs)
        client.app.dependency_overrides[get_provider]=lambda:provider
        return provider
    return configure


def send(client,message="Yêu cầu",**kwargs):
    return client.post('/api/chat',json={"message":message,**kwargs})


def confirm(client,data,decision="confirm"):
    return client.post('/api/chat/confirm',json={"context_id":data['context_id'],"decision":decision})


def test_five_actions_and_delta_preserves_other_fields(client,user,ai):
    ai({"action":"create_task","fields":TIMED|{"description":"Notes","priority":"high"}},
       {"action":"get_tasks","filters":{"search":"react"}},
       {"action":"update_task","task_query":"React","fields":{"title":"Updated"}},
       {"action":"complete_task","task_query":"Updated"},
       {"action":"complete_task","task_query":"Updated"},
       {"action":"delete_task","task_query":"Updated"})
    created=send(client).json()['data']
    assert created['mutated'] and created['task']['start_time']=='09:00'
    query=send(client).json()['data']
    assert len(query['tasks'])==1 and not query['mutated']
    updated=send(client).json()['data']['task']
    assert updated['title']=='Updated' and updated['description']=='Notes' and updated['priority']=='high' and updated['start_time']=='09:00'
    assert send(client).json()['data']['mutated']
    assert not send(client).json()['data']['mutated']
    delete=send(client).json()['data']
    assert delete['type']=='confirmation' and len(client.get('/api/tasks').json()['data'])==1
    result=confirm(client,delete).json()['data']
    assert result['mutated'] and result['task'] is None
    assert confirm(client,delete).status_code==409
    assert client.get('/api/tasks').json()['data']==[]


def test_missing_followup_all_day(client,user,ai):
    provider=ai({"action":"create_task","fields":{"title":"Học React"}},
                {"action":"create_task","fields":{"task_date":"2026-10-06"}})
    first=send(client).json()['data']
    assert first['type']=='clarification' and first['missing_fields']==['task_date']
    assert client.get('/api/tasks').json()['data']==[]
    second=send(client,"ngày mai",context_id=first['context_id']).json()['data']
    assert second['mutated'] and second['task']['title']=='Học React' and second['task']['start_time'] is None
    assert provider.calls[1][2]['fields']['title']=='Học React'


def test_changed_target_during_clarification_does_not_reuse_resolved_id(client,user,ai):
    first=create(client,BASE|{"title":"First task"})
    second=create(client,BASE|{"title":"Second task"})
    ai({"action":"update_task","task_query":"First task"},
       {"action":"update_task","task_query":"Second task","fields":{"description":"Only second"}})
    draft=send(client).json()['data']
    assert draft['type']=='clarification' and draft['missing_fields']==['changes']
    changed=send(client,context_id=draft['context_id']).json()['data']
    assert changed['mutated'] and changed['task']['id']==second['id']
    assert client.get(f'/api/tasks/{first["id"]}').json()['data']['description'] is None


def test_new_target_does_not_inherit_edits_for_previous_target(client,user,ai):
    first=create(client,BASE|{"title":"First task"})
    second=create(client,BASE|{"title":"Second task"})
    ai({"action":"update_task","task_query":"First task","fields":{"category_name":"Unknown","description":"First only"}},
       {"action":"update_task","task_query":"Second task"})
    draft=send(client).json()['data']
    assert draft['type']=='clarification'
    changed=send(client,context_id=draft['context_id']).json()['data']
    assert changed['type']=='clarification' and not changed['mutated']
    for task in (first,second):
        assert client.get(f'/api/tasks/{task["id"]}').json()['data']['description'] is None


def test_timed_missing_end_and_unknown_category(client,user,ai):
    ai({"action":"create_task","fields":{"title":"Work","task_date":"2026-10-05","start_time":"08:00"}},
       {"action":"create_task","fields":{"end_time":"09:00","category_name":"Unknown"}},
       {"action":"create_task","fields":{"category_name":"Học tập"}})
    first=send(client).json()['data']
    assert first['type']=='clarification'
    second=send(client,context_id=first['context_id']).json()['data']
    assert second['type']=='clarification' and 'category_name' in second['missing_fields']
    third=send(client,context_id=second['context_id']).json()['data']
    assert third['mutated'] and third['task']['category_id'] in [c['id'] for c in client.get('/api/categories').json()['data']]


def test_ambiguity_selection_whitelist(client,user,ai):
    a=create(client);b=create(client,BASE|{"task_date":"2026-10-06"})
    provider=ai({"action":"delete_task","task_query":"React"})
    choices=send(client).json()['data']
    assert len(choices['choices'])==2
    assert send(client,context_id=choices['context_id'],selected_task_id=999).status_code==422
    selected=send(client,"Chọn",context_id=choices['context_id'],selected_task_id=b['id']).json()['data']
    assert selected['type']=='confirmation' and selected['task_preview']['id']==b['id']
    assert len(provider.calls)==1
    assert confirm(client,selected).json()['data']['mutated']
    assert client.get(f'/api/tasks/{a["id"]}').status_code==200


def test_conflict_new_preview_then_override(client,user,ai):
    create(client,TIMED)
    ai({"action":"create_task","fields":TIMED|{"title":"New"}})
    pending=send(client).json()['data']
    assert pending['type']=='conflict' and len(client.get('/api/tasks').json()['data'])==1
    create(client,TIMED|{"title":"Additional","allow_conflict":True})
    second=confirm(client,pending).json()['data']
    assert second['type']=='conflict' and len(second['conflicting_tasks'])==2
    assert len(client.get('/api/tasks').json()['data'])==2
    assert confirm(client,second).json()['data']['mutated']
    assert len(client.get('/api/tasks').json()['data'])==3


def test_cancel_task_changed_and_pending_guard(client,user,ai):
    task=create(client)
    ai({"action":"delete_task","task_id":task['id']},{"action":"delete_task","task_id":task['id']})
    pending=send(client).json()['data']
    assert send(client).status_code==400
    assert confirm(client,pending,'cancel').json()['data']['action']=='cancel'
    assert client.get(f'/api/tasks/{task["id"]}').status_code==200
    pending=send(client).json()['data']
    client.put(f'/api/tasks/{task["id"]}',json=BASE|{"title":"Changed"})
    r=confirm(client,pending)
    assert r.status_code==409 and r.json()['error']['code']=='TASK_CHANGED'
    assert confirm(client,pending).json()['error']['code']=='CONTEXT_EXPIRED'


def test_expired_restart_new_flow_wrong_owner_logout(client,user,ai):
    ai({"action":"create_task","fields":{"title":"Missing date"}},
       {"action":"create_task","fields":{"title":"Other draft"}})
    a=send(client).json()['data'];b=send(client).json()['data']
    assert a['context_id']!=b['context_id']
    assert send(client,context_id=a['context_id']).status_code==409
    flow=store.flows[user['id']];flow.touched-=601
    assert send(client,context_id=b['context_id']).status_code==409
    task=create(client)
    ai({"action":"delete_task","task_id":task['id']})
    pending=send(client).json()['data']
    client.post('/api/auth/register',json={"name":"Other","email":"other@example.com","password":"other-pass-123"})
    client.post('/api/auth/login',json={"email":"other@example.com","password":"other-pass-123"})
    assert confirm(client,pending).status_code==409
    client.post('/api/auth/login',json={"email":user['email'],"password":"test-pass-123"})
    client.post('/api/auth/logout')
    assert user['id'] not in store.flows and confirm(client,pending).status_code==401


@pytest.mark.parametrize('output',[
    {"action":"create_task","fields":BASE,"user_id":2},
    {"action":"create_task","fields":BASE|{"allow_conflict":True}},
    {"action":"delete_task","confirmed":True},
    {"action":"create_task","fields":BASE|{"task_date":"bad"}},
    {"action":"bulk_delete"},
])
def test_invalid_injection_no_mutation(client,user,ai,output):
    ai(output)
    assert send(client).status_code==502
    assert client.get('/api/tasks').json()['data']==[]


def test_owner_id_no_match_and_unsupported(client,user,ai):
    ai({"action":"delete_task","task_id":999},{"action":"unsupported"})
    first=send(client).json()['data']
    assert first['type']=='clarification'
    second=send(client).json()['data']
    assert second['action']=='unsupported' and not second['mutated']


@pytest.mark.parametrize('action',['create_task','update_task','delete_task','complete_task'])
def test_dry_run_is_read_only(client,user,ai,action):
    task=create(client,TIMED)
    settings=get_settings();before=settings.chat_execution_enabled;settings.chat_execution_enabled=False
    try:
        ai({"action":action,"task_id":task['id'],"fields":BASE|{"title":"Dry run"}})
        r=send(client)
        assert r.status_code==200 and r.json()['data']['type']=='draft' and not r.json()['data']['mutated']
        assert client.get('/api/tasks').json()['data']==[task]
    finally:settings.chat_execution_enabled=before


def test_concurrent_confirm_consumes_once(engine,client,user,ai):
    task=create(client)
    ai({"action":"delete_task","task_id":task['id']})
    pending=send(client).json()['data'];uid=user['id'];barrier=Barrier(2)
    def worker():
        with Session(engine,expire_on_commit=False) as db:
            barrier.wait()
            try:
                result=chat_service.confirm(db,uid,Confirmation(context_id=pending['context_id'],decision='confirm'))
                return 200 if result['mutated'] else 0
            except AppError as exc:return exc.status
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses=list(pool.map(lambda _:worker(),range(2)))
    assert sorted(statuses)==[200,409] and client.get('/api/tasks').json()['data']==[]


def test_provider_errors_manual_task_remains(client,user,ai):
    for status,code in [(429,'AI_RATE_LIMITED'),(503,'AI_UNAVAILABLE'),(502,'AI_INVALID_OUTPUT')]:
        ai(AppError(status,code,'Safe message'))
        r=send(client)
        assert r.status_code==status and r.json()['error']['code']==code
    create(client)
    assert len(client.get('/api/tasks').json()['data'])==1


def test_prompt_date_and_no_secrets():
    import json
    from datetime import datetime
    from zoneinfo import ZoneInfo
    p=json.loads(prompt_data('ngày mai',['Học tập'],{}))
    assert p['current_date']==datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).date().isoformat()
    assert p['timezone']=='Asia/Ho_Chi_Minh' and not any(k in p for k in ('password','token','api_key'))


def test_changed_intent_does_not_inherit_previous_target(client,user,ai):
    task=create(client)
    ai({"action":"update_task","task_id":task['id']},
       {"action":"create_task","fields":BASE|{"title":"Fresh intent"}})
    old=send(client).json()['data']
    assert old['type']=='clarification' and old['missing_fields']==['changes']
    new=send(client,context_id=old['context_id']).json()['data']
    assert new['mutated'] and new['task']['id']!=task['id']
    assert client.get(f'/api/tasks/{task["id"]}').json()['data']['title']==task['title']


def test_restart_and_deleted_target_never_execute(client,user,ai):
    task=create(client)
    ai({"action":"delete_task","task_id":task['id']},
       {"action":"delete_task","task_id":task['id']})
    pending=send(client).json()['data']
    store.flows.clear()  # Simulates a process restart: no client state can reconstruct it.
    assert confirm(client,pending).json()['error']['code']=='CONTEXT_EXPIRED'
    assert client.get(f'/api/tasks/{task["id"]}').status_code==200
    pending=send(client).json()['data']
    assert client.delete(f'/api/tasks/{task["id"]}').status_code==204
    assert confirm(client,pending).json()['error']['code']=='TASK_CHANGED'
    assert confirm(client,pending).json()['error']['code']=='CONTEXT_EXPIRED'


def test_provider_wait_has_no_database_transaction(engine,user):
    with Session(engine,expire_on_commit=False) as db:
        class Provider:
            def parse(self,message,categories,draft):
                assert not db.in_transaction()
                return {"action":"get_tasks"}
        result=chat_service.handle(db,user['id'],ChatRequest(message='Danh sách'),Provider())
        assert result['tasks']==[] and not result['mutated']


def test_changed_conflict_requires_new_confirmation(client,user,ai):
    task=create(client,TIMED)
    ai({"action":"create_task","fields":TIMED|{"title":"New"}})
    pending=send(client).json()['data']
    assert client.put(f'/api/tasks/{task["id"]}',json=TIMED|{"title":"Changed blocker"}).status_code==200
    changed=confirm(client,pending).json()['data']
    assert changed['type']=='conflict' and not changed['mutated']
    assert changed['conflicting_tasks'][0]['title']=='Changed blocker'
    assert len(client.get('/api/tasks').json()['data'])==1
    assert confirm(client,changed).json()['data']['mutated']


@pytest.mark.parametrize('extra',[{'action':'delete_task'},{'task_id':999},{'allow_conflict':True}])
def test_confirmation_cannot_supply_action_or_override(client,user,ai,extra):
    task=create(client)
    ai({'action':'delete_task','task_id':task['id']})
    pending=send(client).json()['data']
    assert client.post('/api/chat/confirm',json={'context_id':pending['context_id'],'decision':'confirm',**extra}).status_code==422
    assert client.get(f'/api/tasks/{task["id"]}').status_code==200
    assert confirm(client,pending,'cancel').json()['data']['mutated'] is False


def test_ai_foreign_id_does_not_disclose_or_mutate(client,user,ai):
    task=create(client,BASE|{'title':'Private A title'})
    client.post('/api/auth/register',json={'name':'B','email':'b@example.com','password':'other-pass-123'})
    client.post('/api/auth/login',json={'email':'b@example.com','password':'other-pass-123'})
    ai({'action':'delete_task','task_id':task['id']})
    r=send(client)
    assert r.status_code==200 and r.json()['data']['type']=='clarification'
    assert 'Private A title' not in r.text and not r.json()['data']['mutated']
    assert client.get('/api/tasks').json()['data']==[]
    client.post('/api/auth/login',json={'email':user['email'],'password':'test-pass-123'})
    assert client.get(f'/api/tasks/{task["id"]}').status_code==200
