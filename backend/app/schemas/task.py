from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Priority, TaskStatus
from app.schemas.attachment import AttachmentOut
from app.schemas.user import UserSummary


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    due_date: date | None = None
    status: TaskStatus = TaskStatus.PENDING
    priority: Priority = Priority.MEDIUM


class TaskUpdate(BaseModel):
    """Todos os campos são opcionais (PATCH). Só o que for enviado é alterado."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    due_date: date | None = None
    status: TaskStatus | None = None
    priority: Priority | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    due_date: date | None
    status: TaskStatus
    priority: Priority
    created_at: datetime
    updated_at: datetime
    owner: UserSummary
    attachments: list[AttachmentOut]


class TaskPage(BaseModel):
    items: list[TaskOut]
    total: int
