"""Exercise release migrations on disposable PostgreSQL databases, never Neon."""
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio

ROOT = Path(__file__).resolve().parents[1]


@pytest_asyncio.fixture
async def migration_db():
    raw = os.getenv("REMINDER_TEST_DATABASE_URL")
    if not raw:
        pytest.skip("Dedicated reminder QA database not configured")
    parts = urlsplit(raw.replace("postgresql+asyncpg://", "postgresql://", 1))
    assert parts.hostname == "planify-reminder-db", "Only the dedicated QA host is allowed"
    name = "qa_compat_" + uuid4().hex
    admin = await asyncpg.connect(urlunsplit(parts))
    await admin.execute(f'CREATE DATABASE "{name}"')
    dsn = urlunsplit(parts._replace(path="/" + name))
    conn = await asyncpg.connect(dsn)
    try:
        yield conn, dsn
    finally:
        await conn.close()
        # A literal generated database name, not a user's database or schema.
        assert name.startswith("qa_compat_") and name[10:].isalnum()
        await admin.execute(f'DROP DATABASE "{name}" WITH (FORCE)')
        await admin.close()


def migrate(dsn, command, target, *, success=True):
    env = {**os.environ, "DATABASE_URL": dsn.replace("postgresql://", "postgresql+asyncpg://", 1), "DATABASE_SSL": "false"}
    result = subprocess.run([sys.executable, "-m", "alembic", command, target], cwd=ROOT, env=env,
                            capture_output=True, text=True, timeout=45)
    if success:
        assert result.returncode == 0, result.stdout + result.stderr
    else:
        assert result.returncode != 0


async def seed(conn):
    user = await conn.fetchval("""INSERT INTO users
        (email,nickname,password_hashed,is_activate,is_developer,theme_preference,timezone,notify_enabled,notify_minutes_before)
        VALUES ('migration@example.com','QA','not-a-login',true,false,'light','Asia/Ho_Chi_Minh',true,60) RETURNING id""")
    cal = await conn.fetchval("""INSERT INTO calendars (user_id,name,color,is_default,is_visible)
        VALUES ($1,'QA','#4285F4',true,true) RETURNING id""", user)
    ids = []
    for title in ("explicit", "inherited"):
        ids.append(await conn.fetchval("""INSERT INTO events
            (user_id,calendar_id,title,start_at,end_at,is_all_day,is_exception,is_cancelled)
            VALUES ($1,$2,$3,'2030-01-01T09:00:00+07','2030-01-01T10:00:00+07',false,false,false) RETURNING id""", user, cal, title))
    reminder = await conn.fetchval("""INSERT INTO event_reminders (event_id,minutes_before,is_sent)
        VALUES ($1,30,true) RETURNING id""", ids[0])
    return ids, reminder


@pytest.mark.asyncio
@pytest.mark.parametrize("baseline", ["d3c20261104", "e4d20261114"])
async def test_upgrade_and_f5_roundtrip_preserve_legacy_data(migration_db, baseline):
    conn, dsn = migration_db
    migrate(dsn, "upgrade", "d3c20261104")
    ids, reminder_id = await seed(conn)
    if baseline == "e4d20261114":
        migrate(dsn, "upgrade", baseline)
        assert await conn.fetchval("SELECT count(*) FROM event_reminders WHERE minutes_before IS NULL") == 1
    migrate(dsn, "upgrade", "head")
    assert await conn.fetchval("SELECT version_num FROM alembic_version") == "f5e20261114"
    rows = await conn.fetch("SELECT id,event_id,minutes_before,use_user_default FROM event_reminders ORDER BY event_id")
    assert [(r["event_id"], r["minutes_before"], r["use_user_default"]) for r in rows] == [(ids[0],30,False),(ids[1],60,True)]
    assert rows[0]["id"] == reminder_id
    assert await conn.fetchval("SELECT count(*) FROM event_reminder_deliveries") == 1
    # The OLD response requires an integer; additive flag must not break it.
    from pydantic import BaseModel
    class OldReminder(BaseModel):
        minutes_before: int
    for row in rows:
        OldReminder.model_validate(dict(row))
    migrate(dsn, "downgrade", "e4d20261114")
    assert await conn.fetchval("SELECT count(*) FROM events") == 2
    assert await conn.fetchval("SELECT count(*) FROM event_reminders WHERE minutes_before IS NULL") == 1
    assert await conn.fetchval("SELECT count(*) FROM event_reminder_deliveries") == 1
    migrate(dsn, "upgrade", "head")
    assert [dict(r) for r in await conn.fetch("SELECT id,event_id,minutes_before,use_user_default FROM event_reminders ORDER BY event_id")] == [dict(r) for r in rows]
    assert await conn.fetchval("SELECT count(*) FROM event_reminder_deliveries") == 1


@pytest.mark.asyncio
async def test_failed_batch_never_publishes_intermediate_null_state(migration_db):
    conn, dsn = migration_db
    migrate(dsn, "upgrade", "d3c20261104")
    await seed(conn)
    # Deliberately make f5 fail after e4. Both pending revisions must roll back.
    await conn.execute("ALTER TABLE event_reminders ADD COLUMN use_user_default boolean")
    migrate(dsn, "upgrade", "head", success=False)
    assert await conn.fetchval("SELECT version_num FROM alembic_version") == "d3c20261104"
    assert await conn.fetchval("SELECT to_regclass('event_reminder_deliveries')") is None
    assert await conn.fetchval("SELECT count(*) FROM event_reminders") == 1
    assert await conn.fetchval("SELECT count(*) FROM event_reminders WHERE minutes_before IS NULL") == 0
    assert await conn.fetchval("""SELECT is_nullable FROM information_schema.columns
        WHERE table_name='event_reminders' AND column_name='minutes_before'""") == "NO"
