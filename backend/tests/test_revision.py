from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.revision import require_current_revision


def test_stale_revision_rejected_and_current_revision_accepted():
    created = datetime(2026, 11, 3, 8, 0, tzinfo=timezone.utc)
    updated = created + timedelta(microseconds=7)
    item = SimpleNamespace(created_at=created, updated_at=updated)

    require_current_revision(item, updated.isoformat())
    with pytest.raises(HTTPException) as error:
        require_current_revision(item, created.isoformat())
    assert error.value.status_code == 409


def test_new_row_uses_created_at_revision():
    created = datetime(2026, 11, 3, 8, 0, tzinfo=timezone.utc)
    item = SimpleNamespace(created_at=created, updated_at=None)
    require_current_revision(item, created.isoformat().replace('+00:00', 'Z'))
