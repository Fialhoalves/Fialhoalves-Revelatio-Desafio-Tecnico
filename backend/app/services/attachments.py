from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AttachmentNotFound, FileTypeNotAllowed
from app.models import Attachment, Role, Task, User
from app.storage.local import LocalStorage


def add_attachment(db: Session, storage: LocalStorage, task: Task, file: UploadFile) -> Attachment:
    content_type = (file.content_type or "").lower()
    if content_type not in get_settings().allowed_content_types:
        raise FileTypeNotAllowed(f"O tipo de arquivo '{content_type or 'desconhecido'}' não é permitido.")

    stored_name, size = storage.save(file)
    attachment = Attachment(
        task_id=task.id,
        original_name=(file.filename or "arquivo")[:255],
        stored_name=stored_name,
        content_type=content_type,
        size=size,
    )
    db.add(attachment)
    try:
        db.commit()
    except Exception:
        db.rollback()
        storage.delete(stored_name)
        raise
    db.refresh(attachment)
    return attachment


def get_accessible_attachment(db: Session, user: User, attachment_id: int) -> Attachment:
    """Anexo segue a mesma regra de acesso da task a que pertence."""
    attachment = db.get(Attachment, attachment_id)
    if attachment is None or (user.role != Role.ADMIN and attachment.task.owner_id != user.id):
        raise AttachmentNotFound()
    return attachment


def delete_attachment(db: Session, storage: LocalStorage, attachment: Attachment) -> None:
    stored_name = attachment.stored_name
    db.delete(attachment)
    db.commit()
    storage.delete(stored_name)
