import os
import asyncio
import subprocess
import unittest
import uuid
from sqlalchemy.engine import make_url
import asyncpg

class MigrationRegression(unittest.TestCase):
    def test_existing_user_upgrade_startup_columns_and_fresh_schema(self):
        base_url = os.environ.get("TEST_DATABASE_URL", "")
        if not base_url or base_url != os.environ.get("DATABASE_URL") or not make_url(base_url).database.endswith("_test"):
            self.fail("A dedicated TEST_DATABASE_URL is mandatory.")
        name = "planify_migration_" + uuid.uuid4().hex[:12] + "_test"
        admin_url = make_url(base_url).set(drivername="postgresql").render_as_string(hide_password=False)
        target_url = make_url(base_url).set(database=name).render_as_string(hide_password=False)
        target_pg = make_url(target_url).set(drivername="postgresql").render_as_string(hide_password=False)
        env = {**os.environ, "DATABASE_URL": target_url, "TEST_DATABASE_URL": target_url}
        async def sql(url, statement, fetch=False):
            conn = await asyncpg.connect(url)
            try:
                return await conn.fetch(statement) if fetch else await conn.execute(statement)
            finally:
                await conn.close()
        def migrate(revision, direction="upgrade"):
            result = subprocess.run(["alembic", direction, revision], env=env, capture_output=True, text=True, timeout=60)
            self.assertEqual(result.returncode, 0, result.stderr)
        asyncio.run(sql(admin_url, f'CREATE DATABASE "{name}"'))
        try:
            migrate("2ac5599a1353")
            asyncio.run(sql(target_pg, "INSERT INTO users(email,password_hashed,nickname) VALUES ('legacy@example.com','synthetic-test-hash','Legacy')"))
            migrate("fe8fe70309cc")
            # Reproduce the columns that the previous app added outside Alembic.
            asyncio.run(sql(target_pg, "ALTER TABLE users ADD COLUMN notify_enabled BOOLEAN NOT NULL DEFAULT TRUE; ALTER TABLE tasks ADD COLUMN location VARCHAR(300)"))
            migrate("head")
            rows = asyncio.run(sql(target_pg, "SELECT theme_preference,timezone,notify_enabled,token_version FROM users WHERE email='legacy@example.com'", True))
            self.assertEqual(tuple(rows[0]), ("light", "Asia/Ho_Chi_Minh", True, 0))
            migrate("head")
            migrate("base", "downgrade")
            migrate("head")
            columns = asyncio.run(sql(target_pg, "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'", True))
            actual = set(map(tuple, columns))
            from app.core.database import Base
            import app.models
            for table in Base.metadata.sorted_tables:
                for column in table.columns:
                    self.assertIn((table.name, column.name), actual)
        finally:
            # Exactly the UUID-named disposable database created above, never development data.
            asyncio.run(sql(admin_url, f'DROP DATABASE "{name}"'))
