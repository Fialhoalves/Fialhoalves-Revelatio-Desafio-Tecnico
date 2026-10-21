from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.deps import CurrentUser, DbSession
from app.models import TaskStatus
from app.schemas.task import TaskCreate, TaskOut, TaskPage, TaskUpdate
from app.services import tasks as task_service
from app.storage import get_storage
from app.storage.local import LocalStorage

router = APIRouter(prefix="/tasks", tags=["tasks"])

Storage = Annotated[LocalStorage, Depends(get_storage)]


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(data: TaskCreate, db: DbSession, user: CurrentUser):
    return task_service.create_task(db, user, data)


@router.get("", response_model=TaskPage)
def list_tasks(
    db: DbSession,
    user: CurrentUser,
    status_filter: Annotated[TaskStatus | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(description="Busca no título e na descrição")] = None,
    owner_id: Annotated[int | None, Query(description="Filtro por dono (apenas admin)")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """Usuário comum vê apenas as próprias tasks; admin vê todas."""
    items, total = task_service.list_tasks(
        db, user, status_filter=status_filter, q=q, owner_id=owner_id, limit=limit, offset=offset
    )
    return TaskPage(items=items, total=total)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: DbSession, user: CurrentUser):
    return task_service.get_accessible_task(db, user, task_id)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, data: TaskUpdate, db: DbSession, user: CurrentUser):
    task = task_service.get_accessible_task(db, user, task_id)
    return task_service.update_task(db, task, data)


@router.post("/{task_id}/complete", response_model=TaskOut)
def complete_task(task_id: int, db: DbSession, user: CurrentUser):
    task = task_service.get_accessible_task(db, user, task_id)
    return task_service.update_task(db, task, TaskUpdate(status=TaskStatus.DONE))


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: DbSession, user: CurrentUser, storage: Storage):
    task = task_service.get_accessible_task(db, user, task_id)
    task_service.delete_task(db, storage, task)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
