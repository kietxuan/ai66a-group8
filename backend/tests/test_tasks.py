from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.schemas.tasks import TaskPayload
from app.services.task_service import execute

BASE = {"title": "Học React", "task_date": "2026-10-05"}
TIMED = BASE | {"start_time": "09:00", "end_time": "10:00"}


def create(client, data=BASE):
    r = client.post("/api/tasks", json=data)
    assert r.status_code == 201, r.text
    return r.json()["data"]


def test_categories_crud_filters_put_status(client, user):
    cats = client.get("/api/categories").json()["data"]
    assert [c["name"] for c in cats] == ["Học tập", "Công việc", "Cá nhân"]
    task = create(client, TIMED | {"description": "Ôn hooks", "priority": "high", "category_id": cats[0]["id"]})
    assert task["start_time"] == "09:00" and "user_id" not in task
    for params in ({"search":"HOOKS"}, {"date_from":"2026-10-05","date_to":"2026-10-05","priority":"high","category_id":cats[0]["id"]}):
        assert len(client.get("/api/tasks", params=params).json()["data"]) == 1
    assert client.get("/api/tasks", params={"status":"completed"}).json()["data"] == []
    id = task["id"]
    done = client.patch(f"/api/tasks/{id}/status", json={"status":"completed"}).json()["data"]
    same = client.patch(f"/api/tasks/{id}/status", json={"status":"completed"}).json()["data"]
    assert same["updated_at"] == done["updated_at"]
    put = client.put(f"/api/tasks/{id}", json=BASE).json()["data"]
    assert put["status"] == "completed" and put["start_time"] is None and put["category_id"] is None and put["priority"] == "medium"
    assert client.delete(f"/api/tasks/{id}").status_code == 204
    assert client.get(f"/api/tasks/{id}").status_code == 404


@pytest.mark.parametrize("delta", [
    {"title":" "}, {"task_date":"2026-02-30"}, {"task_date":"2026-1-01"},
    {"start_time":"09:00"}, {"start_time":"09:00","end_time":"09:00"},
    {"start_time":"23:00","end_time":"24:00"}, {"start_time":"09:00:00","end_time":"10:00"},
    {"priority":"urgent"}, {"user_id":2}, {"allow_conflict":"true"}, {"category_id":True},
])
def test_invalid_task(client, user, delta):
    assert client.post("/api/tasks", json=BASE | delta).status_code == 422
    assert client.get("/api/tasks").json()["data"] == []


@pytest.mark.parametrize("params", [{"task_date":"2026-10-05","date_from":"2026-10-01"},
    {"date_from":"2026-10-06","date_to":"2026-10-05"}, {"search":"a"*201}, {"status":"bad"}, {"user_id":1}])
def test_bad_filters(client, user, params):
    assert client.get("/api/tasks", params=params).status_code == 422


def test_isolation(client, user):
    task = create(client)
    category = client.get("/api/categories").json()["data"][0]["id"]
    client.post("/api/auth/register", json={"name":"Other","email":"other@example.com","password":"other-pass-123"})
    client.post("/api/auth/login", json={"email":"other@example.com","password":"other-pass-123"})
    assert client.get("/api/tasks").json()["data"] == []
    url = f'/api/tasks/{task["id"]}'
    for r in (client.get(url), client.put(url,json=BASE),client.delete(url),client.patch(url+'/status',json={"status":"completed"})):
        assert r.status_code == 404 and task["title"] not in r.text
    assert client.post("/api/tasks",json=BASE|{"category_id":category,"allow_conflict":True}).status_code == 404
    assert client.get("/api/tasks",params={"category_id":category}).status_code == 404


@pytest.mark.parametrize("start,end", [("09:30","10:30"),("08:00","11:00"),("09:00","10:00"),("09:15","09:45")])
def test_overlap_rollback_override(client, user, start, end):
    create(client,TIMED)
    payload=BASE|{"title":"Second","start_time":start,"end_time":end}
    r=client.post("/api/tasks",json=payload)
    assert r.status_code == 409 and r.json()["error"]["code"] == "TASK_CONFLICT"
    assert len(client.get("/api/tasks").json()["data"]) == 1
    create(client,payload|{"allow_conflict":True})


def test_adjacent_all_day_completed_reopen_self_title(client, user):
    a=create(client,TIMED)
    create(client,BASE)
    create(client,BASE|{"start_time":"10:00","end_time":"11:00"})
    assert client.put(f'/api/tasks/{a["id"]}',json=TIMED).status_code == 200
    client.patch(f'/api/tasks/{a["id"]}/status',json={"status":"completed"})
    b=create(client,TIMED)
    assert client.patch(f'/api/tasks/{a["id"]}/status',json={"status":"pending"}).status_code == 409
    assert client.patch(f'/api/tasks/{a["id"]}/status',json={"status":"pending","allow_conflict":True}).status_code == 200
    # Title-only edit of previously accepted overlap does not ask again.
    assert client.put(f'/api/tasks/{b["id"]}',json=TIMED|{"title":"Renamed"}).status_code == 200
    assert client.put(f'/api/tasks/{b["id"]}',json=TIMED|{"start_time":"09:30","end_time":"10:30"}).status_code == 409


def test_concurrent_schedule_writes(engine, client, user):
    barrier=Barrier(2)
    uid=user["id"]
    def worker():
        with Session(engine,expire_on_commit=False) as db:
            barrier.wait()
            try:
                execute(db,uid,"create_task",TaskPayload(**TIMED))
                return 201
            except AppError as error:
                return error.status
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:worker(),range(2)))
    assert sorted(results) == [201,409]
    assert len(client.get("/api/tasks").json()["data"]) == 1
