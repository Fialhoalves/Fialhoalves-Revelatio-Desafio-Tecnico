from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import TaskNotFound
from app.models import Role, Task, TaskStatus, User
from app.schemas.task import TaskCreate, TaskUpdate
from app.storage.local import LocalStorage


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
    q: str | None = None,
    owner_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Task], int]:
    query = select(Task)
    if user.role == Role.ADMIN:
        if owner_id is not None:
            query = query.where(Task.owner_id == owner_id)
    else:
        query = query.where(Task.owner_id == user.id)

    if status_filter is not None:
        query = query.where(Task.status == status_filter)
    if q:
        pattern = f"%{q}%"
        query = query.where(or_(Task.title.ilike(pattern), Task.description.ilike(pattern)))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.options(selectinload(Task.attachments), selectinload(Task.owner))
        .order_by(Task.created_at.desc(), Task.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return list(items), total


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


def delete_task(db: Session, storage: LocalStorage, task: Task) -> None:
    stored_names = [a.stored_name for a in task.attachments]
    db.delete(task)
    db.commit()
    for name in stored_names:
        storage.delete(name)
