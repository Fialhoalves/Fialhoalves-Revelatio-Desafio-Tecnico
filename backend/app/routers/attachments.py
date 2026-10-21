from typing import Annotated

from urllib.parse import quote

from fastapi import APIRouter, Depends, Query, Response, UploadFile, status

from app.core.deps import CurrentUser, DbSession
from app.core.errors import AttachmentFileMissing, error_responses
from app.schemas.attachment import AttachmentOut
from app.services import attachments as attachment_service
from app.services.tasks import get_accessible_task
from app.storage import Storage as StorageBackend
from app.storage import get_storage

router = APIRouter(tags=["attachments"], responses=error_responses(401, 404, 413, 415))

Storage = Annotated[StorageBackend, Depends(get_storage)]


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
    content = storage.read(attachment.stored_name)
    if content is None:
        raise AttachmentFileMissing()
    disposition = "inline" if inline else "attachment"
    return Response(
        content=content,
        media_type=attachment.content_type,
        headers={"Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(attachment.original_name)}"},
    )


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(attachment_id: int, db: DbSession, user: CurrentUser, storage: Storage):
    attachment = attachment_service.get_accessible_attachment(db, user, attachment_id)
    attachment_service.delete_attachment(db, storage, attachment)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
