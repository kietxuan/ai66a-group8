"""Regression checks for the single-container deployment contract."""
import ssl
import asyncio
from configparser import ConfigParser
from unittest.mock import MagicMock, patch
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.core.db_connection import database_connect_args
from app.helper import otp
from main import FRONTEND_DIR, app


def test_database_tls_verifies_ca_and_hostname(monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_SSL", True)
    context = database_connect_args()["ssl"]
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname
    monkeypatch.setattr(settings, "DATABASE_SSL", False)
    assert database_connect_args() == {}


def test_pool_limits():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, DATABASE_POOL_SIZE=0)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, DATABASE_MAX_OVERFLOW=-1)


def test_percent_encoded_database_url_survives_alembic_config():
    url = "postgresql+asyncpg://user:p%40ss%25word@host/db"
    config = ConfigParser()
    config.add_section("alembic")
    config.set("alembic", "sqlalchemy.url", url.replace("%", "%%"))
    assert config.get("alembic", "sqlalchemy.url") == url


def test_smtp_is_independent_from_admin(monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAIL", "admin@invalid.local")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "not-the-mail-password")
    monkeypatch.setattr(settings, "SMTP_EMAIL", " sender@gmail.com ")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", " abcd efgh ijkl mnop ")
    assert otp._get_smtp_credentials() == ("sender@gmail.com", "abcdefghijklmnop")
    server = MagicMock()
    with patch.object(otp.smtplib, "SMTP", return_value=server) as smtp:
        assert otp._send_email_sync("qa@invalid.local", "OTP", "<p>QA</p>")
    smtp.assert_called_once_with("smtp.gmail.com", 587, timeout=10.0)
    server.starttls.assert_called_once()
    server.login.assert_called_once_with("sender@gmail.com", "abcdefghijklmnop")
    server.send_message.assert_called_once()
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "")
    with patch.object(otp.smtplib, "SMTP") as smtp:
        assert not otp._send_email_sync("qa@invalid.local", "OTP", "QA")
        smtp.assert_not_called()


def test_frontend_routes_do_not_expose_backend_or_secrets():
    if not FRONTEND_DIR.is_dir():
        pytest.skip("Backend-only image deliberately has no frontend")
    # No lifespan: this test must not touch a real database or Redis.
    client = TestClient(app)
    root = client.get("/")
    assert root.status_code == 200
    assert "text/html" in root.headers["content-type"]
    assert root.headers["cache-control"] == "no-store"
    for path in ("/.env", "/backend/main.py", "/requirements.lock", "/assets/../backend/main.py"):
        assert client.get(path).status_code == 404
    assert client.get("/js/api.js").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_async_smtp_uses_starttls_and_separate_credentials(monkeypatch):
    import aiosmtplib

    monkeypatch.setattr(settings, "SMTP_EMAIL", "sender@gmail.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "abcd efgh ijkl mnop")
    send = AsyncMock()
    with patch.object(aiosmtplib, "send", send):
        assert asyncio.run(otp._send_email_async("qa@example.com", "QA", "<p>QA</p>"))
    assert send.call_args.kwargs["start_tls"] is True
    assert send.call_args.kwargs["port"] == 587
    assert send.call_args.kwargs["password"] == "abcdefghijklmnop"


def test_backend_only_root_keeps_compose_compatibility(monkeypatch, tmp_path):
    import main

    monkeypatch.setattr(main, "FRONTEND_DIR", tmp_path)
    response = TestClient(app).get("/")
    assert response.status_code == 200
    assert response.json() == {"success": f"Welcome to {settings.PROJECT_NAME} API!"}
