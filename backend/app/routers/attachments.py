from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, UploadFile, status
from fastapi.responses import FileResponse

from app.core.deps import CurrentUser, DbSession
from app.core.errors import AttachmentFileMissing
from app.schemas.attachment import AttachmentOut
from app.services import attachments as attachment_service
from app.services.tasks import get_accessible_task
from app.storage import get_storage
from app.storage.local import LocalStorage

router = APIRouter(tags=["attachments"])

Storage = Annotated[LocalStorage, Depends(get_storage)]


@router.post(
    "/tasks/{task_id}/attachments", response_model=list[AttachmentOut], status_code=status.HTTP_201_CREATED
)
def upload_attachments(
    task_id: int, files: list[UploadFile], db: DbSession, user: CurrentUser, storage: Storage
):
    """Anexa um ou mais arquivos (multipart, campo `files`) à task."""
    task = get_accessible_task(db, user, task_id)
    return [attachment_service.add_attachment(db, storage, task, f) for f in files]


@router.get("/tasks/{task_id}/attachments", response_model=list[AttachmentOut])
def list_attachments(task_id: int, db: DbSession, user: CurrentUser):
    return get_accessible_task(db, user, task_id).attachments


@router.get("/attachments/{attachment_id}/download")
def download_attachment(
    attachment_id: int,
    db: DbSession,
    user: CurrentUser,
    storage: Storage,
    inline: Annotated[bool, Query(description="true para exibir no navegador (preview)")] = False,
):
    attachment = attachment_service.get_accessible_attachment(db, user, attachment_id)
    path = storage.path(attachment.stored_name)
    if not path.exists():
        raise AttachmentFileMissing()
    return FileResponse(
        path,
        media_type=attachment.content_type,
        filename=attachment.original_name,
        content_disposition_type="inline" if inline else "attachment",
    )


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(attachment_id: int, db: DbSession, user: CurrentUser, storage: Storage):
    attachment = attachment_service.get_accessible_attachment(db, user, attachment_id)
    attachment_service.delete_attachment(db, storage, attachment)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
