from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import get_settings


@lru_cache
def get_engine():
    settings = get_settings()
    return create_engine(settings.database_url, **engine_options(settings))


def engine_options(settings):
    return {"pool_pre_ping":True,"pool_timeout":5,
        "connect_args":{"connect_timeout":settings.db_connect_timeout,
            "options":f"-c statement_timeout={settings.db_statement_timeout_ms} -c lock_timeout={settings.db_lock_timeout_ms}"}}


def get_db():
    with Session(get_engine(), expire_on_commit=False) as session:
        yield session
