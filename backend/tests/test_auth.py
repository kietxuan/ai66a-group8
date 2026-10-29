from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import User


def test_auth_cookie_hash_reload_logout(client, engine):
    payload = {"name": "  An  ", "email": " AN@example.com ", "password": "strong-pass-123"}
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 201 and r.json()["data"]["name"] == "An"
    assert "access_token" not in client.cookies
    with Session(engine) as db:
        u = db.scalar(select(User))
        assert u.password.startswith("$2b$") and u.password != payload["password"]
    assert client.post("/api/auth/register", json=payload).status_code == 409
    r = client.post("/api/auth/login", json={"email": "an@example.com", "password": payload["password"]})
    assert r.status_code == 200
    cookie = r.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/" in cookie
    assert "Secure" not in cookie and "token" not in r.json()["data"]
    assert client.get("/api/auth/me").json()["data"]["email"] == "an@example.com"
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize("changes", [{"name": " "}, {"email": "bad"}, {"password": "short"},
    {"password": "ắ" * 25}, {"user_id": 1}])
def test_validation_no_password_echo(client, changes):
    p = {"name": "An", "email": "an@example.com", "password": "secret-pass-123"} | changes
    r = client.post("/api/auth/register", json=p)
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "secret-pass-123" not in r.text


def test_csrf_json_preflight(client):
    p = {"email": "test@example.com", "password": "test-pass-123"}
    assert client.post("/api/auth/login", json=p, headers={"X-Requested-With": "wrong"}).status_code == 403
    assert client.post("/api/auth/login", json=p, headers={"Origin": "https://evil.test"}).status_code == 403
    assert client.post("/api/auth/login", content="hello", headers={"Content-Type": "text/plain"}).status_code == 415
    r = client.options("/api/auth/login", headers={"Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "X-Requested-With,Content-Type"})
    assert r.status_code == 200 and r.headers["access-control-allow-credentials"] == "true"


def test_invalid_expired_tampered_token(client, user):
    now = datetime.now(timezone.utc)
    token = jwt.encode({"sub": str(user["id"]), "iat": now - timedelta(hours=2), "exp": now - timedelta(hours=1)},
                       get_settings().jwt_secret_key, algorithm="HS256")
    client.cookies.clear()
    for value in ("bad", token, token + "tampered"):
        client.cookies.set("access_token", value)
        assert client.get("/api/auth/me").status_code == 401


def test_generic_credentials(client, user):
    a = client.post("/api/auth/login", json={"email": "missing@example.com", "password": "wrong-pass-123"})
    b = client.post("/api/auth/login", json={"email": user["email"], "password": "wrong-pass-123"})
    assert a.status_code == b.status_code == 401 and a.json() == b.json()


def test_algorithm_and_deleted_user_rejected(client,user,engine):
    now=datetime.now(timezone.utc)
    token=jwt.encode({"sub":str(user['id']),"iat":now,"exp":now+timedelta(hours=1)},
                     get_settings().jwt_secret_key,algorithm='HS384')
    original=client.cookies.get('access_token')
    client.cookies.clear();client.cookies.set('access_token',token)
    assert client.get('/api/auth/me').status_code==401
    client.cookies.clear();client.cookies.set('access_token',original)
    with Session(engine) as db:
        db.delete(db.get(User,user['id']));db.commit()
    assert client.get('/api/auth/me').status_code==401


def test_secure_cookie_attributes(client,user):
    settings=get_settings();before=settings.cookie_secure;settings.cookie_secure=True
    try:
        r=client.post('/api/auth/login',json={'email':user['email'],'password':'test-pass-123'})
        assert 'Secure' in r.headers['set-cookie'] and 'HttpOnly' in r.headers['set-cookie']
        # TestClient's HTTP cookie jar correctly will NOT deliver Secure cookies.
        # Explicit test request models authenticated HTTPS delivery for flag inspection.
        token=r.cookies.get('access_token')
        r=client.post('/api/auth/logout',headers={'Cookie':f'access_token={token}'})
        assert r.status_code==204
        assert 'Secure' in r.headers['set-cookie'] and 'Max-Age=0' in r.headers['set-cookie']
    finally:settings.cookie_secure=before


def test_unique_email_race_has_one_user_and_three_categories(engine):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from sqlalchemy import func
    from app.core.errors import AppError
    from app.models import Category
    from app.schemas.auth import Register
    from app.services.auth_service import register
    barrier=Barrier(2)
    def attempt():
        with Session(engine,expire_on_commit=False) as db:
            barrier.wait()
            try:
                register(db,Register(name='Race',email='race@example.com',password='race-pass-123'))
                return 201
            except AppError as exc:return exc.status
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(lambda _:attempt(),range(2)))==[201,409]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(User))==1
        assert db.scalar(select(func.count()).select_from(Category))==3
