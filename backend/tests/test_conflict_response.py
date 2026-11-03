import asyncio
import json

from fastapi import HTTPException

from app.core.exceptions import http_exception_handler


def test_schedule_conflict_response_preserves_code_message_and_items():
    conflict = {
        "code": "SCHEDULE_CONFLICT",
        "message": "Khung giờ này trùng lịch.",
        "items": [{"type": "task", "id": 8, "title": "Business Analytic"}],
    }

    response = asyncio.run(http_exception_handler(None, HTTPException(409, detail=conflict)))

    assert response.status_code == 409
    assert json.loads(response.body) == {"success": False, "error": conflict}
