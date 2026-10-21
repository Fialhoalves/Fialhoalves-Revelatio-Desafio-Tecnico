from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.deps import CurrentUser, DbSession
from app.core.errors import error_responses
from app.models import Priority, TaskStatus
from app.schemas.task import TaskCreate, TaskOut, TaskPage, TaskStats, TaskUpdate
from app.services import tasks as task_service
from app.services.tasks import SortField, SortOrder
from app.storage import get_storage
from app.storage.local import LocalStorage

router = APIRouter(prefix="/tasks", tags=["tasks"], responses=error_responses(401, 404))

Storage = Annotated[LocalStorage, Depends(get_storage)]


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(data: TaskCreate, db: DbSession, user: CurrentUser):
    return task_service.create_task(db, user, data)


@router.get("", response_model=TaskPage)
def list_tasks(
    db: DbSession,
    user: CurrentUser,
    status_filter: Annotated[TaskStatus | None, Query(alias="status")] = None,
    priority: Annotated[Priority | None, Query()] = None,
    q: Annotated[str | None, Query(description="Busca no título e na descrição")] = None,
    owner_id: Annotated[int | None, Query(description="Filtro por dono (apenas admin)")] = None,
    due_before: Annotated[date | None, Query(description="Prazo até esta data (inclusive)")] = None,
    due_after: Annotated[date | None, Query(description="Prazo a partir desta data (inclusive)")] = None,
    overdue: Annotated[bool, Query(description="Somente atrasadas: prazo vencido e não concluídas")] = False,
    sort: Annotated[SortField, Query(description="Campo de ordenação")] = SortField.CREATED_AT,
    order: Annotated[SortOrder, Query(description="Sentido da ordenação")] = SortOrder.DESC,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """Usuário comum vê apenas as próprias tasks; admin vê todas."""
    items, total = task_service.list_tasks(
        db,
        user,
        status_filter=status_filter,
        priority=priority,
        q=q,
        owner_id=owner_id,
        due_before=due_before,
        due_after=due_after,
        overdue=overdue,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
    )
    return TaskPage(items=items, total=total)


@router.get("/stats", response_model=TaskStats)
def task_stats(db: DbSession, user: CurrentUser):
    """Contagens por status e prioridade. O administrador recebe também o resumo por usuário."""
    return task_service.task_stats(db, user)


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
