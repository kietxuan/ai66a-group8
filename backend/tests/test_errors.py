from sqlalchemy.exc import OperationalError

from app.core.database import get_db


def test_database_failure_is_sanitized_json(client):
    def unavailable():
        raise OperationalError('secret SQL password',{'password':'do-not-return'},Exception('private connection'))
        yield  # Make the dependency a generator just like get_db.
    client.app.dependency_overrides[get_db]=unavailable
    r=client.get('/api/auth/me')
    assert r.status_code==503 and r.json()['error']['code']=='DATABASE_UNAVAILABLE'
    assert all(secret not in r.text for secret in ('secret SQL','do-not-return','private connection'))
