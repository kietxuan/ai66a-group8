import json

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.services.ai_provider import ENDPOINT, GroqProvider, normalize_output, provider_schema


def wire(**changes):
    return {"action": "create_task", "task_id": None, "task_query": None,
            "reference": None,
            "fields": [{"name": "title", "value": "Test"}, {"name": "task_date", "value": "2026-10-21"}],
            "filters": [], "availability": [], "missing_fields": [], **changes}


def reply(content=None, finish="stop", **changes):
    return {"choices": [{"finish_reason": finish, "message": {
        "content": json.dumps(wire()) if content is None else content, **changes}}]}


def provider(monkeypatch, handler):
    monkeypatch.setattr(get_settings(), "groq_api_key", SecretStr("fake-credential-not-real"))
    return GroqProvider(httpx.MockTransport(handler))


def test_strict_schema_all_properties_required_and_closed():
    def check(value):
        if isinstance(value, dict):
            if value.get("type") == "object":
                assert value["additionalProperties"] is False
                assert set(value["required"]) == set(value["properties"])
            for child in value.values():
                check(child)
        elif isinstance(value, list):
            for child in value:
                check(child)
    check(provider_schema())


def test_real_httpx_request_serialization_without_network(monkeypatch):
    requests = []
    def handler(request):
        requests.append(request)
        return httpx.Response(200, json=reply())
    action = provider(monkeypatch, handler).parse("Tạo Test", ["Học tập"], {})
    assert action.action == "create_task" and str(action.fields.task_date) == "2026-10-21"
    assert len(requests) == 1 and str(requests[0].url) == ENDPOINT
    assert requests[0].headers["authorization"] == "Bearer fake-credential-not-real"
    data = json.loads(requests[0].content)
    assert data["model"] == "openai/gpt-oss-20b"
    assert data["response_format"]["type"] == "json_schema"
    assert data["response_format"]["json_schema"]["strict"] is True
    assert data["reasoning_effort"] == "low" and data["include_reasoning"] is False
    assert data["max_completion_tokens"] == get_settings().ai_max_completion_tokens
    assert not data["stream"] and "tools" not in data
    assert "fake-credential" not in json.dumps(data)


def test_sparse_fields_preserve_absent_vs_explicit_null():
    action = normalize_output(json.dumps(wire(action="update_task", task_query="Old",
        fields=[{"name": "title", "value": "New"}, {"name": "description", "value": None}])))
    assert action.fields.model_dump(exclude_unset=True) == {"title": "New", "description": None}
    assert "task_id" not in action.model_fields_set
    assert "start_time" not in action.fields.model_fields_set
    cleared = normalize_output(json.dumps(wire(action="update_task", fields=[
        {"name": "start_time", "value": None}, {"name": "end_time", "value": None}])))
    assert cleared.fields.model_dump(exclude_unset=True) == {"start_time": None, "end_time": None}


def test_filters_are_normalized_not_mutation_fields():
    action = normalize_output(json.dumps(wire(action="get_tasks", fields=[], filters=[
        {"name": "task_date", "value": "2026-10-21"}, {"name": "status", "value": "pending"},
        {"name": "category_name", "value": "Học tập"}])))
    assert action.filters.status == "pending" and action.filters.category_name == "Học tập"
    assert action.fields.model_dump(exclude_unset=True) == {}


def test_availability_wire_normalizes_separate_duration_without_task_edits():
    action = normalize_output(json.dumps(wire(action="suggest_free_slots", fields=[], availability=[
        {"name": "task_date", "value": "2099-10-22"}, {"name": "duration_minutes", "value": "90"},
        {"name": "start_time", "value": "08:00"}, {"name": "end_time", "value": "18:00"}])))
    assert action.availability.duration_minutes == 90
    assert action.fields.model_dump(exclude_unset=True) == {} and action.filters.model_dump(exclude_unset=True) == {}


@pytest.mark.parametrize("value", ["true", "1.5", "0", "1440", "-5", "90 phút"])
def test_invalid_availability_duration_rejected(value):
    with pytest.raises(ValueError):
        normalize_output(json.dumps(wire(action="suggest_free_slots", fields=[], availability=[{"name": "duration_minutes", "value": value}])))


def test_availability_cannot_be_mixed_with_mutation_or_duplicate_criteria():
    for output in [wire(availability=[{"name": "duration_minutes", "value": "90"}]),
        wire(action="suggest_free_slots", availability=[]),
        wire(action="suggest_free_slots", fields=[], task_id=1),
        wire(action="suggest_free_slots", fields=[], availability=[{"name": "duration_minutes", "value": "60"}, {"name": "duration_minutes", "value": "90"}])]:
        with pytest.raises(ValueError):
            normalize_output(json.dumps(output))


def test_availability_reference_is_closed_and_cannot_be_used_for_task_mutation():
    output=wire(action="suggest_free_slots", fields=[], reference="last_availability",
        availability=[{"name":"duration_minutes","value":"30"}])
    parsed=normalize_output(json.dumps(output))
    assert parsed.reference=="last_availability" and parsed.availability.duration_minutes==30
    with pytest.raises(ValueError):
        normalize_output(json.dumps(wire(reference="last_availability")))


@pytest.mark.parametrize("output", [
    wire(fields=[{"name": "title", "value": "A"}, {"name": "title", "value": "B"}]),
    wire(filters=[{"name": "search", "value": "A"}, {"name": "search", "value": "B"}]),
    wire(fields=[{"name": "user_id", "value": "2"}]),
    wire(confirmed=True), wire(allow_conflict=True), wire(task_id=0), wire(task_id=True),
    wire(action="bulk_delete"), wire(fields=[{"name": "task_date", "value": "bad"}]),
    wire(fields=[{"name": "start_time", "value": "09:00:00"}]),
    wire(filters=[{"name": "status", "value": "done"}]),
    wire(filters=[{"name": "task_date", "value": "2026-10-21"}, {"name": "date_from", "value": "2026-10-20"}]),
])
def test_business_validation_not_bypassed_by_wire_schema(monkeypatch, output):
    p = provider(monkeypatch, lambda request: httpx.Response(200, json=reply(json.dumps(output))))
    with pytest.raises(AppError) as exc:
        p.parse("Hello", [], {})
    assert exc.value.code == "AI_INVALID_OUTPUT" and exc.value.status == 502


@pytest.mark.parametrize("status,code,expected", [
    (429, "AI_RATE_LIMITED", 429), (401, "AI_UNAVAILABLE", 503), (403, "AI_UNAVAILABLE", 503),
    (404, "AI_UNAVAILABLE", 503), (500, "AI_UNAVAILABLE", 503),
    (400, "AI_INVALID_OUTPUT", 502), (422, "AI_INVALID_OUTPUT", 502),
    (302, "AI_UNAVAILABLE", 503),
])
def test_status_errors_sanitized_no_retry_or_redirect(monkeypatch, status, code, expected):
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(status, headers={"retry-after": "12", "location": "https://untrusted.invalid"},
                              json={"error": {"message": "private credential fake-credential-not-real"}})
    with pytest.raises(AppError) as exc:
        provider(monkeypatch, handler).parse("Hello", [], {})
    assert exc.value.status == expected and exc.value.code == code and len(calls) == 1
    assert "private" not in exc.value.message and "fake-credential" not in str(exc.value.details)
    assert exc.value.details == ({"retry_after_seconds": 12} if status == 429 else {})


@pytest.mark.parametrize("delay", ["", "invalid", "inf", "nan", "-1", "1000000"])
def test_untrusted_retry_after_not_exposed(monkeypatch, delay):
    p = provider(monkeypatch, lambda request: httpx.Response(429, headers={"retry-after": delay}))
    with pytest.raises(AppError) as exc:
        p.parse("Hello", [], {})
    assert exc.value.code == "AI_RATE_LIMITED" and exc.value.details == {}


@pytest.mark.parametrize("failure", [httpx.ReadTimeout("private key"), httpx.ConnectError("private key")])
def test_transport_errors_no_retry(monkeypatch, failure):
    calls = []
    def handler(request):
        calls.append(request)
        raise failure
    with pytest.raises(AppError) as exc:
        provider(monkeypatch, handler).parse("Hello", [], {})
    assert exc.value.code == "AI_UNAVAILABLE" and len(calls) == 1 and "private" not in exc.value.message


@pytest.mark.parametrize("body", [
    {}, {"choices": []}, {"choices": [None]}, {"choices": [{"message": []}]},
    reply("not JSON"), reply("{}"), reply(finish="length"),
    reply(refusal="blocked"), reply(tool_calls=[{"name": "delete"}]),
    reply(content={"action": "create_task"}),
    reply('{"action":"create_task","action":"delete_task"}'),
    reply("x" * 66000),
])
def test_incomplete_or_untrusted_provider_response_never_accepted(monkeypatch, body):
    with pytest.raises(AppError) as exc:
        provider(monkeypatch, lambda request: httpx.Response(200, json=body)).parse("Hello", [], {})
    assert exc.value.status == 502 and exc.value.code == "AI_INVALID_OUTPUT"


def test_no_key_never_opens_network(monkeypatch):
    monkeypatch.setattr(get_settings(), "groq_api_key", SecretStr(""))
    def forbidden(request):
        pytest.fail("No network request expected without key")
    with pytest.raises(AppError) as exc:
        GroqProvider(httpx.MockTransport(forbidden)).parse("Hello", [], {})
    assert exc.value.code == "AI_UNAVAILABLE"


def test_key_masked_and_model_default():
    settings = Settings(_env_file=None, database_url="postgresql+psycopg://test@localhost/dev",
        jwt_secret_key="test-only-long-random-configuration-secret", groq_api_key="private-key")
    assert "private-key" not in repr(settings) and "private-key" not in settings.model_dump_json()
    assert settings.groq_model == "openai/gpt-oss-20b"
