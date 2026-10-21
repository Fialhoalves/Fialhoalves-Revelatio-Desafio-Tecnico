import enum
from datetime import date

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import TaskNotFound
from app.models import Priority, Role, Task, TaskStatus, User
from app.schemas.task import OwnerStats, TaskCreate, TaskStats, TaskUpdate
from app.storage import Storage


class SortField(str, enum.Enum):
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    DUE_DATE = "due_date"
    PRIORITY = "priority"
    TITLE = "title"


class SortOrder(str, enum.Enum):
    ASC = "asc"
    DESC = "desc"


_PRIORITY_RANK = case({Priority.HIGH.value: 3, Priority.MEDIUM.value: 2, Priority.LOW.value: 1}, value=Task.priority)


def _visible_tasks(user: User):
    """Base da consulta: usuário comum só enxerga as próprias tasks."""
    query = select(Task)
    if user.role != Role.ADMIN:
        query = query.where(Task.owner_id == user.id)
    return query


def get_accessible_task(db: Session, user: User, task_id: int) -> Task:
    """Retorna a task se o usuário for o dono ou admin.

    Para quem não tem acesso respondemos 404 (e não 403) para não revelar
    que a task existe.
    """
    task = db.get(Task, task_id)
    if task is None or (user.role != Role.ADMIN and task.owner_id != user.id):
        raise TaskNotFound()
    return task


def list_tasks(
    db: Session,
    user: User,
    *,
    status_filter: TaskStatus | None = None,
    priority: Priority | None = None,
    q: str | None = None,
    owner_id: int | None = None,
    due_before: date | None = None,
    due_after: date | None = None,
    overdue: bool = False,
    sort: SortField = SortField.CREATED_AT,
    order: SortOrder = SortOrder.DESC,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Task], int]:
    query = _visible_tasks(user)
    if owner_id is not None and user.role == Role.ADMIN:
        query = query.where(Task.owner_id == owner_id)
    if status_filter is not None:
        query = query.where(Task.status == status_filter)
    if priority is not None:
        query = query.where(Task.priority == priority)
    if due_before is not None:
        query = query.where(Task.due_date <= due_before)
    if due_after is not None:
        query = query.where(Task.due_date >= due_after)
    if overdue:
        query = query.where(Task.due_date < date.today(), Task.status != TaskStatus.DONE)
    if q:
        pattern = f"%{q}%"
        query = query.where(or_(Task.title.ilike(pattern), Task.description.ilike(pattern)))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    column = _PRIORITY_RANK if sort == SortField.PRIORITY else getattr(Task, sort.value)
    ordering = column.asc() if order == SortOrder.ASC else column.desc()
    if sort == SortField.DUE_DATE:
        ordering = ordering.nulls_last()  # tasks sem prazo ficam no fim nos dois sentidos

    items = db.scalars(
        query.options(selectinload(Task.attachments), selectinload(Task.owner))
        .order_by(ordering, Task.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return list(items), total


def task_stats(db: Session, user: User) -> TaskStats:
    visible = _visible_tasks(user).subquery()
    by_status = {s: 0 for s in TaskStatus}
    by_priority = {p: 0 for p in Priority}
    for status_value, count in db.execute(select(visible.c.status, func.count()).group_by(visible.c.status)):
        by_status[TaskStatus(status_value)] = count
    for priority_value, count in db.execute(select(visible.c.priority, func.count()).group_by(visible.c.priority)):
        by_priority[Priority(priority_value)] = count

    overdue = db.scalar(
        select(func.count()).where(visible.c.due_date < date.today(), visible.c.status != TaskStatus.DONE.value)
    ) or 0

    by_owner = None
    if user.role == Role.ADMIN:
        owners: dict[int, OwnerStats] = {}
        rows = db.execute(
            select(User.id, User.name, visible.c.status, func.count())
            .join(visible, visible.c.owner_id == User.id)
            .group_by(User.id, User.name, visible.c.status)
            .order_by(User.name)
        )
        for owner_id, owner_name, status_value, count in rows:
            owner = owners.setdefault(
                owner_id,
                OwnerStats(owner_id=owner_id, owner_name=owner_name, total=0, by_status={s: 0 for s in TaskStatus}),
            )
            owner.by_status[TaskStatus(status_value)] = count
            owner.total += count
        by_owner = list(owners.values())

    return TaskStats(
        total=sum(by_status.values()), overdue=overdue, by_status=by_status, by_priority=by_priority, by_owner=by_owner
    )


def create_task(db: Session, user: User, data: TaskCreate) -> Task:
    task = Task(**data.model_dump(), owner_id=user.id)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, task: Task, data: TaskUpdate) -> Task:
    for field, value in data.model_dump(exclude_unset=True).items():
        if field in ("title", "status", "priority") and value is None:
            continue  # esses campos não aceitam null
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, storage: Storage, task: Task) -> None:
    stored_names = [a.stored_name for a in task.attachments]
    db.delete(task)
    db.commit()
    for name in stored_names:
        storage.delete(name)
