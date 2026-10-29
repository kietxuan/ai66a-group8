"""Live HTTP smoke, synthetic accounts only. Does not reset databases.

From root: backend/.venv/Scripts/python.exe scripts/smoke.py
Optional --live-ai performs small real Groq requests through the backend.
"""
import argparse
from contextlib import ExitStack
import json
import secrets
import time
from datetime import datetime,timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

import httpx


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url',default='http://127.0.0.1:8000')
    parser.add_argument('--live-ai',action='store_true')
    parser.add_argument('--ai-interval-seconds',type=float,default=25,
        help='Pace live AI requests for free-tier token limits; never retries a mutation')
    args=parser.parse_args()
    if not 0<=args.ai_interval_seconds<=300:
        parser.error('AI interval must be between 0 and 300 seconds')
    base=args.base_url.rstrip('/')
    if not (base.startswith('https://') or base.startswith(('http://127.0.0.1:','http://localhost:'))):
        parser.error('Use HTTPS online or an explicit localhost URL')
    run=uuid4().hex[:10]
    day=(datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).date()+timedelta(days=1)).isoformat()
    accounts=[]
    checks=[]
    cleanup_errors=[]
    authenticated=[]
    def check(name,condition):
        if not condition:raise AssertionError(name)
        checks.append(name)
        print(json.dumps({'pass':name},ensure_ascii=False),flush=True)
    def cleanup_tasks():
        for client in authenticated:
            try:
                response=client.get('/api/tasks')
                if response.status_code!=200:
                    cleanup_errors.append('Cannot list synthetic tasks for cleanup')
                    continue
                for task in response.json()['data']:
                    if run in task['title'] and client.delete(f'/api/tasks/{task["id"]}').status_code!=204:
                        cleanup_errors.append('Synthetic task cleanup failed')
                if client.post('/api/auth/logout').status_code not in (204,401):
                    cleanup_errors.append('Synthetic logout failed')
            except (httpx.HTTPError,ValueError,KeyError):
                cleanup_errors.append('Synthetic cleanup unavailable')
        if cleanup_errors:
            print(json.dumps({'cleanup_errors':cleanup_errors},ensure_ascii=False),flush=True)
    with httpx.Client(base_url=base,headers={'Origin':base,'X-Requested-With':'todo-app'},timeout=30) as a, \
         httpx.Client(base_url=base,headers={'Origin':base,'X-Requested-With':'todo-app'},timeout=30) as b, ExitStack() as cleanup:
        cleanup.callback(cleanup_tasks)
        for index,client in enumerate((a,b)):
            credentials={'email':f'smoke-{run}-{index}@example.com','password':secrets.token_urlsafe(18)}
            r=client.post('/api/auth/register',json={'name':f'Smoke {index}',**credentials})
            check(f'register {index}',r.status_code==201)
            check(f'no auto login {index}',client.get('/api/auth/me').status_code==401)
            r=client.post('/api/auth/login',json=credentials)
            check(f'login {index}',r.status_code==200 and 'HttpOnly' in r.headers['set-cookie'])
            authenticated.append(client)
            check(f'me {index}',client.get('/api/auth/me').status_code==200)
            accounts.append(credentials)
        cats=a.get('/api/categories').json()['data']
        check('default categories',len(cats)==3)
        payload={'title':f'SMOKE {run}','task_date':day,'start_time':'09:00','end_time':'10:00','category_id':cats[0]['id']}
        task=a.post('/api/tasks',json=payload)
        check('create timed',task.status_code==201)
        id=task.json()['data']['id']
        check('other user cannot read',b.get(f'/api/tasks/{id}').status_code==404)
        check('other user cannot use category',b.post('/api/tasks',json=payload).status_code==404)
        check('conflict rollback',a.post('/api/tasks',json=payload).status_code==409)
        check('range filter',len(a.get('/api/tasks',params={'date_from':day,'date_to':day,'search':run}).json()['data'])==1)
        second=a.post('/api/tasks',json=payload|{'title':f'SMOKE overlap {run}','allow_conflict':True})
        check('explicit override',second.status_code==201)
        sid=second.json()['data']['id']
        check('complete',a.patch(f'/api/tasks/{id}/status',json={'status':'completed'}).status_code==200)
        check('reopen conflict',a.patch(f'/api/tasks/{id}/status',json={'status':'pending'}).status_code==409)
        check('full PUT reset',a.put(f'/api/tasks/{id}',json={'title':f'SMOKE all-day {run}','task_date':day}).json()['data']['start_time'] is None)
        check('missing CSRF header',a.post('/api/tasks',json=payload,headers={'X-Requested-With':'wrong'}).status_code==403)
        if args.live_ai:
            title=f'SMOKE AI {run}'
            last_ai=0
            def pace():
                nonlocal last_ai
                delay=args.ai_interval_seconds-(time.monotonic()-last_ai)
                if delay>0:
                    time.sleep(delay)
                last_ai=time.monotonic()
            def chat(message):
                pace()
                r=a.post('/api/chat',json={'message':message})
                check('AI HTTP result',r.status_code==200)
                data=r.json()['data']
                if data['type']!='result':raise AssertionError(f'Unexpected AI flow: {data["type"]}; inspect provider interpretation manually')
                return data
            created=chat(f'Tạo công việc cả ngày tên chính xác "{title}" vào {day}.')
            check('real AI create',created['mutated'] and created['task']['title']==title)
            aid=created['task']['id']
            check('real AI query',len(chat(f'Tìm công việc có tiêu đề "{title}"')['tasks'])==1)
            check('real AI update',chat(f'Sửa công việc "{title}": thêm ghi chú "Đã kiểm tra AI"')['mutated'])
            check('real AI complete',chat(f'Đánh dấu hoàn thành công việc "{title}"')['mutated'])
            pace()
            deletion=a.post('/api/chat',json={'message':f'Xóa công việc "{title}"'}).json()['data']
            check('real AI delete preview',deletion['type']=='confirmation' and a.get(f'/api/tasks/{aid}').status_code==200)
            confirmed=a.post('/api/chat/confirm',json={'context_id':deletion['context_id'],'decision':'confirm'})
            check('real AI delete confirmed',confirmed.status_code==200 and confirmed.json()['data']['mutated'])
        for tid in (id,sid):
            check('delete test task',a.delete(f'/api/tasks/{tid}').status_code==204)
        check('data still scoped',b.get('/api/tasks').json()['data']==[])
        check('unknown API JSON',a.get('/api/no-such-route').status_code==404 and 'error' in a.get('/api/no-such-route').json())
        check('SPA deep link',a.get('/calendar').status_code==200)
        check('logout',a.post('/api/auth/logout').status_code==204 and a.get('/api/auth/me').status_code==401)
        authenticated.remove(a)
    print(json.dumps({'passed':len(checks),'live_ai':args.live_ai,'checks':checks,'cleanup_errors':cleanup_errors,'note':'Synthetic accounts retained; cleanup attempted only for this run. No database reset.'},ensure_ascii=False,indent=2))
    if cleanup_errors:raise SystemExit(1)


if __name__=='__main__':main()
