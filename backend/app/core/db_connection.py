"""Connection options shared by the application and Alembic."""
import ssl

from app.core.config import settings


def database_connect_args() -> dict:
    # Verify both the CA chain and hostname; never use an unverified SSL context.
    return {"ssl": ssl.create_default_context()} if settings.DATABASE_SSL else {}
