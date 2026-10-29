from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request, Response
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.core.errors import AppError
from app.crud.tasks import categories, list_tasks, own_task
from app.schemas.tasks import StatusPayload, TaskFilters, TaskPayload
from app.services.task_service import execute, serialize
from app.schemas.responses import Envelope, CategoryOut, TaskOut

router = APIRouter(prefix="/api", tags=["Tasks"])
PositiveID = Annotated[int, Path(gt=0)]


@router.get("/categories", response_model=Envelope[list[CategoryOut]])
def category_list(user=Depends(current_user), db: Session = Depends(get_db)):
    return {"data": [{"id": c.id, "name": c.name} for c in categories(db, user.id)]}


@router.get("/tasks", response_model=Envelope[list[TaskOut]])
def task_list(request: Request, user=Depends(current_user), db: Session = Depends(get_db)):
    try:
        filters = TaskFilters.model_validate(dict(request.query_params))
    except ValidationError:
        raise AppError(422, "VALIDATION_ERROR", "Bộ lọc ngày/trạng thái không hợp lệ") from None
    return {"data": [serialize(t) for t in list_tasks(db, user.id, filters)]}


@router.get("/tasks/{task_id}", response_model=Envelope[TaskOut])
def task_get(task_id: PositiveID, user=Depends(current_user), db: Session = Depends(get_db)):
    return {"data": serialize(own_task(db, user.id, task_id))}


@router.post("/tasks", status_code=201, response_model=Envelope[TaskOut])
def task_create(payload: TaskPayload, user=Depends(current_user), db: Session = Depends(get_db)):
    return {"data": execute(db, user.id, "create_task", payload)[0]}


@router.put("/tasks/{task_id}", response_model=Envelope[TaskOut])
def task_update(task_id: PositiveID, payload: TaskPayload, user=Depends(current_user), db: Session = Depends(get_db)):
    return {"data": execute(db, user.id, "update_task", payload, task_id, payload.expected_version)[0]}


@router.patch("/tasks/{task_id}/status", response_model=Envelope[TaskOut])
def task_status(task_id: PositiveID, payload: StatusPayload, user=Depends(current_user), db: Session = Depends(get_db)):
    return {"data": execute(db, user.id, "status", payload, task_id, payload.expected_version)[0]}


@router.delete("/tasks/{task_id}", status_code=204)
def task_delete(task_id: PositiveID, expected_version: str | None = Query(default=None, min_length=1, max_length=64), user=Depends(current_user), db: Session = Depends(get_db)):
    execute(db, user.id, "delete_task", task_id=task_id, expected_version=expected_version)
    return Response(status_code=204)
