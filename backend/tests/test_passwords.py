"""Real Passlib/pyca bcrypt compatibility; no mocks, real user passwords or AI."""
import bcrypt
import pytest
from passlib.context import CryptContext
from passlib.hash import bcrypt as passlib_bcrypt
from sqlalchemy.orm import Session

from app.core.security import hash_password, password_context, verify_password
from app.models import User


def test_password_context_uses_bcrypt_only():
    assert isinstance(password_context, CryptContext)
    assert password_context.schemes() == ("bcrypt",)
    assert passlib_bcrypt.get_backend() == "bcrypt"


@pytest.mark.parametrize("password", [
    "ordinary-pass-123", "Mật-khẩu-tiếng-Việt-123", "  keep spaces  ", "a" * 72, "ắ" * 24,
])
def test_new_passlib_hash_has_same_format_cost_and_random_salt(password):
    first, second = hash_password(password), hash_password(password)
    assert first.startswith("$2b$12$") and len(first) == 60
    assert first != second
    assert password_context.verify(password, first)
    assert bcrypt.checkpw(password.encode("utf-8"), first.encode("ascii"))
    assert verify_password(password, first)
    assert not verify_password("wrong-password", first)


@pytest.mark.parametrize("password", [
    "legacy-pass-123", "Mật-khẩu-cũ-123", "  preserve spaces  ", "a" * 72, "ắ" * 24,
    "legacy\x00password",
])
def test_existing_direct_bcrypt_hashes_still_verify(password):
    # Cost 4 keeps legacy test fixtures fast; new application hashes use cost 12.
    legacy = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=4)).decode("ascii")
    assert verify_password(password, legacy)
    assert not verify_password("wrong-password", legacy)


def test_nul_compatibility_does_not_strip_or_truncate_password():
    password = "legacy\x00password"
    encoded = hash_password(password)
    assert encoded.startswith("$2b$12$")
    assert bcrypt.checkpw(password.encode("utf-8"), encoded.encode("ascii"))
    assert verify_password(password, encoded)
    assert not verify_password("legacy", encoded)
    assert not verify_password("legacypassword", encoded)
    assert not verify_password("legacy\x00different", encoded)


@pytest.mark.parametrize("password", ["a" * 73, "ắ" * 25, "a" * 71 + "\x00x"])
def test_hash_rejects_more_than_72_bytes_including_nul_path(password):
    with pytest.raises(ValueError):
        hash_password(password)


def test_verify_rejects_long_password_instead_of_accepting_truncated_prefix():
    prefix = "a" * 72
    legacy = bcrypt.hashpw(prefix.encode(), bcrypt.gensalt(rounds=4)).decode()
    assert verify_password(prefix, legacy)
    assert not verify_password(prefix + "different", legacy)
    assert not verify_password(prefix + "\x00", legacy)


@pytest.mark.parametrize("stored", [None, "", "not-a-hash", "$2b$12$broken", "ắ", 123])
def test_invalid_stored_hash_returns_false(stored):
    assert not verify_password("ordinary-pass-123", stored)
    assert not verify_password("legacy\x00password", stored)


@pytest.mark.parametrize("password", [None, 123, "\ud800"])
def test_invalid_password_returns_false(password):
    assert not verify_password(password, "not-a-hash")


@pytest.mark.parametrize("password", ["legacy-pass-123", "ắ" * 24, "legacy\x00password"])
def test_old_account_can_login_reload_logout_without_rewriting_hash(client, engine, password):
    legacy = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=4)).decode("ascii")
    with Session(engine) as db:
        account = User(name="Legacy QA", email="legacy-qa@example.com", password=legacy)
        db.add(account)
        db.commit()
        account_id = account.id
    response = client.post("/api/auth/login", json={"email": "legacy-qa@example.com", "password": password})
    assert response.status_code == 200
    assert "password" not in response.json()["data"]
    assert client.get("/api/auth/me").json()["data"]["id"] == account_id
    with Session(engine) as db:
        assert db.get(User, account_id).password == legacy
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_registration_with_nul_stays_compatible(client):
    password = "test\x00password"
    response = client.post("/api/auth/register", json={
        "name": "NUL QA", "email": "nul-qa@example.com", "password": password,
    })
    assert response.status_code == 201
    assert client.post("/api/auth/login", json={"email": "nul-qa@example.com", "password": password}).status_code == 200
