import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.core.config import ROOT,get_settings
from conftest import safe_test_url


def test_upgrade_from_users_backfill_and_empty_head(engine):
    config=Config(str(ROOT/'backend/alembic.ini'))
    config.attributes['database_url']=safe_test_url()
    # This is exclusively the verified test database. Restore head in finally.
    try:
        command.downgrade(config,'base')
        command.upgrade(config,'0001_users')
        with engine.begin() as conn:
            conn.execute(text("INSERT INTO users(name,email,password) VALUES ('Old user','old@example.com','test hash')"))
        command.upgrade(config,'head')
        command.upgrade(config,'head')
        with engine.connect() as conn:
            assert conn.execute(text('SELECT count(*) FROM categories')).scalar()==3
            assert conn.execute(text('SELECT count(*) FROM users')).scalar()==1
        command.check(config)
        command.downgrade(config,'base')
        command.upgrade(config,'head')
        with engine.connect() as conn:
            assert conn.execute(text('SELECT version_num FROM alembic_version')).scalar()=='0002_tasks_categories'
    finally:
        command.upgrade(config,'head')


@pytest.mark.parametrize('start,end',[("09:00:01","10:00"),("23:00","24:00"),("09:00",None),("10:00","09:00")])
def test_postgres_constraints_reject_invalid_time(engine,client,user,start,end):
    with pytest.raises(IntegrityError):
        with engine.begin() as conn:
            conn.execute(text("""INSERT INTO tasks(user_id,title,task_date,start_time,end_time)
                VALUES (:uid,'Invalid','2026-10-05',CAST(:start AS time),CAST(:end AS time))"""),
                {'uid':user['id'],'start':start,'end':end})


def test_test_database_guard_rejects_main_and_alias(monkeypatch):
    settings=get_settings()
    for url in (settings.database_url,settings.database_url.replace('127.0.0.1','localhost'),
                'postgresql+psycopg://user@localhost/not_test_database','sqlite:///todo_test.db'):
        monkeypatch.setattr(settings,'test_database_url',url)
        with pytest.raises(RuntimeError):safe_test_url()
