from functools import lru_cache
from typing import Protocol

from fastapi import UploadFile

from app.core.config import get_settings
from app.storage.database import DatabaseStorage
from app.storage.local import LocalStorage


class Storage(Protocol):
    """Contrato comum aos backends de armazenamento de anexos."""

    max_bytes: int

    def save(self, file: UploadFile) -> tuple[str, int]: ...

    def read(self, stored_name: str) -> bytes | None: ...

    def delete(self, stored_name: str) -> None: ...


@lru_cache
def get_storage() -> Storage:
    settings = get_settings()
    if settings.storage_backend == "database":
        from app.db.session import SessionLocal

        return DatabaseStorage(SessionLocal, settings.max_upload_bytes)
    return LocalStorage(settings.upload_dir, settings.max_upload_bytes)
