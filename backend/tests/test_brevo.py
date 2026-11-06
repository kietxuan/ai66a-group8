import asyncio
import json
from unittest.mock import AsyncMock

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.helper import otp


@pytest.fixture
def brevo(monkeypatch):
    monkeypatch.setattr(settings, "MAIL_PROVIDER", "brevo")
    monkeypatch.setattr(settings, "BREVO_API_KEY", "qa-private-key")
    monkeypatch.setattr(settings, "MAIL_FROM_EMAIL", "sender@example.com")
    monkeypatch.setattr(settings, "MAIL_FROM_NAME", "Planify QA")
    smtp = AsyncMock(side_effect=AssertionError("Brevo must never fall back to SMTP"))
    monkeypatch.setattr(otp, "_send_email_sync", smtp)
    return monkeypatch


def transport(monkeypatch, handler):
    real_client = httpx.AsyncClient
    monkeypatch.setattr(otp.httpx, "AsyncClient", lambda **kwargs: real_client(
        transport=httpx.MockTransport(handler), **kwargs))


def test_otp_and_reminder_use_brevo(brevo):
    requests = []

    def handler(request):
        requests.append(request)
        assert request.url == "https://api.brevo.com/v3/smtp/email"
        assert request.headers["api-key"] == "qa-private-key"
        assert request.extensions["timeout"]["connect"] == 5.0
        return httpx.Response(201, json={"messageId": "qa-message-id"})

    transport(brevo, handler)
    assert asyncio.run(otp.send_email("recipient@example.com", "123456"))
    assert asyncio.run(otp.send_reminder_email("recipient@example.com", "QA", "Test task", "09:00"))
    assert len(requests) == 2
    payload = json.loads(requests[0].content)
    assert payload["sender"] == {"name": "Planify QA", "email": "sender@example.com"}
    assert payload["to"] == [{"email": "recipient@example.com"}]
    assert "123456" in payload["htmlContent"]


@pytest.mark.parametrize("status", [400, 401, 403, 429, 500, 503])
def test_provider_errors_are_not_retried_or_logged_with_sensitive_body(brevo, caplog, status):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(status, text="qa-private-key recipient@example.com 123456")

    transport(brevo, handler)
    assert not asyncio.run(otp.send_email("recipient@example.com", "123456"))
    assert len(calls) == 1
    assert "qa-private-key" not in caplog.text
    assert "123456" not in caplog.text


@pytest.mark.parametrize("body", ['not-json', '{}', '[]', 'null', '{"messageId":null}', '{"messageId":""}'])
def test_invalid_acknowledgement_is_not_success(brevo, body):
    transport(brevo, lambda request: httpx.Response(201, text=body))
    assert not asyncio.run(otp.send_email("recipient@example.com", "123456"))


def test_timeout_is_not_retried(brevo):
    calls = []

    def handler(request):
        calls.append(request)
        raise httpx.ReadTimeout("ambiguous send", request=request)

    transport(brevo, handler)
    assert not asyncio.run(otp.send_email("recipient@example.com", "123456"))
    assert len(calls) == 1


@pytest.mark.parametrize("field", ["BREVO_API_KEY", "MAIL_FROM_EMAIL"])
def test_missing_config_does_not_call_network(brevo, field):
    brevo.setattr(settings, field, "")
    transport(brevo, lambda request: pytest.fail("Network should not be called"))
    assert not asyncio.run(otp.send_email("recipient@example.com", "123456"))


def test_unknown_provider_fails_configuration_validation():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, MAIL_PROVIDER="invalid-provider")
