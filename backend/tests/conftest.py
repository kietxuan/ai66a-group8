import os

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.config import ROOT, get_settings
from app.core.database import get_db


def safe_test_url():
    settings = get_settings()
    url = settings.test_database_url
    if not url:
        raise RuntimeError("TEST_DATABASE_URL is required; use a separate PostgreSQL database ending _test")
    parsed, main = make_url(url), make_url(settings.database_url)
    if (parsed.drivername != "postgresql+psycopg" or not (parsed.database or '').endswith("_test")
            or parsed.database == main.database):
        raise RuntimeError("Refusing reset: test database must be PostgreSQL, end _test and differ from DATABASE_URL")
    return url


@pytest.fixture(scope="session")
def engine():
    url = safe_test_url()
    engine = create_engine(url, pool_pre_ping=True)
    with engine.begin() as conn:
        conn.execute(text('DROP SCHEMA public CASCADE'))
        conn.execute(text('CREATE SCHEMA public'))
    config = Config(str(ROOT / "backend/alembic.ini"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
    yield engine
    engine.dispose()


@pytest.fixture(autouse=True)
def isolate_runtime(monkeypatch, request):
    from pydantic import SecretStr
    # Never consume a developer's real quota from pytest or CI.
    monkeypatch.setattr(get_settings(), "groq_api_key", SecretStr(""))
    monkeypatch.setattr(get_settings(), "rate_limit_enabled", False)
    from app.services.chat_context import store
    store.flows.clear()
    store.memories.clear()
    if "engine" in request.fixturenames:
        request.getfixturevalue("clean")


@pytest.fixture
def clean(engine):
    with engine.begin() as conn:
        # Known test-only database; preserve schema/migration metadata.
        tables = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename!='alembic_version'"))
        names = [row[0] for row in tables]
        if names:
            conn.execute(text('TRUNCATE ' + ', '.join('"' + n + '"' for n in names) + ' RESTART IDENTITY CASCADE'))


@pytest.fixture
def client(engine, clean):
    from main import create_app
    app = create_app()
    def test_db():
        with Session(engine, expire_on_commit=False) as session:
            yield session
    app.dependency_overrides[get_db] = test_db
    with TestClient(app) as client:
        client.headers.update({"X-Requested-With": "todo-app", "Origin": "http://localhost:5173"})
        yield client


@pytest.fixture
def user(client):
    payload = {"name": "Test User", "email": "test@example.com", "password": "test-pass-123"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    assert client.post("/api/auth/login", json={k: payload[k] for k in ("email", "password")}).status_code == 200
    return client.get("/api/auth/me").json()["data"]
