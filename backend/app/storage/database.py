import uuid
from collections.abc import Callable

from fastapi import UploadFile
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import FileTooLarge
from app.models import AttachmentBlob

CHUNK_SIZE = 1024 * 1024


class DatabaseStorage:
    """Guarda o conteúdo dos anexos no PostgreSQL.

    Útil em hospedagens com disco efêmero. Cada operação usa uma sessão curta
    própria, o que mantém o mesmo contrato do LocalStorage: gravar e remover
    são efetivadas de imediato, independentemente da sessão da requisição.
    """

    def __init__(self, session_factory: Callable[[], Session], max_bytes: int):
        self.session_factory = session_factory
        self.max_bytes = max_bytes

    def save(self, file: UploadFile) -> tuple[str, int]:
        chunks: list[bytes] = []
        size = 0
        while chunk := file.file.read(CHUNK_SIZE):
            size += len(chunk)
            if size > self.max_bytes:
                raise FileTooLarge(f"O arquivo excede o limite de {self.max_bytes // (1024 * 1024)} MB.")
            chunks.append(chunk)

        stored_name = uuid.uuid4().hex
        with self.session_factory() as session:
            session.add(AttachmentBlob(stored_name=stored_name, data=b"".join(chunks)))
            session.commit()
        return stored_name, size

    def read(self, stored_name: str) -> bytes | None:
        with self.session_factory() as session:
            return session.scalar(select(AttachmentBlob.data).where(AttachmentBlob.stored_name == stored_name))

    def delete(self, stored_name: str) -> None:
        with self.session_factory() as session:
            session.execute(delete(AttachmentBlob).where(AttachmentBlob.stored_name == stored_name))
            session.commit()
